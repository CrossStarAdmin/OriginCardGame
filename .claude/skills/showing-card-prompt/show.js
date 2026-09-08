// カード名を渡すと、そのカードのイラストプロンプト（日本語）だけを出す
// ChatGPT など、手で貼り付けて使う外部ツール向け。APIは一切呼ばない
//
// プロンプトの組み立ては システム/ の共有コアを使う。
// 同じ入力から同じ文が出ないと、手で作った絵とAPIで作った絵が食い違うため
const path = require('path');

const CORE = path.join(__dirname, '..', '..', '..', 'システム');
const { loadDecks, listSubjects } = require(path.join(CORE, 'decks.js'));
const { buildPrompt } = require(path.join(CORE, 'prompt.js'));
const { aspectOf } = require(path.join(CORE, 'frame.js'));

function parseArgs(argv) {
  const names = [];
  let style = null;
  let clip = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--style') { style = argv[++i]; continue; }
    if (argv[i] === '--no-clip') { clip = false; continue; }
    if (argv[i].startsWith('--')) throw new Error(`不明なオプション: ${argv[i]}（使えるのは --style と --no-clip）`);
    names.push(argv[i]);
  }
  if (!names.length) throw new Error('カード名を渡す（例: node .claude/skills/showing-card-prompt/show.js マルカ）');
  return { names, style, clip };
}

// Windowsのclipへ。UTF-16LEで渡す。BOMを付けると貼り付け先に混入する
function copyToClipboard(text) {
  const { spawnSync } = require('child_process');
  const r = spawnSync('clip', [], { input: Buffer.from(text, 'utf16le') });
  return r.status === 0 && !r.error;
}

function findCards(names) {
  const all = listSubjects(loadDecks());
  return names.map((name) => {
    const exact = all.find((c) => c.name === name);
    if (exact) return exact;
    const near = all.filter((c) => c.name.includes(name));
    if (near.length === 1) return near[0];
    if (near.length > 1) throw new Error(`「${name}」に当てはまるカードが複数ある: ${near.map((c) => c.name).join(', ')}`);
    throw new Error(`カードが見つからない: ${name}`);
  });
}

function main() {
  const { names, style, clip } = parseArgs(process.argv.slice(2));
  const cards = findCards(names);
  // クリップボードは1つしか持てないので、複数枚のときは入れない
  const copyable = clip && cards.length === 1;

  for (const card of cards) {
    const { promptJa, preset, defined } = buildPrompt(card, style);
    const aspect = aspectOf(card.type);

    console.log(`${'='.repeat(70)}`);
    console.log(`${card.deck} / ${card.name}（${card.type}・絵柄 ${preset}）`);
    if (!defined) console.log('※ カードmdの 外見／情景 が空。先に書く');
    console.log(`${'='.repeat(70)}`);

    const copied = copyable && copyToClipboard(promptJa);
    if (copied) {
      console.log('\n★ プロンプトをクリップボードにコピーした。ChatGPTへそのまま貼り付ける');
    } else {
      console.log('\n--- ここから貼り付け ---');
      console.log(promptJa);
      console.log('--- ここまで ---');
    }

    console.log('\n▼ 生成するときの設定');
    console.log(`  縦横比は ${aspect}。カード枠のアート窓がこの比のため`);
    console.log('  ChatGPTなら 1024x1536（縦長）を選び、上下を切って合わせる');
    console.log('  切られるので、頭のすぐ上と足元に大事なものを置かせない');
    if (copied) console.log('\n  中身を目で見たいときは --no-clip を付ける');
    console.log();
  }
}

try {
  main();
} catch (e) {
  console.error(`エラー: ${e.message}`);
  process.exitCode = 1;
}
