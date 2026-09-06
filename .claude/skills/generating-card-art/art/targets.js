// 生成対象の解決と、出力先パスの決定
const fs = require('fs');
const path = require('path');
const { loadDecks, listSubjects } = require('./decks.js');
const { buildPrompt } = require('./prompt.js');

// カード枠のアート窓の比から決めた生成比（カードフレーム/frame.json）
// 枠を差し替えたら測り直す
const ASPECT = { 'リーダー': '4:5', 'キャラクター': '4:5', 'スペル': '4:5', '武器': '4:5' };

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
    const aspect = opts.aspect || ASPECT[card.type] || '4:5';
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

module.exports = { resolveTargets, ASPECT };
