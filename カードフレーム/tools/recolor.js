// カード枠の色帯だけを別の色相に置き換える
// コスト宝石は全クラス共通なので、塗りつぶし判定で見つけて必ず除外する
const { decode, encode, rgb2hsl, hsl2rgb } = require('./png.js');

// 宝石は左上にある。青い面と白いハイライトから成り、金の飾りで囲まれている
const GEM = {
  maxX: 260, maxY: 320,
  faceHue: [175, 258], faceSat: 0.35, faceLight: [0.40, 0.90],
  fillHue: [165, 270], fillSat: 0.15, fillLight: 0.30,
  grow: 2,
};

function parseArgs(argv) {
  const opts = { src: null, dest: null, from: [190, 255], hue: 47.61, sat: 0.7736, light: 1.3444, minSat: 0.22, maxLight: 0.62 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { rest.push(argv[i]); continue; }
    const flag = argv[i];
    const value = argv[++i];
    if (value === undefined) throw new Error(`${flag} に値が無い`);
    switch (flag) {
      case '--from': opts.from = value.split(',').map(Number); break;
      case '--hue': opts.hue = Number(value); break;
      case '--sat': opts.sat = Number(value); break;
      case '--light': opts.light = Number(value); break;
      case '--min-sat': opts.minSat = Number(value); break;
      case '--max-light': opts.maxLight = Number(value); break;
      default: throw new Error(`不明なオプション: ${flag}`);
    }
  }
  [opts.src, opts.dest] = rest;
  if (!opts.src || !opts.dest) {
    throw new Error('使い方: recolor.js <入力.png> <出力.png> [--from 190,255] [--hue 47.61] [--sat 0.7736] [--light 1.3444]');
  }
  return opts;
}

function gemMask(w, h, px) {
  const hsl = (x, y) => rgb2hsl(px[(y * w + x) * 4], px[(y * w + x) * 4 + 1], px[(y * w + x) * 4 + 2]);
  const opaque = (x, y) => px[(y * w + x) * 4 + 3] >= 200;

  // 塗りつぶしの範囲。宝石の青い面と白いハイライトを含み、金は含まない
  const inGem = (x, y) => {
    if (!opaque(x, y)) return false;
    const [hue, s, l] = hsl(x, y);
    if (l <= GEM.fillLight) return false;
    return (hue >= GEM.fillHue[0] && hue <= GEM.fillHue[1]) || s < GEM.fillSat;
  };

  // 種は、はっきりした青い面の重心にいちばん近い画素にする
  // 明るさだけで選ぶと、金の縁の孤立した明点を掴んで塗りつぶしが広がらない
  const faces = [];
  for (let y = 0; y < Math.min(h, GEM.maxY); y++) {
    for (let x = 0; x < Math.min(w, GEM.maxX); x++) {
      if (!opaque(x, y)) continue;
      const [hue, s, l] = hsl(x, y);
      if (hue < GEM.faceHue[0] || hue > GEM.faceHue[1]) continue;
      if (s < GEM.faceSat || l < GEM.faceLight[0] || l > GEM.faceLight[1]) continue;
      faces.push([x, y]);
    }
  }
  const mask = new Uint8Array(w * h);
  if (!faces.length) return mask;

  const cx = faces.reduce((a, p) => a + p[0], 0) / faces.length;
  const cy = faces.reduce((a, p) => a + p[1], 0) / faces.length;
  const seed = faces.reduce((best, p) => {
    const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
    return d < best.d ? { d, i: p[1] * w + p[0] } : best;
  }, { d: Infinity, i: -1 }).i;

  const stack = [seed];
  while (stack.length) {
    const i = stack.pop();
    if (mask[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if (!inGem(x, y)) continue;
    mask[i] = 1;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }

  // 縁のアンチエイリアスを巻き込まないよう太らせる
  for (let g = 0; g < GEM.grow; g++) {
    const grown = Uint8Array.from(mask);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (mask[i]) continue;
        if (mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w]) grown[i] = 1;
      }
    }
    mask.set(grown);
  }
  return mask;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { w, h, px } = decode(opts.src);
  const gem = gemMask(w, h, px);
  const out = Buffer.from(px);

  let changed = 0;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (px[p + 3] < 8 || gem[i]) continue;
    const [hue, s, l] = rgb2hsl(px[p], px[p + 1], px[p + 2]);
    if (hue < opts.from[0] || hue > opts.from[1]) continue;
    if (s < opts.minSat || l > opts.maxLight) continue;
    const [r, g, b] = hsl2rgb(opts.hue, Math.min(1, s * opts.sat), Math.min(0.95, l * opts.light));
    out[p] = r; out[p + 1] = g; out[p + 2] = b;
    changed++;
  }

  encode(w, h, out, opts.dest);
  let gemPixels = 0;
  for (const v of gem) gemPixels += v;
  console.log(`${opts.src} → ${opts.dest}`);
  console.log(`  置換 ${changed}px（色相${opts.from[0]}〜${opts.from[1]}° → 色相${opts.hue}° / 彩度x${opts.sat} / 明度x${opts.light}）`);
  console.log(`  宝石として保護 ${gemPixels}px`);
}

main();
