// デッキ定義と効果実装の整合をチェックする。対戦を回す前に必ず通す。
const fs = require('fs');
const path = require('path');
const { CARD_DB, DECKS, buildDeck } = require('./cards.js');

const DECK_SIZE = 40;   // ルール/01_基本ルール.md
const COPY_LIMIT = 3;   // 同名カードの上限

const effectsSrc = fs.readFileSync(path.join(__dirname, 'effects.js'), 'utf8');

// effects.js から効果が実装済みのカード名を拾う
// 召喚時・スペルは case ラベル、それ以外の誘発は name === '...' で書かれている
function implementedCards() {
  const found = new Set();
  for (const re of [/case\s+'([^']+)'/g, /name === '([^']+)'/g, /indexOf\('([^']+)'\)/g]) {
    let m;
    while ((m = re.exec(effectsSrc)) !== null) found.add(m[1]);
  }
  return found;
}

// パワースキルが実装済みのリーダー名を拾う
function implementedLeaders() {
  const found = new Set();
  const re = /p\.leader === '([^']+)'/g;
  let m;
  while ((m = re.exec(effectsSrc)) !== null) found.add(m[1]);
  return found;
}

const impl = implementedCards();
const leaders = implementedLeaders();
const errors = [];
const notes = [];

for (const [deckName, def] of Object.entries(DECKS)) {
  const list = def.list;

  for (const name of Object.keys(list)) {
    if (!CARD_DB[name]) {
      errors.push(`${deckName}: 「${name}」が CARD_DB にありません。cards.js にカードを追加してください。`);
    }
    if (list[name] > COPY_LIMIT) {
      errors.push(`${deckName}: 「${name}」が${list[name]}枚。同名カードは${COPY_LIMIT}枚までです。`);
    }
    if (list[name] < 1) {
      errors.push(`${deckName}: 「${name}」の枚数が${list[name]}枚になっています。`);
    }
  }

  const total = buildDeck(deckName).length;
  if (total !== DECK_SIZE) {
    errors.push(`${deckName}: 合計${total}枚。${DECK_SIZE}枚ちょうどにしてください（差 ${total - DECK_SIZE}枚）。`);
  }

  if (!def.leader) errors.push(`${deckName}: leader が未設定です。`);
  else if (!leaders.has(def.leader)) {
    errors.push(`${deckName}: リーダー「${def.leader}」のパワースキルが effects.js の usePowerSkill にありません。`);
  }

  if (!['aggro', 'midrange', 'control'].includes(def.style)) {
    errors.push(`${deckName}: style が「${def.style}」です。aggro / midrange / control のどれかにしてください。`);
  }

  // 効果ハンドラを持たないカード（バニラ扱い）を一覧で出す
  const vanilla = Object.keys(list).filter((n) => CARD_DB[n] && !impl.has(n));
  if (vanilla.length) notes.push([deckName, vanilla]);
}

// ステータス欠落のチェック
for (const [name, d] of Object.entries(CARD_DB)) {
  if (d.kind === 'unit' && (typeof d.atk !== 'number' || typeof d.hp !== 'number')) {
    errors.push(`CARD_DB「${name}」: ユニットに atk / hp がありません。`);
  }
  if (typeof d.cost !== 'number') {
    errors.push(`CARD_DB「${name}」: cost がありません。`);
  }
}

console.log(`デッキ数 ${Object.keys(DECKS).length} / カード定義 ${Object.keys(CARD_DB).length}件\n`);

if (notes.length) {
  console.log('効果ハンドラが無いカード（バニラ＝効果なしとして処理されます）');
  console.log('デッキファイルのテキストと突き合わせ、効果があるのに載っていたら effects.js に追加してください。\n');
  for (const [deckName, vanilla] of notes) {
    console.log(`  ${deckName}`);
    console.log(`    ${vanilla.join('、')}`);
  }
  console.log('');
}

if (errors.length) {
  console.log(`NG ${errors.length}件`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}

console.log('OK デッキ定義に問題はありません。');
