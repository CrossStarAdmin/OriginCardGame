// style.json を読み込んで、プロンプトの部品として渡す
// 絵柄を変えるときに触るのは style.json 側で、このファイルは読み出しだけ
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'style.json');
const S = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const PRESETS = Object.keys(S.presets);

// { en, 和訳 } の対を、用途に応じてどちらかに寄せて取り出す
const en = (v) => (v && typeof v === 'object' ? v.en : v) || '';
const jp = (v) => (v && typeof v === 'object' ? v['和訳'] : v) || '';

function preset(name) {
  const key = name || S.preset;
  const found = S.presets[key];
  if (!found) throw new Error(`style.json に無いプリセット: ${key}（${PRESETS.join(' / ')}）`);
  return { name: key, base: found.base, lighting: found.lighting };
}

module.exports = {
  preset, PRESETS, en, jp,
  DEFAULT_PRESET: S.preset,
  COMPOSITION: S.composition,
  CLASS_TONE: S.classTone,
  FRAME_SAFE: S.frameSafe,
  EXCLUSIONS: S.exclusions,
  ASPECT: S.aspect,
};
