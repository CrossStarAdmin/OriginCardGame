// デッキ/*.md からカード定義を読み出す
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

// 「- **キー**: 値」と、その下にぶら下がる「  - 値」を拾う
function parseCardBody(lines) {
  const card = { effects: [] };
  let key = null;
  for (const raw of lines) {
    const top = /^- \*\*(.+?)\*\*\s*[:：]\s*(.*)$/.exec(raw.trimEnd());
    if (top) {
      key = top[1];
      const value = top[2].trim();
      if (key === '効果') {
        if (value && value !== '効果なし') card.effects.push(value);
      } else if (FIELD[key]) {
        card[FIELD[key]] = value;
      }
      continue;
    }
    const sub = /^\s+- (.+)$/.exec(raw.trimEnd());
    if (sub && key === '効果') card.effects.push(sub[1].trim());
  }
  return card;
}

function parseLeader(lines) {
  const body = lines.map((l) => l.trim()).filter(Boolean);
  if (!body.length) return null;
  const skillLine = body.find((l) => l.startsWith('テンションスキル')) || '';
  const skillIndex = body.indexOf(skillLine);
  return {
    name: body[0],
    type: 'リーダー',
    skillName: skillLine.replace(/^テンションスキル\s*[:：]\s*/, ''),
    effects: skillIndex >= 0 ? body.slice(skillIndex + 1) : [],
  };
}

function parseDeckFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const deckName = path.basename(file, '.md');

  const deck = { name: deckName, file, concept: '', leader: null, cards: [] };
  deck.concept = (lines.slice(1).find((l) => l.trim()) || '').trim();

  let section = null;   // '各種カード' | 'リーダー' | null
  let cardName = null;
  let buffer = [];

  const flush = () => {
    if (section === '各種カード' && cardName) {
      deck.cards.push({ name: cardName, deck: deckName, ...parseCardBody(buffer) });
    } else if (section === 'リーダー') {
      const leader = parseLeader(buffer);
      if (leader) deck.leader = { ...leader, deck: deckName, className: null };
    }
    cardName = null;
    buffer = [];
  };

  for (const line of lines) {
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      flush();
      section = h2[1].trim();
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3 && section === '各種カード') {
      flush();
      section = '各種カード';
      cardName = h3[1].trim();
      continue;
    }
    if (h3) { flush(); section = null; continue; }
    buffer.push(line);
  }
  flush();

  // リーダーのクラスは所属カードから借りる
  if (deck.leader) deck.leader.className = deck.cards[0]?.className ?? null;
  return deck;
}

function loadDecks(names) {
  const files = fs.readdirSync(DECK_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(DECK_DIR, f));
  const decks = files.map(parseDeckFile);
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

module.exports = { loadDecks, listSubjects, parseDeckFile, DECK_DIR };
