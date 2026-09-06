// コマンドライン引数の解釈（generate.js / list.js 共通）
const FLAGS = new Set(['--force', '--dry-run', '--no-leader']);
const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '4:3', '3:2', '16:9'];

function parseArgs(argv) {
  const opts = {
    decks: [], cards: [],
    force: false, dryRun: false, includeLeader: true,
    provider: 'google', model: null, aspect: null, quality: 'high', style: null,
    concurrency: 2, out: 'イラスト',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (FLAGS.has(arg)) {
      if (arg === '--force') opts.force = true;
      if (arg === '--dry-run') opts.dryRun = true;
      if (arg === '--no-leader') opts.includeLeader = false;
      continue;
    }
    if (arg.startsWith('--')) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} に値が無い`);
      switch (arg) {
        case '--card': opts.cards.push(value); break;
        case '--provider': opts.provider = value; break;
        case '--model': opts.model = value; break;
        case '--aspect': opts.aspect = value; break;
        case '--style': opts.style = value; break;
        case '--quality': opts.quality = value; break;
        case '--concurrency': opts.concurrency = Number(value); break;
        case '--out': opts.out = value; break;
        default: throw new Error(`不明なオプション: ${arg}`);
      }
      continue;
    }
    opts.decks.push(arg);
  }
  if (opts.aspect && !ASPECTS.includes(opts.aspect)) throw new Error(`--aspect は ${ASPECTS.join(' / ')} のどれか`);
  if (!Number.isInteger(opts.concurrency) || opts.concurrency < 1) throw new Error('--concurrency は1以上の整数');
  return opts;
}

module.exports = { parseArgs, ASPECTS };
