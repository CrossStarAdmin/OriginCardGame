// 打ち方のセットで総当たりを回し、対戦表・エースカード・既定の相手への勝率を出す
// 使い方: node evaluate.js <season-XX.json | default> [戦数]
const fs = require('fs');
const C = require('./common.js');

// 評価用のシードは学習に使わない
function evaluate(knobSet, n) {
  const matrix = [];
  const totals = {};
  const cards = {};
  C.pairsOf(C.DECK_NAMES).forEach(([a, b], i) => {
    const res = C.runMatch(a, b, n, C.EVAL_SEED_BASE + i * 100003, { knobsA: knobSet[a], knobsB: knobSet[b] });
    matrix.push({
      a, b,
      aRate: res.aWins / n,
      aFirst: res.aWinsFirst / res.aGamesFirst,
      aSecond: (res.aWins - res.aWinsFirst) / (n - res.aGamesFirst),
      bFirst: res.bWinsFirst / res.bGamesFirst,
      bSecond: (res.bWins - res.bWinsFirst) / (n - res.bGamesFirst),
      turns: res.turnsTotal / n,
      fatigue: res.fatigue,
    });
    for (const [d, w] of [[a, res.aWins], [b, res.bWins]]) {
      totals[d] = totals[d] || { w: 0, g: 0 };
      totals[d].w += w;
      totals[d].g += n;
      const list = cards[d] || (cards[d] = {});
      for (const [name, s] of Object.entries(res.stats[d] || {})) {
        const x = list[name] || (list[name] = { face: 0, kills: 0, heal: 0, games: 0, wins: 0 });
        x.face += s.faceDmg; x.kills += s.kills; x.heal += s.heal; x.games += s.games; x.wins += s.wins;
      }
    }
  });
  const rates = Object.fromEntries(Object.entries(totals).map(([d, t]) => [d, t.w / t.g]));
  const aces = {};
  for (const [d, list] of Object.entries(cards)) {
    const g = totals[d].g;
    aces[d] = Object.entries(list).map(([name, x]) => ({
      name,
      contrib: x.face / g + (x.kills / g) * 3 + (x.heal / g) * 0.8,
      face: x.face / g,
      kills: x.kills / g,
      heal: x.heal / g,
      use: x.games / g,
      delta: (x.games ? x.wins / x.games : 0) - rates[d],
    })).sort((p, q) => q.contrib - p.contrib);
  }
  return { n, matrix, totals: rates, aces };
}

// 各デッキを knobSet の打ち方にし、相手は既定の打ち方で戦ったときの平均勝率
// 学習前（既定同士）の値との差が上達幅になる
function versusDefault(knobSet, n) {
  const out = {};
  C.DECK_NAMES.forEach((d, di) => {
    let sum = 0;
    let cnt = 0;
    C.DECK_NAMES.forEach((o, oi) => {
      if (o === d) return;
      const res = C.runMatch(d, o, n, C.EVAL_SEED_BASE + 7 + di * 1009 + oi * 100003, { knobsA: knobSet[d], knobsB: null });
      sum += res.aWins / n;
      cnt++;
    });
    out[d] = sum / cnt;
  });
  return out;
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }

function printEvaluation(ev, vd) {
  console.log(`\n対戦表（左のデッキから見た勝率、各${ev.n}戦）`);
  for (const m of ev.matrix) {
    console.log(`  ${m.a} vs ${m.b}: ${pct(m.aRate)}  （先攻 ${pct(m.aFirst)} / 後攻 ${pct(m.aSecond)}、${m.turns.toFixed(1)}手番、デッキ切れ ${m.fatigue}）`);
  }
  console.log('\n総合勝率');
  for (const [d, r] of Object.entries(ev.totals)) console.log(`  ${d} ${pct(r)}`);
  if (vd) {
    console.log('\n既定の打ち方の相手への平均勝率');
    for (const [d, r] of Object.entries(vd)) console.log(`  ${d} ${pct(r)}`);
  }
  console.log('\nエースカード（上位5枚：貢献度 / 使用率 / 勝率差）');
  for (const [d, list] of Object.entries(ev.aces)) {
    console.log(`  ${d}`);
    for (const c of list.slice(0, 5)) {
      console.log(`    ${c.name} ${c.contrib.toFixed(2)} / ${(c.use * 100).toFixed(0)}% / ${c.delta >= 0 ? '+' : ''}${(c.delta * 100).toFixed(1)}`);
    }
  }
}

function main() {
  const src = process.argv[2] || 'default';
  const n = parseInt(process.argv[3] || '1000', 10);
  const knobSet = src === 'default' ? C.defaultKnobSet() : JSON.parse(fs.readFileSync(src, 'utf8')).knobs;
  const ev = evaluate(knobSet, n);
  const vd = versusDefault(knobSet, Math.max(100, Math.floor(n / 2)));
  printEvaluation(ev, vd);
}

if (require.main === module) main();

module.exports = { evaluate, versusDefault, printEvaluation };
