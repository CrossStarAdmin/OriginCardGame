// カード定義とデッキリスト（デッキ/*/カード一覧/*.md より）

const CARD_DB = {
  // ---- アグロリーゼ（ウィザード）----
  '学舎の見習い':   { kind: 'unit', cost: 1, atk: 1, hp: 2 },
  '火の子':         { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  '火の粉':         { kind: 'spell', cost: 1, dmg: 1 },
  'マルカ':         { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  'ポルカ':         { kind: 'unit', cost: 2, atk: 3, hp: 1, kw: ['突進'] },
  'ギズモ':         { kind: 'unit', cost: 3, atk: 2, hp: 2, kw: ['速攻'] },
  '焔弾':           { kind: 'spell', cost: 2, dmg: 3 },
  '教授ハルド':     { kind: 'unit', cost: 3, atk: 3, hp: 4 },
  '火口の洞守り':   { kind: 'unit', cost: 3, atk: 3, hp: 3, kw: ['守護'] },
  '焼き払い':       { kind: 'spell', cost: 4 },
  'ドロテ':         { kind: 'unit', cost: 4, atk: 3, hp: 5, kw: ['必殺'] },
  'ヴェルド':       { kind: 'unit', cost: 5, atk: 5, hp: 2, kw: ['速攻'] },
  '消えぬ焔':       { kind: 'spell', cost: 5 },
  '師ベルゼ':       { kind: 'unit', cost: 6, atk: 3, hp: 6, kw: ['突進'] },

  // ---- ミッドレンジ奇数エルナ（ウィザード）----
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
  '識りすぎたヴァルザ':    { kind: 'unit', cost: 7, atk: 8, hp: 6 },
  '傲慢のノクス':   { kind: 'unit', cost: 8, atk: 5, hp: 5 },

  // ---- コントロールアルベル（プリースト）----
  '癒しの人形':     { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  '小さな手当て':   { kind: 'spell', cost: 1 },
  '禁術・蘇生':     { kind: 'spell', cost: 1 },
  '傷ついた巡礼者': { kind: 'unit', cost: 2, atk: 2, hp: 3, kw: ['守護'] },
  '長屋の病人':     { kind: 'unit', cost: 2, atk: 1, hp: 3 },
  '怪我をした修道女キーラ': { kind: 'unit', cost: 3, atk: 2, hp: 2, kw: ['守護'], tag: '聖徒' },
  '謎の日記':     { kind: 'spell', cost: 3 },
  '聖獣キメラ':     { kind: 'unit', cost: 4, atk: 2, hp: 5, kw: ['守護'] },
  '聖騎士ザキエル': { kind: 'unit', cost: 5, atk: 2, hp: 4, tag: '聖徒' },
  '老司祭ドラン':   { kind: 'unit', cost: 5, atk: 3, hp: 4, tag: '聖徒' },
  '怒れる聖職者アン': { kind: 'unit', cost: 5, atk: 2, hp: 4, tag: '聖徒' },
  '死のパレード':   { kind: 'spell', cost: 6 },
  '偽善のミゼリア': { kind: 'unit', cost: 7, atk: 4, hp: 4, kw: ['守護'] },
  '聖鳥リフルエル': { kind: 'unit', cost: 10, atk: 7, hp: 7, kw: ['守護'] },

  // ---- ランプヴァルカス（デーモン）----
  // 対象耐性：相手の効果の対象にならない（全体効果は受ける）
  '無様な魔物':     { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  '貪りの供物':     { kind: 'spell', cost: 2 },
  '檻の番人':       { kind: 'unit', cost: 2, atk: 1, hp: 3, kw: ['守護', '対象耐性'] },
  '魔王の復活':     { kind: 'spell', cost: 2 },
  '玉座の使い魔':   { kind: 'unit', cost: 2, atk: 2, hp: 2 },
  '眷属':           { kind: 'unit', cost: 2, atk: 2, hp: 1, kw: ['突進'] },
  '記憶喰らい':     { kind: 'unit', cost: 3, atk: 2, hp: 4 },
  '魔軍のヴェイン': { kind: 'unit', cost: 4, atk: 5, hp: 2, kw: ['突進', '必殺'] },
  '霊脈喰らい':     { kind: 'unit', cost: 5, atk: 4, hp: 4 },
  '六罪 ヴェルド':  { kind: 'unit', cost: 7, atk: 4, hp: 3, kw: ['速攻'] },
  '王の一瞥':       { kind: 'spell', cost: 8 },
  '六罪 ミゼリア':  { kind: 'unit', cost: 9, atk: 3, hp: 5, kw: ['守護'] },
  '六罪 ノクス':    { kind: 'unit', cost: 9, atk: 7, hp: 7 },
  '魔王ヴァルカス': { kind: 'unit', cost: 10, atk: 8, hp: 8, kw: ['速攻', '守護', '必殺'] },

  // ---- アグロトバル（プリースト）----
  // token：デッキの外から加わるカード。使っても捨てても墓地へ置かず消える
  '市場の荷運び':   { kind: 'unit', cost: 1, atk: 2, hp: 2 },
  '市場の売り子':   { kind: 'unit', cost: 1, atk: 2, hp: 1 },
  '薬草の仕入れ':   { kind: 'spell', cost: 1 },
  '隊商の用心棒':   { kind: 'unit', cost: 2, atk: 2, hp: 2 },
  '空籠の行商人':   { kind: 'unit', cost: 2, atk: 1, hp: 4 },
  '結晶の粉':       { kind: 'spell', cost: 2 },
  '護衛バルド':     { kind: 'unit', cost: 3, atk: 3, hp: 3 },
  '捨て値の毒':     { kind: 'spell', cost: 3 },
  '運び屋ゴルダ':   { kind: 'unit', cost: 4, atk: 4, hp: 5 },
  '隊商の頭':       { kind: 'unit', cost: 4, atk: 3, hp: 3, kw: ['貫通'] },
  '強欲のネフィス': { kind: 'unit', cost: 5, atk: 5, hp: 6 },
  '早馬の隊商':     { kind: 'unit', cost: 5, atk: 2, hp: 2 },
  '弟子ザイル':     { kind: 'unit', cost: 6, atk: 4, hp: 4, kw: ['貫通'] },
  '毒入りの霊薬':   { kind: 'spell', cost: 7 },
  '薬草':           { kind: 'spell', cost: 0, token: true },

  // ---- コンボシュリ（ウォーリア）----
  'ガンザの門下生': { kind: 'unit', cost: 1, atk: 1, hp: 1, kw: ['守護'] },
  '朝駆け':         { kind: 'spell', cost: 1 },
  '牽制の拳':       { kind: 'spell', cost: 1 },
  '弟弟子カイ':     { kind: 'unit', cost: 1, atk: 1, hp: 1 },
  '組み手の兄弟子': { kind: 'unit', cost: 2, atk: 2, hp: 3 },
  '掌打':           { kind: 'spell', cost: 2 },
  '息を整える':     { kind: 'spell', cost: 2 },
  '岩窟の見張り':   { kind: 'unit', cost: 3, atk: 1, hp: 4 },
  '型の写本':       { kind: 'spell', cost: 3 },
  '拳で届かせる':   { kind: 'spell', cost: 3 },
  '老師ロウ':       { kind: 'unit', cost: 4, atk: 1, hp: 2, kw: ['守護'] },
  '旋風脚':         { kind: 'spell', cost: 4 },
  '妹リン':         { kind: 'unit', cost: 5, atk: 7, hp: 7, kw: ['速攻'] },
  '渇望のガドル':   { kind: 'unit', cost: 6, atk: 4, hp: 9, kw: ['守護'] },

  // ---- ミッドレンジヴェイン（デーモン）----
  // 武器：atk は攻撃力、dur は耐久力
  'さまよう魂':     { kind: 'unit', cost: 1, atk: 1, hp: 2 },
  '魔軍の小鬼':     { kind: 'unit', cost: 1, atk: 1, hp: 2 },
  '魔軍の剣兵':     { kind: 'unit', cost: 2, atk: 2, hp: 3 },
  '気まぐれの一太刀': { kind: 'spell', cost: 2 },
  '罪の影':         { kind: 'unit', cost: 2, atk: 2, hp: 2 },
  '呪剣ノア':       { kind: 'weapon', cost: 3, atk: 2, dur: 3 },
  '魔軍の伝令':     { kind: 'unit', cost: 3, atk: 3, hp: 3 },
  '逢瀬の記憶':     { kind: 'spell', cost: 3 },
  '黒いヴェイン':   { kind: 'unit', cost: 4, atk: 4, hp: 4 },
  '皆殺しの命令':   { kind: 'spell', cost: 4 },
  '魔軍一の剣':     { kind: 'unit', cost: 5, atk: 5, hp: 4 },
  '千年の眠り':     { kind: 'spell', cost: 5 },
  '六罪 グラーク':  { kind: 'unit', cost: 6, atk: 5, hp: 5 },
  '六罪 ガドル':    { kind: 'unit', cost: 7, atk: 6, hp: 6 },
  '六罪 ネフィス':  { kind: 'unit', cost: 8, atk: 6, hp: 6 },

  // ---- ミッドレンジガイル（ウォーリア）----
  'ロダンの傭兵':   { kind: 'unit', cost: 1, atk: 2, hp: 2 },
  '番犬ゴロ':       { kind: 'unit', cost: 2, atk: 1, hp: 5, kw: ['守護'] },
  '研ぎ直した長剣': { kind: 'weapon', cost: 2, atk: 2, dur: 2 },
  '踏み込み':       { kind: 'spell', cost: 1 },
  '傭兵仲間リナ':   { kind: 'unit', cost: 3, atk: 3, hp: 4, kw: ['突進'] },
  '鍛冶師ドヴァル': { kind: 'unit', cost: 3, atk: 2, hp: 3 },
  '鉄の大剣':       { kind: 'weapon', cost: 4, atk: 4, dur: 2 },
  '砦の古参兵':     { kind: 'unit', cost: 4, atk: 4, hp: 4, kw: ['守護'] },
  '剣術学校の師範': { kind: 'unit', cost: 5, atk: 4, hp: 5 },
  '一騎打ち':       { kind: 'spell', cost: 3 },
  'ロダンの重装兵': { kind: 'unit', cost: 6, atk: 5, hp: 7, kw: ['守護'] },
  '裏切のグラーク': { kind: 'unit', cost: 5, atk: 5, hp: 5 },
  'ドヴァルの遺作': { kind: 'weapon', cost: 7, atk: 5, dur: 3, kw: ['貫通'] },
  '兄ゲイン':       { kind: 'unit', cost: 8, atk: 5, hp: 5 },
  '立てなくなるまで': { kind: 'spell', cost: 5 },
  '鍛錬の剣':       { kind: 'weapon', cost: 0, atk: 3, dur: 1, token: true },
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
      '癒しの人形': 3, '小さな手当て': 3, '禁術・蘇生': 2, '傷ついた巡礼者': 3,
      '長屋の病人': 3, '怪我をした修道女キーラ': 3, '謎の日記': 3, '聖獣キメラ': 3,
      '聖騎士ザキエル': 3, '老司祭ドラン': 3, '怒れる聖職者アン': 3, '死のパレード': 2,
      '偽善のミゼリア': 3, '聖鳥リフルエル': 3,
    },
  },
  'ランプヴァルカス': {
    style: 'control',
    leader: 'ヴァルカス',
    list: {
      '無様な魔物': 3, '貪りの供物': 3, '檻の番人': 3, '魔王の復活': 2,
      '玉座の使い魔': 3, '眷属': 3, '記憶喰らい': 3, '魔軍のヴェイン': 3,
      '霊脈喰らい': 3, '六罪 ヴェルド': 3, '王の一瞥': 3, '六罪 ミゼリア': 3,
      '六罪 ノクス': 2, '魔王ヴァルカス': 3,
    },
  },
  'アグロトバル': {
    style: 'aggro',
    leader: 'トバル',
    list: {
      '市場の荷運び': 3, '市場の売り子': 3, '薬草の仕入れ': 2, '隊商の用心棒': 3,
      '空籠の行商人': 3, '結晶の粉': 3, '護衛バルド': 3, '捨て値の毒': 3,
      '運び屋ゴルダ': 3, '隊商の頭': 3, '強欲のネフィス': 2, '早馬の隊商': 3,
      '弟子ザイル': 3, '毒入りの霊薬': 3,
    },
  },
  'コンボシュリ': {
    style: 'midrange',
    leader: 'シュリ',
    list: {
      'ガンザの門下生': 3, '朝駆け': 3, '牽制の拳': 3, '弟弟子カイ': 3,
      '組み手の兄弟子': 3, '掌打': 3, '息を整える': 3, '岩窟の見張り': 3,
      '型の写本': 3, '拳で届かせる': 3, '老師ロウ': 2, '旋風脚': 2,
      '妹リン': 3, '渇望のガドル': 3,
    },
  },
  'ミッドレンジヴェイン': {
    style: 'midrange',
    leader: 'ヴェイン',
    list: {
      'さまよう魂': 3, '魔軍の小鬼': 3, '魔軍の剣兵': 3, '気まぐれの一太刀': 3,
      '罪の影': 3, '呪剣ノア': 3, '魔軍の伝令': 3, '逢瀬の記憶': 2,
      '黒いヴェイン': 3, '皆殺しの命令': 3, '魔軍一の剣': 2, '千年の眠り': 2,
      '六罪 グラーク': 2, '六罪 ガドル': 3, '六罪 ネフィス': 2,
    },
  },
  'ミッドレンジガイル': {
    style: 'midrange',
    leader: 'ガイル',
    list: {
      'ロダンの傭兵': 3, '番犬ゴロ': 2, '研ぎ直した長剣': 3, '踏み込み': 2,
      '傭兵仲間リナ': 3, '鍛冶師ドヴァル': 3, '鉄の大剣': 3, '砦の古参兵': 3,
      '剣術学校の師範': 3, '一騎打ち': 3, 'ロダンの重装兵': 2, '裏切のグラーク': 2,
      'ドヴァルの遺作': 3, '兄ゲイン': 3, '立てなくなるまで': 2,
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
