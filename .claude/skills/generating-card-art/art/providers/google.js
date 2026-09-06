// Google Generative Language API での画像生成
// gemini-* は generateContent、imagen-* は predict と、モデルで呼び出し方が変わる
const { apiKey } = require('./env.js');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
// 429でも残高切れは待っても回復しないので、即座に失敗させる
const FATAL = /credits are depleted|billing|quota .*exceeded for .*billing/i;
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const requireKey = () => apiKey(['GEMINI_API_KEY', 'GOOGLE_API_KEY'], 'https://aistudio.google.com/apikey で発行');

function buildRequest(model, prompt, aspect) {
  if (model.startsWith('imagen-')) {
    return {
      url: `${BASE}/${model}:predict`,
      body: {
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: aspect, personGeneration: 'allow_adult' },
      },
    };
  }
  return {
    url: `${BASE}/${model}:generateContent`,
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
    },
  };
}

function extractImage(model, json) {
  if (model.startsWith('imagen-')) {
    const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
    if (b64) return b64;
  } else {
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const part = parts.find((p) => p.inlineData?.data);
    if (part) return part.inlineData.data;
  }
  // 安全フィルタで落ちた場合は理由がここに入る
  const reason = json?.promptFeedback?.blockReason || json?.candidates?.[0]?.finishReason;
  throw new Error(`画像が返らなかった${reason ? `（${reason}）` : ''}: ${JSON.stringify(json).slice(0, 300)}`);
}

async function generate(prompt, options = {}) {
  const {
    model = process.env.GOOGLE_IMAGE_MODEL || DEFAULT_MODEL,
    aspect = '4:5',
    maxRetries = 4,
    key = requireKey(),
  } = options;

  const { url, body } = buildRequest(model, prompt, aspect);
  const payload = JSON.stringify(body);

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(Math.min(2 ** attempt, 30) * 1000);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: payload,
      });
    } catch (e) {
      lastError = new Error(`通信エラー: ${e.message}`);
      continue;
    }

    if (res.ok) {
      const b64 = extractImage(model, await res.json());
      return { buffer: Buffer.from(b64, 'base64'), revisedPrompt: null, model };
    }

    const detail = (await res.text()).slice(0, 500);
    lastError = new Error(`HTTP ${res.status}: ${detail}`);
    if (!RETRYABLE.has(res.status) || FATAL.test(detail)) break;
  }
  throw lastError;
}

module.exports = { generate, requireKey, DEFAULT_MODEL };
