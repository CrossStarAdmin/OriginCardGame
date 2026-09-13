// 学習結果をまとめて出す
// 使い方: node report.js <学習フォルダ> [再現確認に使う2つ目の学習フォルダ]
const fs = require('fs');
const path = require('path');
const C = require('./common.js');

function loadRun(dir) {
  const seasons = fs.readdirSync(dir)
    .filter((f) => /^season-\d+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const runFile = path.join(dir, 'run.json');
  const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, 'utf8')) : null;
  return { dir, run, seasons };
}

const pct = (x) => (x * 100).toFixed(1) + '%';
const pt = (x) => (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + 'pt';

function printRun({ dir, run, seasons }) {
  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  console.log(`# 学習結果 ${dir}`);
  if (run) {
    const p = run.params;
    console.log(`条件：seed ${p.seed} / 反省 ${p.reflect}戦 / 試す ${p.test}戦×${p.proposals}案 / 評価 ${p.eval}戦 / 採用基準 +${p.minGain * 100}pt かつ z≥${p.minZ}`);
    console.log(`停止：${run.stopReason}（${run.minutes.toFixed(0)}分）`);
  } else {
    console.log('停止：まだ学習中か、途中で止まった（run.json が無い）');
  }

  console.log('\n## シーズンごとの総合勝率');
  console.log(['シーズン', '採用', ...C.DECK_NAMES].join(' | '));
  for (const s of seasons) {
    const accepted = s.learned.filter((l) => l.accepted).length;
    console.log([s.season, accepted, ...C.DECK_NAMES.map((d) => pct(s.eval.totals[d]))].join(' | '));
  }

  console.log('\n## 対戦表（学習前 → 最終）');
  last.eval.matrix.forEach((m, i) => {
    const b = first.eval.matrix[i];
    console.log(`  ${m.a} vs ${m.b}: ${pct(b.aRate)} → ${pct(m.aRate)}（${pt(m.aRate - b.aRate)}）  最終の先攻 ${pct(m.aFirst)} / 後攻 ${pct(m.aSecond)}`);
  });

  console.log('\n## 上達幅（既定の打ち方の相手への平均勝率：学習前 → 最終）');
  for (const d of C.DECK_NAMES) {
    console.log(`  ${d}: ${pct(first.versusDefault[d])} → ${pct(last.versusDefault[d])}（${pt(last.versusDefault[d] - first.versusDefault[d])}）`);
  }

  console.log('\n## 各デッキが覚えた打ち方（既定値からの変化）');
  const empty = C.emptyKnobs();
  for (const d of C.DECK_NAMES) {
    const k = last.knobs[d];
    const lines = [];
    for (const [opp, vs] of Object.entries(k.vs || {})) {
      for (const [key, v] of Object.entries(vs)) {
        if (key === 'cards') {
          for (const [card, off] of Object.entries(v)) lines.push(`vs ${opp}：「${card}」の評価 ${off > 0 ? '+' : ''}${off}`);
        } else {
          lines.push(`vs ${opp}：${key} ${C.effective(d, empty, opp, key)} → ${v}`);
        }
      }
    }
    console.log(`  ${d}`);
    if (!lines.length) console.log('    （変化なし）');
    for (const l of lines) console.log(`    ${l}`);
  }

  console.log('\n## 採用された案の履歴');
  for (const s of seasons.slice(1)) {
    for (const l of s.learned.filter((x) => x.accepted)) {
      console.log(`  S${s.season} ${l.deck} vs ${l.opp}: ${l.accepted.what}（${pt(l.accepted.gain)}, z=${l.accepted.z.toFixed(1)}）— ${l.accepted.reason}`);
    }
  }

  console.log('\n## 最終のエースカード（上位5枚：貢献度 / 使用率 / 勝率差）');
  for (const [d, list] of Object.entries(last.eval.aces)) {
    console.log(`  ${d}`);
    for (const c of list.slice(0, 5)) {
      console.log(`    ${c.name} ${c.contrib.toFixed(2)} / ${(c.use * 100).toFixed(0)}% / ${c.delta >= 0 ? '+' : ''}${(c.delta * 100).toFixed(1)}`);
    }
  }
  return last;
}

function main() {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('学習フォルダを指定する。例: node report.js .claude/skills/simulating-mastered-meta/out/seed-1');
    process.exit(1);
  }
  const lasts = dirs.map((dir) => printRun(loadRun(dir)));
  if (lasts.length >= 2) {
    console.log('\n## 再現確認（2つの学習の最終対戦表の差）');
    let worst = 0;
    lasts[0].eval.matrix.forEach((m, i) => {
      const d = Math.abs(m.aRate - lasts[1].eval.matrix[i].aRate);
      worst = Math.max(worst, d);
      console.log(`  ${m.a} vs ${m.b}: ${pct(m.aRate)} / ${pct(lasts[1].eval.matrix[i].aRate)}（差 ${(d * 100).toFixed(1)}pt）`);
    });
    console.log(`  最大の差 ${(worst * 100).toFixed(1)}pt ${worst <= 0.03 ? '→ ±3pt以内。結論は再現した' : '→ ±3ptを超えた。学習の戦数を増やすか、シーズンを延ばす'}`);
  }
}

if (require.main === module) main();
