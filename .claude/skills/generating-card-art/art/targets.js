// 生成対象の解決と、出力先パスの決定
const fs = require('fs');
const path = require('path');
const { loadDecks, listSubjects } = require('./decks.js');
const { buildPrompt } = require('./prompt.js');
const { ASPECT, preset } = require('./style.js');

function resolveTargets(opts) {
  preset(opts.style); // 存在しないプリセット名なら、ここで止める
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
    const { prompt, defined } = buildPrompt(card, opts.style);
    // 明示指定が無ければ、枠のアート窓に合う比を種類から決める
    const aspect = opts.aspect || ASPECT[card.type] || '4:5';
    return { card, dir, image, meta: path.join(dir, `${card.name}.json`), prompt, defined, aspect, exists: fs.existsSync(image) };
  });
}

module.exports = { resolveTargets };
