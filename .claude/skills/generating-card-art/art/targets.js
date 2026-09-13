// 生成対象の解決と、出力先パスの決定
const fs = require('fs');
const path = require('path');

const CORE = path.join(__dirname, '..', '..', '..', '..', 'システム');
const { loadDecks, listSubjects } = require(path.join(CORE, 'デッキ読み込み', 'decks.js'));
const { buildPrompt } = require(path.join(CORE, 'カード絵', 'prompt.js'));
const { aspectOf } = require(path.join(CORE, 'カード絵', 'frame.js'));

function resolveTargets(opts) {
  const decks = loadDecks(opts.decks);
  let cards = listSubjects(decks, { includeLeader: opts.includeLeader });

  if (opts.cards.length) {
    const missing = opts.cards.filter((n) => !cards.some((c) => c.name === n));
    if (missing.length) throw new Error(`カードが見つからない: ${missing.join(', ')}`);
    cards = cards.filter((c) => opts.cards.includes(c.name));
  }

  return cards.map((card) => {
    const dir = path.join(process.cwd(), opts.out, card.deck);
    const image = path.join(dir, `${card.name}.png`);
    const built = buildPrompt(card, opts.style);
    const aspect = opts.aspect || aspectOf(card.type);
    return {
      card,
      dir,
      image,
      meta: path.join(dir, `${card.name}.json`),
      promptJa: built.promptJa,
      defined: built.defined,
      preset: built.preset,
      aspect,
      exists: fs.existsSync(image),
    };
  });
}

module.exports = { resolveTargets };
