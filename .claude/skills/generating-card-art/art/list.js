// 生成対象と生成済み状況の一覧。APIは呼ばない
const { parseArgs } = require('./cli.js');
const { resolveTargets } = require('./targets.js');
const { preset, PRESETS } = require('./style.js');

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const targets = resolveTargets(opts);
  const showPrompt = opts.cards.length > 0;

  let done = 0;
  let currentDeck = null;
  for (const t of targets) {
    if (t.card.deck !== currentDeck) {
      currentDeck = t.card.deck;
      console.log(`\n# ${currentDeck}`);
    }
    if (t.exists) done++;
    const mark = t.exists ? '済' : '未';
    const note = t.defined ? '' : '  ← subjects.js に定義が無い（汎用プロンプトになる）';
    console.log(`  [${mark}] ${t.card.type.padEnd(6, '　')} ${t.card.name}${note}`);
    if (showPrompt) console.log(`\n${t.prompt}\n`);
  }
  console.log(`\n合計 ${targets.length} 枚 / 生成済み ${done} 枚 / 未生成 ${targets.length - done} 枚`);
  console.log(`絵柄 ${preset(opts.style).name}（選べるのは ${PRESETS.join(' / ')}）`);
}

main();
