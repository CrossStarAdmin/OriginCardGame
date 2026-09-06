// カードイラストを生成して イラスト/<デッキ名>/<カード名>.png に保存する
const fs = require('fs');
const { parseArgs } = require('./cli.js');
const { resolveTargets } = require('./targets.js');
const IMAGE = require('./image.js');

// 生成済み画像は既定でスキップする。--force で上書き
function pending(targets, force) {
  return force ? targets : targets.filter((t) => !t.exists);
}

function writeResult(target, image, opts) {
  fs.mkdirSync(target.dir, { recursive: true });
  fs.writeFileSync(target.image, image.buffer);
  const meta = {
    card: target.card,
    prompt: target.prompt,
    revisedPrompt: image.revisedPrompt,
    provider: opts.provider,
    style: opts.style || require('./style.js').DEFAULT_PRESET,
    model: image.model,
    aspect: target.aspect,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(target.meta, JSON.stringify(meta, null, 2) + '\n');
}

async function worker(queue, opts, state) {
  const request = { quality: opts.quality, key: state.key };
  if (opts.model) request.model = opts.model;

  while (queue.length) {
    const target = queue.shift();
    const label = `${target.card.deck}/${target.card.name}`;
    try {
      const image = await IMAGE.generate(opts.provider, target.prompt, { ...request, aspect: target.aspect });
      writeResult(target, image, opts);
      state.done++;
      console.log(`[${state.done + state.failed}/${state.total}] OK   ${label}`);
    } catch (e) {
      state.failed++;
      state.errors.push({ label, message: e.message });
      console.error(`[${state.done + state.failed}/${state.total}] NG   ${label}: ${e.message}`);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const targets = resolveTargets(opts);
  const queue = pending(targets, opts.force);
  const model = opts.model || IMAGE.defaultModel(opts.provider);

  console.log(`対象 ${targets.length} 枚 / 生成する ${queue.length} 枚（スキップ ${targets.length - queue.length} 枚）`);
  const aspects = [...new Set(targets.map((t) => t.aspect))].join(' ');
  const styleName = opts.style || require('./style.js').DEFAULT_PRESET;
  console.log(`${opts.provider} ${model} / 絵柄 ${styleName} / 縦横比 ${aspects} / 並列 ${opts.concurrency} / 出力先 ${opts.out}/`);

  if (opts.dryRun) {
    for (const t of queue) console.log(`  生成予定: ${t.card.deck}/${t.card.name} (${t.aspect})`);
    console.log('--dry-run のため生成しない');
    return;
  }
  if (!queue.length) {
    console.log('生成するものが無い。上書きするなら --force');
    return;
  }

  // 回し始めてから鍵が無いと分かるのを避ける
  const state = { total: queue.length, done: 0, failed: 0, errors: [], key: IMAGE.requireKey(opts.provider) };
  await Promise.all(
    Array.from({ length: Math.min(opts.concurrency, queue.length) }, () => worker(queue, opts, state)),
  );

  console.log(`\n完了: 成功 ${state.done} 枚 / 失敗 ${state.failed} 枚`);
  if (state.errors.length) {
    console.log('失敗したカード:');
    for (const e of state.errors) console.log(`  ${e.label}: ${e.message}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`エラー: ${e.message}`);
  process.exitCode = 1;
});
