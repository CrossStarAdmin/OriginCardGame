// 生成対象と生成済み状況の一覧。APIは呼ばない
const { parseArgs } = require('./cli.js');
const { resolveTargets } = require('./targets.js');
const { styleNames } = require('./artrules.js');

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
    const note = t.defined ? '' : '  ← カードmdの 外見／情景 が空';
    console.log(`  [${mark}] ${t.card.type.padEnd(6, '　')} ${t.card.name}${note}`);
    if (showPrompt) console.log(`\n${t.promptJa || t.prompt}\n`);
  }
  console.log(`\n合計 ${targets.length} 枚 / 生成済み ${done} 枚 / 未生成 ${targets.length - done} 枚`);
  console.log(`絵柄は ${styleNames().join(' / ')} から --style で選ぶ`);
}

main();
