// 送るプロンプトを区画ごとに表示する。APIは呼ばない
// プロンプトは日本語のまま表示する（送る直前に英訳される）
const CORE = require('path').join(__dirname, '..', '..', '..', '..', 'システム');
const { parseArgs } = require('./cli.js');
const { resolveTargets } = require('./targets.js');
const { buildReview } = require(CORE + '/カード絵/prompt.js');
const { styleNames } = require(CORE + '/カード絵/artrules.js');

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
    console.log(`■ ${c.deck} / ${c.name}（${c.type}・${c.className || '-'}${stats}）  絵柄 ${r.preset}  縦横比 ${t.aspect}`);
    if (!r.defined) { undefinedCount++; console.log('  ※ カードmdの 外見／情景 が空。絵の指定を書く'); }
    if (c.effects && c.effects.length) console.log(`  効果: ${c.effects.join(' / ')}`);

    for (const p of r.parts) {
      console.log(`\n  【${p.label}】`);
      console.log(wrap(p.text, 60, '    '));
    }
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log(`${targets.length} 枚を表示（絵柄は ${styleNames().join(' / ')} から --style で選ぶ）`);
  if (undefinedCount) console.log(`※ 絵の指定が空のカードが ${undefinedCount} 枚ある。生成前に書く`);
  console.log('直す場所: 全カード共通=イラスト/共通ルール.md / デッキ=overview.md の見た目のルール / 1枚=カード一覧の該当md');
}

main();
