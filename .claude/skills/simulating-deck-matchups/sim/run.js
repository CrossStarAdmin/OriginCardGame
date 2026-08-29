// 対戦シミュレーションの実行と集計
const { CARD_DB, DECKS } = require('./cards.js');
const E = require('./engine.js');
const FX = require('./effects.js');
const AI = require('./ai.js');

E.setEffects(FX);

function playGame(deckA, deckB, seed, stats, gameId) {
  const g = new E.Game(deckA, deckB, seed, stats, gameId);
  g.playedThisGame = [];
  // SECOND_EXTRA=1 で「後攻は6枚スタート」の検証用ルールに切り替える
  const extra = process.env.SECOND_EXTRA === '1' ? 1 : 0;
  for (const p of g.players) {
    E.draw(g, p, 5 + (p.idx === 1 ? extra : 0));
    AI.mulligan(g, p);
  }
  g.players[1].tension = 2; // 後攻はテンション2スタート
  g.players[1].holy = 2;    // 後攻は聖水2つスタート（ルール/01_基本ルール）
  let tp = 0;
  while (!g.over && g.turn < E.TURN_CAP) {
    g.turn++;
    g.turnPlayer = tp;
    AI.takeTurn(g, g.players[tp]);
    tp = 1 - tp;
  }
  if (!g.over) { g.over = true; g.winner = 'draw'; }
  return g;
}

function runMatch(deckA, deckB, n, seed0) {
  const stats = {};
  const res = {
    a: deckA, b: deckB, n,
    aWins: 0, bWins: 0, draws: 0,
    aWinsFirst: 0, aGamesFirst: 0, bWinsFirst: 0, bGamesFirst: 0,
    turnsTotal: 0, turnHist: {}, fatigue: 0,
    aHpLeft: 0, bHpLeft: 0,
  };
  for (let i = 0; i < n; i++) {
    // 先攻を交互に入れ替えて公平にする
    const aFirst = i % 2 === 0;
    const d0 = aFirst ? deckA : deckB;
    const d1 = aFirst ? deckB : deckA;
    const g = playGame(d0, d1, seed0 + i * 7919, stats, i);

    let winnerDeck = null;
    if (g.winner === 'draw') { res.draws++; }
    else winnerDeck = g.players[g.winner].deckName;

    if (winnerDeck === deckA) res.aWins++;
    else if (winnerDeck === deckB) res.bWins++;

    if (aFirst) {
      res.aGamesFirst++;
      if (winnerDeck === deckA) res.aWinsFirst++;
    } else {
      res.bGamesFirst++;
      if (winnerDeck === deckB) res.bWinsFirst++;
    }
    res.turnsTotal += g.turn;
    res.turnHist[g.turn] = (res.turnHist[g.turn] || 0) + 1;
    if (g.players[0].fatigueLoss || g.players[1].fatigueLoss) res.fatigue++;
    for (const p of g.players) {
      if (p.deckName === deckA) res.aHpLeft += Math.max(0, p.leaderHp);
      else res.bHpLeft += Math.max(0, p.leaderHp);
    }

    // カード別統計の確定
    for (const [deckName, cardName] of g.playedThisGame) {
      const s = stats[deckName][cardName];
      s.games++;
      if (winnerDeck === deckName) s.wins++;
      s.seen = false;
    }
  }
  res.stats = stats;
  return res;
}

function pct(x, n) { return n ? (100 * x / n).toFixed(1) : '0.0'; }

function cardTable(res, deckName, deckWins, n) {
  const s = res.stats[deckName] || {};
  const rows = [];
  for (const [name, v] of Object.entries(s)) {
    const perGame = v.played / n;
    const contrib = v.faceDmg / n + (v.kills / n) * 3 + (v.heal / n) * 0.8;
    rows.push({
      name,
      played: v.played, perGame,
      face: v.faceDmg / n,
      kills: v.kills / n,
      heal: v.heal / n,
      useRate: v.games / n,
      winWhenPlayed: v.games ? v.wins / v.games : 0,
      delta: (v.games ? v.wins / v.games : 0) - deckWins / n,
      contrib,
    });
  }
  return rows.sort((x, y) => y.contrib - x.contrib);
}

function report(res) {
  const n = res.n;
  const lines = [];
  lines.push(`\n================ ${res.a} vs ${res.b} （${n}戦） ================`);
  lines.push(`${res.a}: ${res.aWins}勝 (${pct(res.aWins, n)}%)   ${res.b}: ${res.bWins}勝 (${pct(res.bWins, n)}%)   引き分け: ${res.draws}`);
  lines.push(`先攻時勝率: ${res.a} ${pct(res.aWinsFirst, res.aGamesFirst)}% (${res.aWinsFirst}/${res.aGamesFirst}) / ${res.b} ${pct(res.bWinsFirst, res.bGamesFirst)}% (${res.bWinsFirst}/${res.bGamesFirst})`);
  const aSecondW = res.aWins - res.aWinsFirst, aSecondG = n - res.aGamesFirst;
  const bSecondW = res.bWins - res.bWinsFirst, bSecondG = n - res.bGamesFirst;
  lines.push(`後攻時勝率: ${res.a} ${pct(aSecondW, aSecondG)}% / ${res.b} ${pct(bSecondW, bSecondG)}%`);
  lines.push(`平均決着手番: ${(res.turnsTotal / n).toFixed(1)}（各プレイヤー約${(res.turnsTotal / n / 2).toFixed(1)}ターン）  デッキ切れ決着: ${res.fatigue}`);
  lines.push(`勝者側の平均残HP: ${res.a} ${(res.aHpLeft / n).toFixed(1)} / ${res.b} ${(res.bHpLeft / n).toFixed(1)}`);

  for (const [deckName, wins] of [[res.a, res.aWins], [res.b, res.bWins]]) {
    lines.push(`\n--- ${deckName} カード別 （このマッチの勝率 ${pct(wins, n)}%）---`);
    lines.push('カード名           使用率  使用回数/戦  顔ダメ/戦  撃破/戦  回復/戦  使用時勝率  勝率差');
    for (const r of cardTable(res, deckName, wins, n)) {
      lines.push(
        r.name.padEnd(16, '　').slice(0, 16) +
        ('  ' + (r.useRate * 100).toFixed(0) + '%').padStart(7) +
        ('  ' + r.perGame.toFixed(2)).padStart(12) +
        ('  ' + r.face.toFixed(2)).padStart(10) +
        ('  ' + r.kills.toFixed(2)).padStart(9) +
        ('  ' + r.heal.toFixed(2)).padStart(9) +
        ('  ' + (r.winWhenPlayed * 100).toFixed(1) + '%').padStart(11) +
        ('  ' + (r.delta * 100 >= 0 ? '+' : '') + (r.delta * 100).toFixed(1)).padStart(9)
      );
    }
  }
  return lines.join('\n');
}

// 引数のデッキ名から総当たりの組み合わせを作る。省略時は cards.js の全デッキ
function resolveMatchups(argv) {
  const names = argv.length ? argv : Object.keys(DECKS);
  for (const n of names) {
    if (!DECKS[n]) {
      console.error(`デッキ「${n}」は cards.js の DECKS にありません。使えるのは: ${Object.keys(DECKS).join(' / ')}`);
      process.exit(1);
    }
  }
  if (names.length < 2) {
    console.error('総当たりには2デッキ以上必要です。');
    process.exit(1);
  }
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) pairs.push([names[i], names[j]]);
  }
  return pairs;
}

function main() {
const N = parseInt(process.argv[2] || '1000', 10);
const matchups = resolveMatchups(process.argv.slice(3));

const all = [];
for (let i = 0; i < matchups.length; i++) {
  const [a, b] = matchups[i];
  const res = runMatch(a, b, N, 1000 + i * 100003);
  all.push(res);
  console.log(report(res));
}

// 総合
console.log('\n================ 総合成績 ================');
const totals = {};
for (const res of all) {
  totals[res.a] = totals[res.a] || { w: 0, g: 0 };
  totals[res.b] = totals[res.b] || { w: 0, g: 0 };
  totals[res.a].w += res.aWins; totals[res.a].g += res.n;
  totals[res.b].w += res.bWins; totals[res.b].g += res.n;
}
for (const [d, t] of Object.entries(totals)) {
  console.log(`${d.padEnd(22)} ${t.w}勝 / ${t.g}戦  勝率 ${pct(t.w, t.g)}%`);
}
}

if (require.main === module) main();

module.exports = { playGame, runMatch, report, resolveMatchups };
