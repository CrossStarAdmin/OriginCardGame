// デッキを読み出す。デッキ/<デッキ名>/overview.md ＋ カード一覧/*.md（カード1枚が1ファイル）
const fs = require('fs');
const path = require('path');

const DECK_DIR = path.join(process.cwd(), 'デッキ');

const FIELD = {
  'クラス': 'className',
  '種類': 'type',
  '投入枚数': 'count',
  'コスト': 'cost',
  '攻撃力': 'atk',
  'HP': 'hp',
  '種族タグ': 'tag',
};

const isBlank = (v) => !v || v === '-' || v === '─' || v === '—';

// ---- 新形式 -------------------------------------------------------------

// 「## 見出し」「### 見出し」で本文を切り分ける
function splitSections(text, marker) {
  const pattern = new RegExp(`^${marker} (.+)$`);
  const out = new Map();
  let title = null;
  let buffer = [];
  for (const raw of text.split(/\r?\n/)) {
    const hit = pattern.exec(raw);
    if (hit) {
      if (title) out.set(title, buffer);
      title = hit[1].trim();
      buffer = [];
      continue;
    }
    if (title) buffer.push(raw);
  }
  if (title) out.set(title, buffer);
  return out;
}

// 「| 項目 | 内容 |」の表を拾う。区切り行と見出し行は捨てる
function parseTable(lines) {
  const out = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|') || /^\|[\s:|-]+\|$/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 2) continue;
    if (cells[0] === '項目') continue;
    out[cells[0]] = cells[1];
  }
  return out;
}

// 箇条書きなら1項目1行、地の文ならそのまま1行として拾う
// 番号・箇条書き記号・強調はプロンプトに要らないので落とす
function parseLines(lines) {
  return (lines || [])
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('|') && !l.startsWith('>') && !l.startsWith('#'))
    .map((l) => l.replace(/^[-*]\s+/, '').replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);
}

function parseCardFile(file, deckName) {
  const text = fs.readFileSync(file, 'utf8');
  const title = /^#\s+(.+)$/m.exec(text);
  if (!title) throw new Error(`カードの見出し「# 名前」が無い: ${file}`);

  const h2 = splitSections(text, '##');
  const table = parseTable(text.split(/\r?\n/));
  const art = splitSections((h2.get('絵') || []).join('\n'), '###');

  const card = { name: title[1].trim(), deck: deckName, file, effects: [] };
  for (const [key, field] of Object.entries(FIELD)) {
    if (!isBlank(table[key])) card[field] = table[key];
  }

  const effects = parseLines(h2.get('効果')).filter((l) => l !== '効果なし');
  // リーダーは「テンションスキル：名前」の行をスキル名として抜き、残りを効果本文にする
  const skillLine = card.type === 'リーダー' ? effects.find((l) => l.startsWith('テンションスキル')) : null;
  if (skillLine) {
    card.skillName = skillLine.replace(/^テンションスキル\s*[:：]\s*/, '').trim();
    card.effects = effects.filter((l) => l !== skillLine);
  } else {
    card.effects = effects;
  }

  card.look = {
    外見: parseLines(art.get('外見')).join(''),
    情景: parseLines(art.get('情景')).join(''),
    背景: parseLines(art.get('背景')).join(''),
  };
  card.hasLook = Boolean(card.look.外見 || card.look.情景);
  return card;
}

function parseOverview(file, deckName) {
  const text = fs.readFileSync(file, 'utf8');
  const h2 = splitSections(text, '##');
  const table = parseTable(text.split(/\r?\n/));
  const concept = (text.split(/\r?\n/).slice(1).find((l) => l.trim() && !l.startsWith('#')) || '').trim();
  // 見出し名は「見た目のルール」「見た目の共通ルール」など揺れるので、含むもので拾う
  const lookKey = [...h2.keys()].find((k) => k.includes('見た目'));
  return {
    concept,
    className: table['クラス'] || null,
    lookRules: parseLines(h2.get(lookKey)),
  };
}

function loadDeckFolder(dir) {
  const deckName = path.basename(dir);
  const overviewFile = path.join(dir, 'overview.md');
  const cardsDir = path.join(dir, 'カード一覧');
  if (!fs.existsSync(overviewFile)) throw new Error(`overview.md が無い: ${dir}`);
  if (!fs.existsSync(cardsDir)) throw new Error(`カード一覧/ が無い: ${dir}`);

  const overview = parseOverview(overviewFile, deckName);
  const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith('.md')).sort();
  const all = files.map((f) => parseCardFile(path.join(cardsDir, f), deckName));

  const deck = {
    name: deckName,
    file: overviewFile,
    format: 'folder',
    concept: overview.concept,
    lookRules: overview.lookRules,
    leader: all.find((c) => c.type === 'リーダー') || null,
    cards: all.filter((c) => c.type !== 'リーダー'),
  };
  // 見た目のルールはデッキ全体に効くので、カード側から引けるようにする
  for (const card of all) {
    card.lookRules = deck.lookRules;
    if (!card.className) card.className = overview.className;
  }
  return deck;
}

// ---- 入口 ---------------------------------------------------------------

function loadDecks(names) {
  const entries = fs.readdirSync(DECK_DIR, { withFileTypes: true });
  // デッキ直下の .md は読まない。1枚のファイルに全カードを詰める旧形式は廃止した
  const loose = entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
  if (loose.length) {
    console.warn(`※ デッキ/ 直下の .md は読み込まない（フォルダに分ける）: ${loose.join(', ')}`);
  }

  const decks = entries
    .filter((e) => e.isDirectory())
    .map((e) => loadDeckFolder(path.join(DECK_DIR, e.name)));

  if (!names || names.length === 0) return decks;
  const missing = names.filter((n) => !decks.some((d) => d.name === n));
  if (missing.length) {
    throw new Error(`デッキが見つからない: ${missing.join(', ')}（存在するのは ${decks.map((d) => d.name).join(', ')}）`);
  }
  return decks.filter((d) => names.includes(d.name));
}

// リーダーを先頭にした、生成対象の平坦なリスト
function listSubjects(decks, { includeLeader = true } = {}) {
  const out = [];
  for (const deck of decks) {
    if (includeLeader && deck.leader) out.push(deck.leader);
    out.push(...deck.cards);
  }
  return out;
}

module.exports = { loadDecks, listSubjects, loadDeckFolder, DECK_DIR };
