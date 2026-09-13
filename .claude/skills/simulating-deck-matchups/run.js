// 総当たり対戦：マッチアップ別の勝率とカード別統計
const path = require('path');
const CORE = path.join(__dirname, '..', '..', '..', 'システム', '対戦');
const { runMatch, resolveMatchups } = require(path.join(CORE, 'match.js'));

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

module.exports = { report };
