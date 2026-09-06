// カード情報と style.json からプロンプトを組み立てる
// buildPrompt が実際に送る英文、buildReview が確認用の和文と英文の対
const S = require('./style.js');
const { CHARACTERS, SUBJECTS } = require('./subjects.js');

// subjects.js に定義が無いカードでも、名前と効果から最低限の被写体を作る
function fallbackSubject(card) {
  const effects = (card.effects || []).join(' / ');
  const base = card.type === 'スペル'
    ? `a magical effect from a fantasy card named "${card.name}"`
    : `a single fantasy character from a card named "${card.name}"`;
  return {
    en: effects ? `${base}, whose effect is: ${effects}` : base,
    jp: `（subjects.js に定義が無い）カード名「${card.name}」${effects ? `と効果「${effects}」` : ''}から機械的に作った被写体`,
  };
}

function resolveSubject(card) {
  const entry = SUBJECTS[card.name];
  if (!entry) return { ...fallbackSubject(card), defined: false };

  let look = null;
  if (entry.character) {
    look = CHARACTERS[entry.character];
    if (!look) throw new Error(`subjects.js: 「${card.name}」が参照する人物「${entry.character}」が CHARACTERS に無い`);
  }
  return {
    en: look ? `${look.en}. ${entry.en}` : entry.en,
    jp: look ? `${look.jp}。${entry.jp}` : entry.jp,
    defined: true,
  };
}

// 5つの区画に分けて組み立てる。区画は前ほど個別、後ろほど全カード共通
function sections(card, presetName) {
  const subject = resolveSubject(card);
  const style = S.preset(presetName);
  const composition = S.COMPOSITION[card.type] || S.COMPOSITION['キャラクター'];
  const tone = S.CLASS_TONE[card.className];

  return {
    preset: style.name,
    defined: subject.defined,
    parts: [
      { label: '被写体', prefix: 'Subject', en: subject.en, jp: subject.jp },
      { label: '構図', prefix: 'Composition', en: `${S.en(composition)}, ${S.en(S.FRAME_SAFE)}`, jp: `${S.jp(composition)}。${S.jp(S.FRAME_SAFE)}` },
      { label: '色と舞台', prefix: 'Setting and palette', en: [S.en(tone), S.en(style.lighting)].filter(Boolean).join('. '), jp: [S.jp(tone), S.jp(style.lighting)].filter(Boolean).join('。') },
      { label: '画風', prefix: 'Style', en: S.en(style.base), jp: S.jp(style.base) },
      { label: '除外', prefix: 'Strict exclusions', en: S.en(S.EXCLUSIONS), jp: S.jp(S.EXCLUSIONS) },
    ],
  };
}

function buildPrompt(card, presetName) {
  const s = sections(card, presetName);
  return {
    prompt: s.parts.map((p) => `${p.prefix}: ${p.en}.`).join('\n'),
    defined: s.defined,
    preset: s.preset,
  };
}

function buildReview(card, presetName) {
  return sections(card, presetName);
}

module.exports = { buildPrompt, buildReview, resolveSubject };
