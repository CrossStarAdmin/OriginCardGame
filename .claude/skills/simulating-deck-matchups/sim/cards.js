// カード定義とデッキリスト（デッキ/*.md より）

const CARD_DB = {
  // ---- アグロリーゼ（焔術士）----
  '学舎の見習い':   { kind: 'unit', cost: 1, atk: 1, hp: 2 },
  '火の子':         { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  '火の粉':         { kind: 'spell', cost: 1, dmg: 1 },
  'マルカ':         { kind: 'unit', cost: 2, atk: 1, hp: 3, kw: ['守護'] },
  'ポルカ':         { kind: 'unit', cost: 2, atk: 3, hp: 1 },
  'ギズモ':         { kind: 'unit', cost: 3, atk: 2, hp: 2, kw: ['速攻'] },
  '焔弾':           { kind: 'spell', cost: 2, dmg: 3 },
  '教授ハルド':     { kind: 'unit', cost: 3, atk: 3, hp: 4 },
  '火口の洞守り':   { kind: 'unit', cost: 3, atk: 3, hp: 3 },
  '焼き払い':       { kind: 'spell', cost: 3 },
  'ドロテ':         { kind: 'unit', cost: 4, atk: 4, hp: 4, kw: ['守護'] },
  'ヴェルド':       { kind: 'unit', cost: 5, atk: 5, hp: 2, kw: ['速攻'] },
  '消えぬ焔':       { kind: 'spell', cost: 5 },
  '師ベルゼ':       { kind: 'unit', cost: 6, atk: 3, hp: 6, kw: ['突進'] },

  // ---- ミッドレンジ奇数エルナ（星詠み）----
  'オルレアの民':   { kind: 'unit', cost: 1, atk: 1, hp: 2 },
  '使い魔サキュ':   { kind: 'unit', cost: 1, atk: 2, hp: 1 },
  '凶兆のまたたき': { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  '先を読む力':     { kind: 'spell', cost: 1, dmg: 1 },
  '夜番の観測者':   { kind: 'unit', cost: 3, atk: 3, hp: 3 },
  '守り役オルド':   { kind: 'unit', cost: 3, atk: 2, hp: 4, kw: ['守護'] },
  '姉マイア':       { kind: 'unit', cost: 3, atk: 2, hp: 4 },
  '相棒ヴァルザ':   { kind: 'unit', cost: 4, atk: 4, hp: 4 },
  '深読み':         { kind: 'spell', cost: 4, dmg: 2 },
  '写し手ヨナ':     { kind: 'unit', cost: 5, atk: 2, hp: 2 },
  '天文台の護り':   { kind: 'unit', cost: 5, atk: 4, hp: 5, kw: ['守護'] },
  '双子の星占いエマ&エリ': { kind: 'unit', cost: 6, atk: 5, hp: 5, kw: ['突進'] },
  '識りすぎたヴァルザ': { kind: 'unit', cost: 7, atk: 8, hp: 6 },
  '傲慢のノクス':   { kind: 'unit', cost: 8, atk: 5, hp: 5 },

  // ---- コントロールアルベル（司祭）----
  '癒しの人形ホミ': { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  '小さな手当て':   { kind: 'spell', cost: 1 },
  '間に合わせの蘇生': { kind: 'spell', cost: 1 },
  '傷ついた巡礼者': { kind: 'unit', cost: 2, atk: 2, hp: 3, kw: ['守護'] },
  '長屋の病人':     { kind: 'unit', cost: 2, atk: 1, hp: 3 },
  '修道女キーラ':   { kind: 'unit', cost: 3, atk: 2, hp: 2, kw: ['守護'], tag: '聖徒' },
  '記録を繰る':     { kind: 'spell', cost: 3 },
  '聖獣キメラ':     { kind: 'unit', cost: 4, atk: 3, hp: 5 },
  '聖騎士ザキエル': { kind: 'unit', cost: 5, atk: 2, hp: 4, tag: '聖徒' },
  '老司祭ドラン':   { kind: 'unit', cost: 5, atk: 3, hp: 4, tag: '聖徒' },
  '祈る巡礼者':     { kind: 'unit', cost: 5, atk: 2, hp: 4, tag: '聖徒' },
  '継ぐ者の儀':     { kind: 'spell', cost: 6 },
  '偽善のミゼリア': { kind: 'unit', cost: 7, atk: 4, hp: 4, kw: ['守護'] },
  '継承の大鐘':     { kind: 'unit', cost: 10, atk: 7, hp: 7, kw: ['守護'] },
};

const DECKS = {
  'アグロリーゼ': {
    style: 'aggro',
    leader: 'リーゼ',
    list: {
      '学舎の見習い': 3, '火の子': 3, '火の粉': 3, 'マルカ': 3,
      'ポルカ': 3, 'ギズモ': 3, '焔弾': 3, '教授ハルド': 3,
      '火口の洞守り': 3, '焼き払い': 3, 'ドロテ': 3, 'ヴェルド': 2,
      '消えぬ焔': 3, '師ベルゼ': 2,
    },
  },
  'ミッドレンジ奇数エルナ': {
    style: 'midrange',
    leader: 'エルナ',
    list: {
      'オルレアの民': 3, '使い魔サキュ': 3, '凶兆のまたたき': 3, '先を読む力': 3,
      '夜番の観測者': 3, '守り役オルド': 3, '姉マイア': 3, '相棒ヴァルザ': 3,
      '深読み': 3, '写し手ヨナ': 3, '天文台の護り': 3, '双子の星占いエマ&エリ': 2,
      '識りすぎたヴァルザ': 3, '傲慢のノクス': 2,
    },
  },
  'コントロールアルベル': {
    style: 'control',
    leader: 'アルベル',
    list: {
      '癒しの人形ホミ': 3, '小さな手当て': 3, '間に合わせの蘇生': 2, '傷ついた巡礼者': 3,
      '長屋の病人': 3, '修道女キーラ': 3, '記録を繰る': 3, '聖獣キメラ': 3,
      '聖騎士ザキエル': 3, '老司祭ドラン': 3, '祈る巡礼者': 3, '継ぐ者の儀': 2,
      '偽善のミゼリア': 3, '継承の大鐘': 3,
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
