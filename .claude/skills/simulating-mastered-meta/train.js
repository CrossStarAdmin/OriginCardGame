// 熟練環境の学習：シーズンごとに 対戦と反省 → 直す案を試す → 効いた案だけ定着 → 評価 を繰り返す
// 使い方: node train.js [--seasons 30] [--seed 1] [--reflect 200] [--test 400] [--eval 1000] [--gain 400] [--out フォルダ]
const fs = require('fs');
const path = require('path');
const C = require('./common.js');
const { evaluate, versusDefault } = require('./evaluate.js');
const { makeRecorder, reflectGame, proposalsFor } = require('./reflect.js');

const HOF_SIZE = 5;       // 学習相手に混ぜる過去シーズンの数
const HOF_SHARE = 4;      // 何戦に1戦を過去シーズンの相手にするか

function parseArgs(argv) {
  const o = {
    seasons: 30, seed: 1, reflect: 200, test: 400, eval: 1000, gain: 400,
    proposals: 4, patience: 5, minGain: 0.02, minZ: 2.5, out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`オプションは --名前 値 の形で渡す: ${arg}`);
    const key = arg.slice(2);
    const value = argv[++i];
    if (!(key in o)) throw new Error(`不明なオプション: ${arg}`);
    if (value === undefined) throw new Error(`${arg} に値が無い`);
    o[key] = key === 'out' ? value : Number(value);
  }
  o.out = o.out || path.join(__dirname, 'out', `seed-${o.seed}`);
  return o;
}

// 学習相手のつまみ。HOF_SHARE 戦に1戦は過去シーズンの相手にして、今の流行だけへの過学習を防ぐ
function opponentKnobs(o, snapshot, hof, opp, tag, count) {
  const rng = C.rngOf(o.seed, 'hof', tag);
  return Array.from({ length: count }, (_, i) => {
    if (hof.length && i % HOF_SHARE === HOF_SHARE - 1) return hof[Math.floor(rng() * hof.length)][opp];
    return snapshot[opp];
  });
}

// 1つの対戦相手について、反省して案を出し、試して、効いた案を1つだけ返す
function learnMatchup(o, season, snapshot, hof, deck, opp) {
  const tag = [season, deck, opp].join('|');
  const knobs = snapshot[deck];

  const reflectOpp = opponentKnobs(o, snapshot, hof, opp, 'r|' + tag, o.reflect);
  const games = [];
  for (let i = 0; i < o.reflect; i++) {
    const first = i % 2 === 0;
    const { rec, observe } = makeRecorder(first ? 0 : 1);
    const result = C.playOne(deck, knobs, opp, reflectOpp[i], C.seedOf(o.seed, 'r', tag, i), first, observe);
    games.push({ win: result.win, found: reflectGame(result, rec) });
  }
  const { proposals, findings } = proposalsFor(deck, knobs, opp, games, C.rngOf(o.seed, 'p', tag), o.proposals);

  const testOpp = opponentKnobs(o, snapshot, hof, opp, 't|' + tag, o.test);
  const seeds = Array.from({ length: o.test }, (_, i) => C.seedOf(o.seed, 't', tag, i));
  const tried = proposals.map((p) => {
    const r = C.pairedTest(deck, knobs, p.knobs, opp, testOpp, seeds);
    return { what: C.describeProposal(p.prop), reason: p.reason, prop: p.prop, knobs: p.knobs, ...r };
  });
  const passed = tried.filter((t) => t.gain >= o.minGain && t.z >= o.minZ).sort((a, b) => b.gain - a.gain);
  return {
    deck, opp,
    winRate: games.filter((g) => g.win).length / games.length,
    findings: findings.map((f) => ({ label: f.label, lossRate: f.lossRate, winRate: f.winRate })),
    tried: tried.map(({ knobs: _k, ...t }) => t),
    accepted: passed[0] || null,
  };
}

// 同じ出力先の前回の学習結果を消す。残ると別の学習のシーズンが混ざる
function clearOutput(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (/^season-\d+\.json$/.test(f) || f === 'run.json') fs.unlinkSync(path.join(dir, f));
  }
}

function save(dir, name, data) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

function summaryLine(season, ev, accepted, sec) {
  const totals = Object.entries(ev.totals).map(([d, r]) => `${d} ${(r * 100).toFixed(1)}%`).join(' / ');
  return `シーズン${String(season).padStart(2, '0')}  採用 ${accepted}件  ${totals}  (${sec.toFixed(0)}秒)`;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  fs.mkdirSync(o.out, { recursive: true });
  clearOutput(o.out);

  let knobSet = C.defaultKnobSet();
  const t0 = Date.now();
  const baseEval = evaluate(knobSet, o.eval);
  const baseVd = versusDefault(knobSet, o.gain);
  save(o.out, 'season-00.json', { season: 0, knobs: knobSet, learned: [], eval: baseEval, versusDefault: baseVd });
  console.log(summaryLine(0, baseEval, 0, (Date.now() - t0) / 1000));

  const hof = [];
  let quiet = 0;
  let stopReason = `上限の${o.seasons}シーズンに達した`;

  for (let s = 1; s <= o.seasons; s++) {
    const start = Date.now();
    const snapshot = C.cloneKnobs(knobSet);
    const learned = [];
    for (const deck of C.DECK_NAMES) {
      for (const opp of C.DECK_NAMES) {
        if (opp === deck) continue;
        learned.push(learnMatchup(o, s, snapshot, hof, deck, opp));
      }
    }
    // 全デッキの学習をシーズン開始時点の相手で行い、最後にまとめて反映する（順番の有利を無くす）
    const next = C.cloneKnobs(snapshot);
    for (const l of learned) {
      if (!l.accepted) continue;
      next[l.deck] = C.applyProposal(l.deck, next[l.deck], l.opp, l.accepted.prop);
    }
    knobSet = next;
    hof.push(snapshot);
    if (hof.length > HOF_SIZE) hof.shift();

    const ev = evaluate(knobSet, o.eval);
    const vd = versusDefault(knobSet, o.gain);
    const acceptedCount = learned.filter((l) => l.accepted).length;
    save(o.out, `season-${String(s).padStart(2, '0')}.json`, { season: s, knobs: knobSet, learned, eval: ev, versusDefault: vd });
    console.log(summaryLine(s, ev, acceptedCount, (Date.now() - start) / 1000));
    for (const l of learned.filter((x) => x.accepted)) {
      console.log(`    ${l.deck} vs ${l.opp}: ${l.accepted.what}（+${(l.accepted.gain * 100).toFixed(1)}pt, z=${l.accepted.z.toFixed(1)}）`);
    }

    // 対戦表の変化の小ささでは止めない。1シーズンの採用は少なく、学習途中でも表はほとんど動かないため
    quiet = acceptedCount === 0 ? quiet + 1 : 0;
    if (quiet >= o.patience) { stopReason = `${o.patience}シーズン続けて採用される案が無かった`; break; }
  }

  save(o.out, 'run.json', { params: o, stopReason, minutes: (Date.now() - t0) / 60000 });
  console.log(`\n停止：${stopReason}。結果は ${o.out}`);
}

if (require.main === module) main();
