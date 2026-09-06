// 和文と英文の突き合わせ。生成の前にこれを読み、ずれていたら subjects.js / style.json を直す
// APIは呼ばない
const { parseArgs } = require('./cli.js');
const { resolveTargets } = require('./targets.js');
const { buildReview } = require('./prompt.js');
const { PRESETS } = require('./style.js');

function wrap(text, width, indent) {
  const lines = [];
  for (let i = 0; i < text.length; i += width) lines.push(indent + text.slice(i, i + width));
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const targets = resolveTargets(opts);
  let undefinedCount = 0;

  for (const t of targets) {
    const r = buildReview(t.card, opts.style);
    const c = t.card;
    const stats = c.type === 'キャラクター' ? ` コスト${c.cost} ${c.atk}/${c.hp}` : c.cost ? ` コスト${c.cost}` : '';
    console.log(`\n${'='.repeat(78)}`);
    console.log(`■ ${c.deck} / ${c.name}（${c.type}・${c.className || '-'}${stats}）  絵柄 ${r.preset}`);
    if (!r.defined) { undefinedCount++; console.log('  ※ subjects.js に定義が無い。汎用プロンプトになっている'); }
    if (c.effects && c.effects.length) console.log(`  効果: ${c.effects.join(' / ')}`);

    for (const p of r.parts) {
      console.log(`\n  【${p.label}】`);
      console.log(wrap(p.jp, 60, '    和 '));
      console.log(wrap(p.en, 78, '    英 '));
    }
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log(`${targets.length} 枚を表示（絵柄は ${PRESETS.join(' / ')} から --style で選ぶ）`);
  if (undefinedCount) console.log(`※ subjects.js に定義が無いカードが ${undefinedCount} 枚ある。生成前に書く`);
  console.log('和文と英文がずれていたら subjects.js（被写体）か style.json（画風・構図・色・除外）を直す');
}

main();
