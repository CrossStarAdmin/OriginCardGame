// 各デッキのカードを全マッチ合算で集計し、エースカードを出す
const path = require('path');
const CORE = path.join(__dirname, '..', '..', '..', 'システム', '対戦');
const { CARD_DB } = require(path.join(CORE, 'cards.js'));
const { playGame, resolveMatchups } = require(path.join(CORE, 'match.js'));

const N = parseInt(process.argv[2] || '1000', 10);
const matchups = resolveMatchups(process.argv.slice(3));

const stats = {};
const deckGames = {};
const deckWins = {};

matchups.forEach(([a, b], mi) => {
  for (let i = 0; i < N; i++) {
    const aFirst = i % 2 === 0;
    const g = playGame(aFirst ? a : b, aFirst ? b : a, 1000 + mi * 100003 + i * 7919, stats, i);
    const winner = g.winner === 'draw' ? null : g.players[g.winner].deckName;
    for (const d of [a, b]) {
      deckGames[d] = (deckGames[d] || 0) + 1;
      if (winner === d) deckWins[d] = (deckWins[d] || 0) + 1;
    }
    for (const [dn, cn] of g.playedThisGame) {
      const s = stats[dn][cn];
      s.games++;
      if (winner === dn) s.wins++;
      s.seen = false;
    }
  }
});

for (const deck of Object.keys(deckGames)) {
  const n = deckGames[deck];
  const base = (deckWins[deck] || 0) / n;
  console.log(`\n===== ${deck}（全${n}戦 勝率 ${(base * 100).toFixed(1)}%）=====`);
  const rows = Object.entries(stats[deck]).map(([name, v]) => {
    const d = CARD_DB[name];
    return {
      name,
      cost: d ? d.cost : '-',
      face: v.faceDmg / n,
      kills: v.kills / n,
      heal: v.heal / n,
      useRate: v.games / n,
      wr: v.games ? v.wins / v.games : 0,
      delta: (v.games ? v.wins / v.games : 0) - base,
      contrib: v.faceDmg / n + (v.kills / n) * 3 + (v.heal / n) * 0.8,
    };
  }).sort((x, y) => y.contrib - x.contrib);
  console.log('順位 カード名          コスト 貢献度  顔ダメ/戦 撃破/戦 回復/戦 使用率 使用時勝率 勝率差');
  rows.forEach((r, i) => {
    console.log(
      String(i + 1).padStart(3) + ' ' +
      r.name.padEnd(15, '　').slice(0, 15) +
      String(r.cost).padStart(4) +
      r.contrib.toFixed(2).padStart(8) +
      r.face.toFixed(2).padStart(9) +
      r.kills.toFixed(2).padStart(8) +
      r.heal.toFixed(2).padStart(8) +
      ((r.useRate * 100).toFixed(0) + '%').padStart(7) +
      ((r.wr * 100).toFixed(1) + '%').padStart(10) +
      ((r.delta >= 0 ? '+' : '') + (r.delta * 100).toFixed(1)).padStart(8)
    );
  });
}
