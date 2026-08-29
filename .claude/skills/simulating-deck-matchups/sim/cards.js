// カード定義とデッキリスト（デッキ/*.md より）

const CARD_DB = {
  // ---- 共通 ----
  'モーモン':       { kind: 'unit', cost: 1, atk: 2, hp: 2 },
  'メラゴースト':   { kind: 'unit', cost: 1, atk: 1, hp: 1 },

  // ---- アグロゼシカ（魔法使い）----
  'ベビーマジシャン': { kind: 'unit', cost: 1, atk: 1, hp: 2 },
  'メラ':           { kind: 'spell', cost: 1, dmg: 1 },
  'メラミ':         { kind: 'spell', cost: 2, dmg: 3 },
  'まほうつかい':   { kind: 'unit', cost: 2, atk: 2, hp: 3 },
  'ヒートギズモ':   { kind: 'unit', cost: 2, atk: 3, hp: 2, kw: ['突進'] },
  'マージマタンゴ': { kind: 'unit', cost: 3, atk: 3, hp: 3 },
  'テンツク':       { kind: 'unit', cost: 3, atk: 2, hp: 4 },
  'マルク':         { kind: 'unit', cost: 2, atk: 1, hp: 3, kw: ['守護'] },
  'ポルク':         { kind: 'unit', cost: 2, atk: 3, hp: 2, kw: ['突進'] },
  'メラゾーマ':     { kind: 'spell', cost: 4, dmg: 5 },
  'サーベルト':     { kind: 'unit', cost: 5, atk: 5, hp: 3, kw: ['速攻'] },
  'ベルゼバブ':     { kind: 'unit', cost: 6, atk: 5, hp: 5 },

  // ---- ミッドレンジ奇数エルナ（占い師）----
  'サキュバス':     { kind: 'unit', cost: 1, atk: 2, hp: 1 },
  'アルカナショット': { kind: 'spell', cost: 1, dmg: 1 },
  'インキュバス':   { kind: 'unit', cost: 3, atk: 3, hp: 3 },
  'オーリン':       { kind: 'unit', cost: 3, atk: 2, hp: 3, kw: ['守護'] },
  'マーニャ':       { kind: 'unit', cost: 3, atk: 3, hp: 3 },
  'バルザック':     { kind: 'unit', cost: 4, atk: 4, hp: 4 },
  'アルカナバースト': { kind: 'spell', cost: 4, dmg: 2 },
  'エドガン':       { kind: 'unit', cost: 5, atk: 2, hp: 2 },
  'しりょうのきし': { kind: 'unit', cost: 5, atk: 4, hp: 5, kw: ['守護'] },
  'わかめ王子':     { kind: 'unit', cost: 6, atk: 5, hp: 5, kw: ['突進'] },
  'バルザック＋':   { kind: 'unit', cost: 7, atk: 8, hp: 6 },
  'キングレオ':     { kind: 'unit', cost: 8, atk: 5, hp: 5 },

  // ---- コントロールククール（僧侶）----
  'ホイミスライム': { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  'いのりのゆびわ': { kind: 'spell', cost: 1 },
  'ザオ':           { kind: 'spell', cost: 1 },
  'さまようたましい': { kind: 'unit', cost: 2, atk: 2, hp: 3, kw: ['守護'] },
  'てつのさそり':   { kind: 'unit', cost: 2, atk: 1, hp: 3 },
  'イザヤール':     { kind: 'unit', cost: 3, atk: 2, hp: 2, kw: ['守護'], tag: '冒険者' },
  'ようせいの笛':   { kind: 'spell', cost: 3 },
  'リトルライバーン': { kind: 'unit', cost: 4, atk: 3, hp: 5 },
  'クリフト':       { kind: 'unit', cost: 5, atk: 2, hp: 4, tag: '冒険者' },
  'ラヴィエル':     { kind: 'unit', cost: 5, atk: 3, hp: 4, tag: '冒険者' },
  'プリン':         { kind: 'unit', cost: 5, atk: 1, hp: 2, tag: '冒険者' },
  'メガザル':       { kind: 'spell', cost: 6 },
  'マルチェロ':     { kind: 'unit', cost: 7, atk: 4, hp: 4, kw: ['守護'], tag: '冒険者' },
  'レティス':       { kind: 'unit', cost: 10, atk: 7, hp: 7, kw: ['守護'], tag: '冒険者' },
};

const DECKS = {
  'アグロゼシカ': {
    style: 'aggro',
    leader: 'ゼシカ',
    list: {
      'モーモン': 3, 'メラゴースト': 3, 'ベビーマジシャン': 3, 'メラ': 3,
      'メラミ': 3, 'まほうつかい': 3, 'ヒートギズモ': 3, 'マージマタンゴ': 3,
      'テンツク': 3, 'マルク': 3, 'ポルク': 3, 'メラゾーマ': 3,
      'サーベルト': 2, 'ベルゼバブ': 2,
    },
  },
  'ミッドレンジ奇数エルナ': {
    style: 'midrange',
    leader: 'エルナ',
    list: {
      'モーモン': 3, 'サキュバス': 3, 'メラゴースト': 3, 'アルカナショット': 3,
      'インキュバス': 3, 'オーリン': 3, 'マーニャ': 3, 'バルザック': 3,
      'アルカナバースト': 3, 'エドガン': 3, 'しりょうのきし': 3, 'わかめ王子': 2,
      'バルザック＋': 3, 'キングレオ': 2,
    },
  },
  'コントロールククール': {
    style: 'control',
    leader: 'ククール',
    list: {
      'ホイミスライム': 3, 'いのりのゆびわ': 3, 'ザオ': 2, 'さまようたましい': 3,
      'てつのさそり': 3, 'イザヤール': 3, 'ようせいの笛': 3, 'リトルライバーン': 3,
      'クリフト': 3, 'ラヴィエル': 3, 'プリン': 3, 'メガザル': 2,
      'マルチェロ': 3, 'レティス': 3,
    },
  },
};

function buildDeck(deckName) {
  const out = [];
  for (const [name, n] of Object.entries(DECKS[deckName].list)) {
    for (let i = 0; i < n; i++) out.push(name);
  }
  return out;
}

module.exports = { CARD_DB, DECKS, buildDeck };
