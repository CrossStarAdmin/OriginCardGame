// 画像生成プロバイダの振り分け
const PROVIDERS = {
  google: require('./providers/google.js'),
  openai: require('./providers/openai.js'),
};

const NAMES = Object.keys(PROVIDERS);

function provider(name) {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`不明なプロバイダ: ${name}（${NAMES.join(' / ')}）`);
  return p;
}

const generate = (name, prompt, options) => provider(name).generate(prompt, options);
const requireKey = (name) => provider(name).requireKey();
const defaultModel = (name) => provider(name).DEFAULT_MODEL;

module.exports = { generate, requireKey, defaultModel, provider, NAMES };
