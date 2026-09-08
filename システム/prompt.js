// カードmdと共通ルールから、日本語のプロンプトを組み立てる
// 送る直前に translate.js が英訳する。英文はここでは作らない
const RULES = require('./artrules.js');

// 画面の使い方と除外は前に置く。末尾だと文字や縁取りが描き込まれる事故が起きる
function sections(card, styleName) {
  const style = RULES.style(styleName);
  const look = card.look || {};
  const parts = [
    { label: '絵柄', text: style.text },
    { label: '画面の使い方', text: RULES.canvas() },
    { label: '描かせないもの', text: RULES.exclusions() },
    { label: '外見', text: look.外見 },
    { label: '情景', text: look.情景 },
    { label: '背景', text: look.背景 },
    { label: 'デッキ共通の見た目', text: (card.lookRules || []).join(' ') },
    { label: '構図', text: RULES.composition(card.type) },
  ];
  return { styleName: style.name, parts: parts.filter((p) => p.text) };
}

function buildPrompt(card, styleName) {
  const { styleName: preset, parts } = sections(card, styleName);
  return {
    promptJa: parts.map((p) => `【${p.label}】${p.text}`).join('\n'),
    // 外見も情景も空なら、絵の指定が書かれていない
    defined: Boolean(card.look && (card.look.外見 || card.look.情景)),
    preset,
  };
}

// 人が読んで確認するための区画分け
function buildReview(card, styleName) {
  const { styleName: preset, parts } = sections(card, styleName);
  return { preset, defined: Boolean(card.look && (card.look.外見 || card.look.情景)), parts };
}

module.exports = { buildPrompt, buildReview };
