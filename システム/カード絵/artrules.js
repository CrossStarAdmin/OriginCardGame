// イラスト/共通ルール.md を読む。全カードに共通で効く絵の指定
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'イラスト', '共通ルール.md');

// 「### 見出し」ごとに本文をまとめる。表と箇条書きの行は指定文ではないので落とす
function sectionsOf(lines) {
  const out = [];
  let current = null;
  for (const raw of lines) {
    const h3 = /^### (.+)$/.exec(raw);
    if (h3) {
      current = { title: h3[1].trim(), body: [] };
      out.push(current);
      continue;
    }
    if (current) current.body.push(raw);
  }
  return out.map((s) => ({ title: s.title, text: textOf(s.body) }));
}

// 強調と箇条書き記号はプロンプトに要らないので落とす
function textOf(lines) {
  return lines
    .filter((l) => l.trim() && !l.trim().startsWith('|') && !l.trim().startsWith('#'))
    .map((l) => l.trim().replace(/^[-*]\s+/, '').replace(/\*\*/g, ''))
    .join('');
}

function parse(text) {
  const lines = text.split(/\r?\n/);
  const blocks = new Map();
  let title = null;
  let buffer = [];

  for (const raw of lines) {
    const h2 = /^## (.+)$/.exec(raw);
    if (h2) {
      if (title) blocks.set(title, buffer);
      title = h2[1].trim();
      buffer = [];
      continue;
    }
    if (title) buffer.push(raw);
  }
  if (title) blocks.set(title, buffer);

  const styles = sectionsOf(blocks.get('絵柄') || []);
  const compositions = sectionsOf(blocks.get('構図') || []);

  return {
    // 「油彩（既定）」の見出しから、名前と既定フラグを取り出す
    styles: styles.map((s) => ({
      name: s.title.replace(/（既定）/, '').trim(),
      isDefault: s.title.includes('（既定）'),
      text: s.text,
    })),
    compositions: new Map(compositions.map((c) => [c.title, c.text])),
    canvas: textOf(blocks.get('画面の使い方') || []),
    exclusions: textOf(blocks.get('描かせないもの') || []),
  };
}

let cache = null;
function load() {
  if (cache) return cache;
  if (!fs.existsSync(FILE)) throw new Error(`イラスト/共通ルール.md が無い（${FILE}）`);
  cache = parse(fs.readFileSync(FILE, 'utf8'));
  if (!cache.styles.length) throw new Error('イラスト/共通ルール.md に「## 絵柄」の項が無い');
  return cache;
}

const styleNames = () => load().styles.map((s) => s.name);

function style(name) {
  const rules = load();
  const found = name
    ? rules.styles.find((s) => s.name === name)
    : rules.styles.find((s) => s.isDefault) || rules.styles[0];
  if (!found) throw new Error(`共通ルール.md に無い絵柄: ${name}（${styleNames().join(' / ')}）`);
  return found;
}

const composition = (type) => load().compositions.get(type) || load().compositions.get('キャラクター') || '';
const canvas = () => load().canvas;
const exclusions = () => load().exclusions;

module.exports = { load, style, styleNames, composition, canvas, exclusions, FILE };
