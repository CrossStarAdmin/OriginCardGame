// sim/ の4ファイルを読み、ブラウザ用に包んでツールのHTMLへ差し込む
const fs = require('fs');
const path = require('path');

const SIM = process.argv[2];
const TEMPLATE = process.argv[3];
const OUT = process.argv[4];
const DECK_ROOT = process.argv[5] || null; // 効果テキストの取り込み元（省略可）

function read(name) { return fs.readFileSync(path.join(SIM, name), 'utf8'); }

function must(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } }

// module.exports = {...}; を return {...}; に変える（各ファイル末尾）
function exportsToReturn(src, file) {
  const i = src.lastIndexOf('module.exports =');
  must(i >= 0, file + ' に module.exports が無い');
  return src.slice(0, i) + 'return ' + src.slice(i + 'module.exports ='.length);
}

// require('./x.js') を対応するモジュール名に置き換える
function rewriteRequires(src) {
  return src
    .replace(/require\('\.\/cards\.js'\)/g, 'CardsMod')
    .replace(/require\('\.\/engine\.js'\)/g, 'EngineMod')
    .replace(/require\('\.\/effects\.js'\)/g, 'EffectsMod');
}

function wrap(name, body) {
  return 'const ' + name + ' = (function () {\n' + body + '\n})();\n';
}

// ---- cards ----
let cards = exportsToReturn(read('cards.js'), 'cards.js');

// ---- engine：リーダーHPを可変にする ----
let engine = read('engine.js');
must(engine.indexOf('const LEADER_HP = 25;') >= 0, 'engine.js の LEADER_HP が見つからない');
engine = engine.replace('const LEADER_HP = 25;', 'let LEADER_HP = 25;');

must(engine.indexOf('function boardFull(p)') >= 0, 'engine.js の boardFull が見つからない');
engine = engine.replace('function boardFull(p)',
  'function setLeaderHp(n) { LEADER_HP = n; }\nfunction boardFull(p)');

must(engine.indexOf('boardFull, putUnit,') >= 0, 'engine.js の export 行が想定と違う');
engine = engine.replace('boardFull, putUnit,', 'boardFull, setLeaderHp, putUnit,');

engine = exportsToReturn(rewriteRequires(engine), 'engine.js');

// ---- effects / ai ----
let effects = exportsToReturn(rewriteRequires(read('effects.js')), 'effects.js');
let ai = exportsToReturn(rewriteRequires(read('ai.js')), 'ai.js');

const bundle = [
  wrap('CardsMod', cards),
  wrap('EngineMod', engine),
  wrap('EffectsMod', effects),
  wrap('AiMod', ai),
].join('\n');

// ---- 効果テキスト：デッキファイルの「## 効果」節を取り込む ----
function collectCardText(root) {
  const out = {};
  if (!root || !fs.existsSync(root)) return out;
  for (const deck of fs.readdirSync(root)) {
    const dir = path.join(root, deck, 'カード一覧');
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      const name = (src.match(/^#\s+(.+?)\s*$/m) || [])[1];
      if (!name) continue;
      const body = (src.match(/^##\s*効果\s*$([\s\S]*?)^##\s/m) || [])[1];
      if (!body) continue;
      const text = body.split('\n')
        .map((l) => l.replace(/^\s*[-*]\s*/, '').trim())
        .filter((l) => l.length)
        .join('\n');
      if (text && text !== '効果なし') out[name] = text;
    }
  }
  return out;
}
const cardText = collectCardText(DECK_ROOT);
console.log('効果テキスト ' + Object.keys(cardText).length + '件を取り込み');

const tpl = fs.readFileSync(TEMPLATE, 'utf8');
must(tpl.indexOf('/*__SIM__*/') >= 0, 'テンプレートに /*__SIM__*/ が無い');
must(tpl.indexOf('/*__TEXT__*/') >= 0, 'テンプレートに /*__TEXT__*/ が無い');
const html = tpl
  .replace('/*__SIM__*/', bundle)
  .replace('/*__TEXT__*/', 'const CARD_TEXT = ' + JSON.stringify(cardText, null, 0) + ';');

fs.writeFileSync(OUT, html, 'utf8');
console.log('OK ' + OUT + ' / ' + Math.round(html.length / 1024) + 'KB');

// ---- 差し込んだコードがブラウザ抜きで動くか、その場で検算する ----
const sandbox = bundle + `
EngineMod.setEffects(EffectsMod);
function playGame(a, b, seed, stats, id) {
  const g = new EngineMod.Game(a, b, seed, stats, id);
  g.playedThisGame = [];
  for (const p of g.players) { EngineMod.draw(g, p, 5); AiMod.mulligan(g, p); }
  g.players[1].tension = 2; g.players[1].holy = 2;
  let tp = 0;
  while (!g.over && g.turn < EngineMod.TURN_CAP) { g.turn++; g.turnPlayer = tp; AiMod.takeTurn(g, g.players[tp]); tp = 1 - tp; }
  if (!g.over) { g.over = true; g.winner = 'draw'; }
  return g;
}
let aWins = 0;
const stats = {};
for (let i = 0; i < 1000; i++) {
  const aFirst = i % 2 === 0;
  const g = playGame(aFirst ? 'アグロリーゼ' : 'ミッドレンジ奇数エルナ', aFirst ? 'ミッドレンジ奇数エルナ' : 'アグロリーゼ', 1000 + i * 7919, stats, i);
  if (g.winner !== 'draw' && g.players[g.winner].deckName === 'アグロリーゼ') aWins++;
  for (const [dn, cn] of g.playedThisGame) stats[dn][cn].seen = false;
}
return aWins;
`;
const check = new Function(sandbox)();
console.log('検算：アグロリーゼ vs エルナ 1000戦 → ' + (check / 10).toFixed(1) + '%（run.js は 45.1%）');
must(Math.abs(check / 10 - 45.1) < 0.001, '本体と結果が一致しない（移植でズレた）');
console.log('一致。移植は正しい。');
