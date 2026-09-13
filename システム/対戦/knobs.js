// AIの打ち方のつまみ
// p.knobs に { base: {...}, vs: { 相手デッキ名: {..., cards: {...}} }, cards: { カード名: 評価の加減 } } を渡す
// 渡さなかった値は既定値になる。既定値だけなら固定AIと同じ打ち方になる

// 既定値。デッキの style で変わるものは style ごとに持つ
const DEFAULTS = {
  mulliganKeepMax: { aggro: 3, midrange: 4, control: 4 }, // マリガンで残す最大コスト
  attackStyle: null,            // 攻撃と対象選びの方針。null ならデッキの style
  hasteValue: 3,                // 速攻を持つキャラクターの評価
  rushValue: 1,                 // 突進
  tauntValue: { aggro: 0, midrange: 2, control: 2 }, // 守護
  deathtouchValue: 2,           // 必殺
  costWeight: 0.3,              // 重いカードを先に使う寄りにする度合い
  followupWeight: 1,            // 同じターンに続けて使える札を見る度合い
  playThreshold: 0,             // この評価以下のカードは使わずにターンを終える
  powerSlack: 2.5,              // パワーを溜めてもプレイの質がこれ以上落ちないなら先に溜める
  raceMargin: 0,                // aggro：相手より何ターン遅いと盤面を捌き始めるか
  aggroBigTradeThreat: 9,       // aggro：これ以上の脅威は顔より先に倒す
  midrangeTradeThreat: 6,       // midrange：これ以上の脅威は顔より先に倒す
  midrangeFaceGuardHp: 8,       // midrange：相手HPがこれ以下なら倒すより顔
  controlFaceHp: 10,            // control：相手HPがこれ以下なら顔を殴る
  burnKillThreat: 7,            // 効果ダメージで顔より倒すことを選ぶ脅威の下限
};

// 学習で動かしてよい範囲
const SPEC = {
  mulliganKeepMax: { min: 1, max: 6, step: 1 },
  attackStyle: { choices: ['aggro', 'midrange', 'control'] },
  hasteValue: { min: 0, max: 6, step: 0.5 },
  rushValue: { min: 0, max: 4, step: 0.5 },
  tauntValue: { min: 0, max: 5, step: 0.5 },
  deathtouchValue: { min: 0, max: 5, step: 0.5 },
  costWeight: { min: 0, max: 1, step: 0.1 },
  followupWeight: { min: 0, max: 2, step: 0.25 },
  playThreshold: { min: -3, max: 3, step: 0.5 },
  powerSlack: { min: 0, max: 6, step: 0.5 },
  raceMargin: { min: -2, max: 2, step: 1 },
  aggroBigTradeThreat: { min: 5, max: 14, step: 1 },
  midrangeTradeThreat: { min: 3, max: 12, step: 1 },
  midrangeFaceGuardHp: { min: 0, max: 15, step: 1 },
  controlFaceHp: { min: 0, max: 20, step: 1 },
  burnKillThreat: { min: 3, max: 12, step: 1 },
  cardOffset: { min: -5, max: 5, step: 0.5 },
};

// 相手デッキ別 → デッキ共通 → 既定値 の順に探す
function knob(g, p, key) {
  const k = p.knobs;
  let v;
  if (k) {
    const vs = k.vs && k.vs[g.opp(p).deckName];
    if (vs && vs[key] !== undefined) v = vs[key];
    else if (k.base && k.base[key] !== undefined) v = k.base[key];
  }
  if (v === undefined) v = DEFAULTS[key];
  if (v !== null && typeof v === 'object') v = v[p.style];
  if (key === 'attackStyle' && v === null) v = p.style;
  return v;
}

// カードの評価への加減。既定は0
function cardOffset(g, p, name) {
  const k = p.knobs;
  if (!k) return 0;
  const vs = k.vs && k.vs[g.opp(p).deckName];
  if (vs && vs.cards && vs.cards[name] !== undefined) return vs.cards[name];
  if (k.cards && k.cards[name] !== undefined) return k.cards[name];
  return 0;
}

module.exports = { DEFAULTS, SPEC, knob, cardOffset };
