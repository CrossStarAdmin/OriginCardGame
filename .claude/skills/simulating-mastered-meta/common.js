// 熟練環境の学習と評価で共通に使う道具
const path = require('path');

const CORE = path.join(__dirname, '..', '..', '..', 'システム', '対戦');
const { DECKS, CARD_DB } = require(path.join(CORE, 'cards.js'));
const E = require(path.join(CORE, 'engine.js'));
const K = require(path.join(CORE, 'knobs.js'));
const { playGame, runMatch } = require(path.join(CORE, 'match.js'));

// 環境変数 MASTERED_DECKS（カンマ区切り）で対象デッキを絞れる。未指定なら全デッキ
const DECK_NAMES = process.env.MASTERED_DECKS
  ? process.env.MASTERED_DECKS.split(',').map((d) => {
    if (!DECKS[d]) throw new Error(`不明なデッキ: ${d}`);
    return d;
  })
  : Object.keys(DECKS);
const STYLES = K.SPEC.attackStyle.choices; // 攻めから守りの順
const EVAL_SEED_BASE = 900001;             // 評価専用。学習のシードとは混ぜない

// 並べた値から32bitのシードを作る。同じ引数なら同じシード
function seedOf(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngOf(...parts) { return E.mulberry32(seedOf(...parts)); }

function emptyKnobs() { return { base: {}, vs: {}, cards: {} }; }
function defaultKnobSet() { return Object.fromEntries(DECK_NAMES.map((d) => [d, emptyKnobs()])); }
function cloneKnobs(k) { return JSON.parse(JSON.stringify(k)); }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function round2(v) { return Math.round(v * 100) / 100; }

// 実際に使われる値。knobs.js の knob と同じく 相手デッキ別 → デッキ共通 → 既定値 の順
function effective(deck, k, opp, key) {
  const vs = k.vs[opp];
  let v = vs && vs[key] !== undefined ? vs[key] : k.base[key];
  if (v === undefined) v = K.DEFAULTS[key];
  if (v !== null && typeof v === 'object') v = v[DECKS[deck].style];
  if (key === 'attackStyle' && v === null) v = DECKS[deck].style;
  return v;
}

function effectiveCard(k, opp, name) {
  const vs = k.vs[opp];
  if (vs && vs.cards && vs.cards[name] !== undefined) return vs.cards[name];
  return k.cards[name] !== undefined ? k.cards[name] : 0;
}

// 直す案を1つ当てた新しいつまみを返す。学習は相手デッキ別の範囲にだけ書く
function applyProposal(deck, k, opp, prop) {
  const out = cloneKnobs(k);
  const vs = out.vs[opp] || (out.vs[opp] = {});
  if (prop.card) {
    const spec = K.SPEC.cardOffset;
    vs.cards = vs.cards || {};
    vs.cards[prop.card] = clamp(round2(effectiveCard(k, opp, prop.card) + prop.delta), spec.min, spec.max);
  } else if (prop.key === 'attackStyle') {
    const i = STYLES.indexOf(effective(deck, k, opp, 'attackStyle'));
    vs.attackStyle = STYLES[clamp(i + prop.dir, 0, STYLES.length - 1)];
  } else {
    const spec = K.SPEC[prop.key];
    vs[prop.key] = clamp(round2(effective(deck, k, opp, prop.key) + prop.delta), spec.min, spec.max);
  }
  return out;
}

function describeProposal(prop) {
  if (prop.card) return `「${prop.card}」の評価 ${prop.delta > 0 ? '+' : ''}${prop.delta}`;
  if (prop.key === 'attackStyle') return `攻め方を${prop.dir < 0 ? '攻め' : '守り'}寄りに`;
  return `${prop.key} ${prop.delta > 0 ? '+' : ''}${prop.delta}`;
}

// deck を knobs の打ち方で1戦。first なら deck が先攻
function playOne(deck, knobs, opp, oppKnobs, seed, first, observe) {
  const stats = {};
  const g = first
    ? playGame(deck, opp, seed, stats, 0, [knobs, oppKnobs], observe)
    : playGame(opp, deck, seed, stats, 0, [oppKnobs, knobs], observe);
  const seat = first ? 0 : 1;
  return { g, seat, win: g.winner === seat };
}

// 同じシード・同じ相手で2つの打ち方を戦わせる
// z は勝敗が分かれた試合だけで見た差の大きさ（同じ展開の試合は差に数えない）
function pairedTest(deck, kA, kB, opp, oppKnobsList, seeds) {
  let winsA = 0, winsB = 0, onlyA = 0, onlyB = 0;
  seeds.forEach((seed, i) => {
    const first = i % 2 === 0;
    const a = playOne(deck, kA, opp, oppKnobsList[i], seed, first).win;
    const b = playOne(deck, kB, opp, oppKnobsList[i], seed, first).win;
    if (a) winsA++;
    if (b) winsB++;
    if (a && !b) onlyA++;
    if (b && !a) onlyB++;
  });
  const n = seeds.length;
  return {
    rateA: winsA / n,
    rateB: winsB / n,
    gain: (winsB - winsA) / n,
    z: (onlyB - onlyA) / Math.sqrt(Math.max(1, onlyA + onlyB)),
  };
}

function pairsOf(names) {
  const out = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) out.push([names[i], names[j]]);
  }
  return out;
}

module.exports = {
  CORE, DECKS, CARD_DB, E, K, DECK_NAMES, STYLES, EVAL_SEED_BASE,
  playGame, runMatch, seedOf, rngOf,
  emptyKnobs, defaultKnobSet, cloneKnobs, effective, effectiveCard,
  applyProposal, describeProposal, playOne, pairedTest, pairsOf,
};
