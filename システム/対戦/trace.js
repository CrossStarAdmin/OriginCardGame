// 1試合の進行を出力して挙動を検証する
const E = require('./engine.js');
const FX = require('./effects.js');
const AI = require('./ai.js');
E.setEffects(FX);

const deckA = process.argv[2] || 'アグロリーゼ';
const deckB = process.argv[3] || 'コントロールアルベル';
const seed = parseInt(process.argv[4] || '12345', 10);

const stats = {};
const g = new E.Game(deckA, deckB, seed, stats, 0);
g.playedThisGame = [];
for (const p of g.players) { E.draw(g, p, 5); AI.mulligan(g, p); }
g.players[1].power = 2;
g.players[1].holy = 1;

function boardStr(p) {
  return p.board.map((u) => `${u.name}(${u.atk}/${u.hp}${u.kw.size ? '[' + [...u.kw].join(',') + ']' : ''})`).join(' ') || '（なし）';
}

let tp = 0;
while (!g.over && g.turn < E.TURN_CAP) {
  g.turn++;
  const p = g.players[tp];
  const before = p.hand.slice();
  g.turnPlayer = tp;
  AI.takeTurn(g, p);
  const foe = g.players[1 - tp];
  console.log(`\n[手番${g.turn}] ${p.deckName} (MP${p.maxMp} PW${p.power})`);
  console.log(`  手札前: ${before.join(',')}`);
  console.log(`  手札後: ${p.hand.join(',')} / 山${p.deck.length} 墓${p.grave.length}`);
  console.log(`  自盤面: ${boardStr(p)}`);
  console.log(`  敵盤面: ${boardStr(foe)}`);
  console.log(`  HP: ${p.deckName}=${p.leaderHp}(攻${E.leaderAtkTotal(p)}/防${E.leaderDefTotal(p)}) `
    + `${foe.deckName}=${foe.leaderHp}(攻${E.leaderAtkTotal(foe)}/防${E.leaderDefTotal(foe)})`);
  const gear = (x) => [
    x.weapon ? `武器${x.weapon.name}(${E.weaponAtk(x)})` : '',
    x.leader === 'ヴェイン' ? `面:${x.side}` : '',
    x.preventNext ? '次のダメージ0' : '',
    x.stages.length ? `ステージ:${x.stages.map((s) => `${s.name}${s.resting ? '(レスト)' : ''}`).join(',')}` : '',
  ].filter(Boolean).join(' ');
  if (gear(p) || gear(foe)) console.log(`  装備: ${p.deckName}=${gear(p) || 'なし'}  ${foe.deckName}=${gear(foe) || 'なし'}`);
  tp = 1 - tp;
}
console.log(`\n決着: ${g.winner === 'draw' ? '引き分け' : g.players[g.winner].deckName + 'の勝ち'} (手番${g.turn})`);
