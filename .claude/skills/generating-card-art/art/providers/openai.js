// OpenAI Images API での画像生成
const { apiKey } = require('./env.js');

const ENDPOINT = 'https://api.openai.com/v1/images/generations';
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
const DEFAULT_MODEL = 'gpt-image-1';

// OpenAIは縦横比ではなくピクセル指定なので、いちばん近い組に読み替える
const SIZE_BY_ASPECT = {
  '1:1': '1024x1024',
  '4:5': '1024x1536',
  '3:4': '1024x1536',
  '2:3': '1024x1536',
  '4:3': '1536x1024',
  '3:2': '1536x1024',
  '16:9': '1536x1024',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const requireKey = () => apiKey(['OPENAI_API_KEY'], 'https://platform.openai.com/api-keys で発行');

async function generate(prompt, options = {}) {
  const {
    model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL,
    aspect = '4:5',
    quality = 'high',
    maxRetries = 4,
    key = requireKey(),
  } = options;

  const size = SIZE_BY_ASPECT[aspect];
  if (!size) throw new Error(`OpenAIで扱えない縦横比: ${aspect}（${Object.keys(SIZE_BY_ASPECT).join(' / ')}）`);

  const payload = JSON.stringify({
    model, prompt, size, quality, n: 1, output_format: 'png', moderation: 'low',
  });

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(Math.min(2 ** attempt, 30) * 1000);

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: payload,
      });
    } catch (e) {
      lastError = new Error(`通信エラー: ${e.message}`);
      continue;
    }

    if (res.ok) {
      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error(`画像が返らなかった: ${JSON.stringify(json).slice(0, 300)}`);
      return { buffer: Buffer.from(b64, 'base64'), revisedPrompt: json.data[0].revised_prompt || null, model };
    }

    lastError = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
    if (!RETRYABLE.has(res.status)) break;
  }
  throw lastError;
}

module.exports = { generate, requireKey, DEFAULT_MODEL };
