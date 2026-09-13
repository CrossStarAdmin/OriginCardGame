// 1試合の準備と進行、マッチ単位の集計
const { DECKS } = require('./cards.js');
const E = require('./engine.js');
const FX = require('./effects.js');
const AI = require('./ai.js');

E.setEffects(FX);

// knobs = [先攻のつまみ, 後攻のつまみ]。省略すると両者とも既定の打ち方
// observe(g, p, 'start' | 'end') は各手番の前後に呼ばれる。試合の記録を取りたいときだけ渡す
function playGame(deckA, deckB, seed, stats, gameId, knobs, observe) {
  const g = new E.Game(deckA, deckB, seed, stats, gameId);
  g.playedThisGame = [];
  if (knobs) {
    g.players[0].knobs = knobs[0] || null;
    g.players[1].knobs = knobs[1] || null;
  }
  // SECOND_EXTRA=1 で「後攻は6枚スタート」の検証用ルールに切り替える
  const extra = process.env.SECOND_EXTRA === '1' ? 1 : 0;
  for (const p of g.players) {
    E.draw(g, p, 5 + (p.idx === 1 ? extra : 0));
    AI.mulligan(g, p);
  }
  g.players[1].power = 2; // 後攻はパワー2スタート
  g.players[1].holy = 2;    // 後攻は聖水2つスタート（ルール/01_基本ルール）
  let tp = 0;
  while (!g.over && g.turn < E.TURN_CAP) {
    g.turn++;
    g.turnPlayer = tp;
    if (observe) observe(g, g.players[tp], 'start');
    AI.takeTurn(g, g.players[tp]);
    if (observe) observe(g, g.players[tp], 'end');
    tp = 1 - tp;
  }
  if (!g.over) { g.over = true; g.winner = 'draw'; }
  return g;
}

// opts = { knobsA, knobsB }。デッキAとデッキBそれぞれの打ち方で、先攻後攻を入れ替えても付いていく
function runMatch(deckA, deckB, n, seed0, opts) {
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
    const seatKnobs = opts ? (aFirst ? [opts.knobsA, opts.knobsB] : [opts.knobsB, opts.knobsA]) : null;
    const g = playGame(d0, d1, seed0 + i * 7919, stats, i, seatKnobs);

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

module.exports = { playGame, runMatch, resolveMatchups };
