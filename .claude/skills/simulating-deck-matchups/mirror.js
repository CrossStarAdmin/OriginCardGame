// 先攻・後攻の有利さを測るミラーマッチ診断
const path = require('path');
const CORE = path.join(__dirname, '..', '..', '..', 'システム', '対戦');
const { DECKS } = require(path.join(CORE, 'cards.js'));
const { playGame } = require(path.join(CORE, 'match.js'));

const N = parseInt(process.argv[2] || '500', 10);
const targets = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(DECKS);
for (const d of targets) {
  if (!DECKS[d]) {
    console.error(`デッキ「${d}」は cards.js の DECKS にありません。`);
    process.exit(1);
  }
  const stats = {};
  let first = 0, second = 0, draw = 0, turns = 0;
  for (let i = 0; i < N; i++) {
    const g = playGame(d, d, 5000 + i * 3571, stats, i);
    if (g.winner === 'draw') draw++;
    else if (g.winner === 0) first++;
    else second++;
    turns += g.turn;
    for (const [dn, cn] of g.playedThisGame) stats[dn][cn].seen = false;
  }
  console.log(`${d.padEnd(22)} 先攻 ${first} (${(100 * first / N).toFixed(1)}%) / 後攻 ${second} (${(100 * second / N).toFixed(1)}%) / 引分 ${draw}  平均手番 ${(turns / N).toFixed(1)}`);
}
