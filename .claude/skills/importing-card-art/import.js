// 取り込み/ に置かれた画像を、イラスト/<デッキ名>/ へ移して .json を作る
// 外部ツール（ChatGPTなど）で作った絵を、API生成のものと同じ形に揃えるため
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const CORE = path.join(ROOT, 'システム');
const { loadDecks, listSubjects } = require(path.join(CORE, 'デッキ読み込み', 'decks.js'));
const { buildPrompt } = require(path.join(CORE, 'カード絵', 'prompt.js'));
const { aspectOf } = require(path.join(CORE, 'カード絵', 'frame.js'));

const INBOX = path.join(ROOT, '取り込み');
const OUT = path.join(ROOT, 'イラスト');

// PNGのIHDRから幅と高さだけ取る。画素は読まない
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(24);
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  if (head.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
}

// 「4:5」を数値にする
function ratioOf(aspect) {
  const [w, h] = aspect.split(':').map(Number);
  return w / h;
}

function findCard(name, cards) {
  const hits = cards.filter((c) => c.name === name);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new Error(`同じ名前のカードが複数のデッキにある: ${hits.map((c) => c.deck).join(', ')}`);
  throw new Error('カードが見つからない。ファイル名をカード名と同じにする');
}

function importOne(file, cards, opts) {
  const name = path.basename(file, '.png');
  const card = findCard(name, cards);

  const dir = path.join(OUT, card.deck);
  const image = path.join(dir, `${name}.png`);
  const meta = path.join(dir, `${name}.json`);
  const replaced = fs.existsSync(image);

  const notes = [];
  const size = pngSize(file);
  if (!size) throw new Error('PNGとして読めない');
  const want = aspectOf(card.type);
  const diff = Math.abs(size.w / size.h - ratioOf(want));
  if (diff > 0.08) notes.push(`縦横比が ${want} から離れている（${size.w}x${size.h}）。合成時に上下か左右が切られる`);

  const { promptJa, preset, defined } = buildPrompt(card);
  if (!defined) notes.push('カードmdの 外見／情景 が空');

  if (opts.dryRun) return { card, replaced, notes, dryRun: true };

  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(file, image);
  fs.writeFileSync(meta, JSON.stringify({
    card,
    promptJa,
    prompt: null,
    revisedPrompt: null,
    provider: 'manual',
    tool: opts.tool,
    style: preset,
    model: null,
    textModel: null,
    aspect: want,
    size,
    generatedAt: new Date().toISOString(),
    note: '外部ツールで作った画像を取り込んだもの。英訳は経由していない',
  }, null, 2) + '\n');

  return { card, replaced, notes };
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { dryRun: argv.includes('--dry-run'), tool: 'ChatGPT' };
  const toolAt = argv.indexOf('--tool');
  if (toolAt >= 0) opts.tool = argv[toolAt + 1] || 'ChatGPT';

  if (!fs.existsSync(INBOX)) throw new Error(`取り込み/ が無い（${INBOX}）`);

  const entries = fs.readdirSync(INBOX).filter((f) => f !== 'README.md');
  const pngs = entries.filter((f) => f.toLowerCase().endsWith('.png'));
  const others = entries.filter((f) => !f.toLowerCase().endsWith('.png'));

  if (!pngs.length) {
    console.log('取り込むPNGが無い。取り込み/ にカード名と同じ名前で置く');
    if (others.length) console.log(`PNG以外は取り込まない: ${others.join(', ')}`);
    return;
  }

  const cards = listSubjects(loadDecks());
  let done = 0;
  const errors = [];

  for (const f of pngs) {
    try {
      const r = importOne(path.join(INBOX, f), cards, opts);
      done++;
      // 差し替えになるかは dry-run でこそ知りたいので、必ず出す
      const mark = r.dryRun ? (r.replaced ? '予定(差替)' : '予定') : r.replaced ? '差替' : 'OK  ';
      console.log(`${mark} ${r.card.deck}/${r.card.name}`);
      for (const n of r.notes) console.log(`     ※ ${n}`);
    } catch (e) {
      errors.push(`${f}: ${e.message}`);
      console.error(`NG   ${f}: ${e.message}`);
    }
  }

  console.log(`\n${opts.dryRun ? '取り込み予定' : '取り込み'} ${done} 枚 / 失敗 ${errors.length} 枚`);
  if (others.length) console.log(`PNG以外は残した: ${others.join(', ')}`);

  if (done && !opts.dryRun) {
    const decks = [...new Set(pngs.map((f) => {
      const hit = cards.find((c) => c.name === path.basename(f, '.png'));
      return hit && hit.deck;
    }).filter(Boolean))];
    console.log('\nカード枠と合成する:');
    for (const d of decks) {
      console.log(`  powershell -ExecutionPolicy Bypass -File "カードフレーム/tools/compose.ps1" -Deck "${d}" -Force`);
    }
  }
  if (errors.length) process.exitCode = 1;
}

try {
  main();
} catch (e) {
  console.error(`エラー: ${e.message}`);
  process.exitCode = 1;
}
