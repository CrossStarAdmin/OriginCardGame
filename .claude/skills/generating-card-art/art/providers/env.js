// 環境変数、無ければプロジェクトルートの .env からAPIキーを読む
const fs = require('fs');
const path = require('path');

function readEnvFile() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function apiKey(names, hint) {
  const file = readEnvFile();
  for (const name of names) {
    const value = process.env[name] || file[name];
    if (value) return value;
  }
  throw new Error(`${names.join(' か ')} が設定されていない。環境変数か、プロジェクトルートの .env に置く（${hint}）`);
}

module.exports = { apiKey };
