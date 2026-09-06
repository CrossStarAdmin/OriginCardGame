// 日本語プロンプトを画像API向けの英文に訳す
// 同じ日本語なら訳し直さない（イラスト/<デッキ>/<カード>.json に前回の対が入っている）
const { apiKey } = require('./providers/env.js');

const MODEL = process.env.GOOGLE_TEXT_MODEL || 'gemini-flash-latest';
const URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const INSTRUCTION = [
  'You translate Japanese art directions into a single English prompt for an image generation model.',
  'Rules:',
  '- Translate faithfully. Do not add subjects, objects, colours, moods or details that are not in the Japanese.',
  '- Do not drop anything either. Every 【section】 must survive.',
  '- Keep the section order. Render each 【label】 as an English label followed by a colon, one per line.',
  '- Use plain descriptive English of the kind image models respond to. No markdown, no commentary, no quotes.',
  'Output only the finished prompt.',
].join('\n');

async function translate(japanese, options = {}) {
  const { model = MODEL, key = apiKey(['GEMINI_API_KEY', 'GOOGLE_API_KEY'], 'https://aistudio.google.com/apikey で発行'), maxRetries = 3 } = options;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: INSTRUCTION }] },
    contents: [{ parts: [{ text: japanese }] }],
    generationConfig: { temperature: 0 },
  });

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(2 ** attempt, 20) * 1000));
    let res;
    try {
      res = await fetch(URL(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
      });
    } catch (e) {
      lastError = new Error(`翻訳の通信エラー: ${e.message}`);
      continue;
    }
    if (res.ok) {
      const json = await res.json();
      const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
      if (text) return text;
      lastError = new Error(`翻訳が空で返った: ${JSON.stringify(json).slice(0, 300)}`);
      continue;
    }
    const detail = (await res.text()).slice(0, 400);
    lastError = new Error(`翻訳 HTTP ${res.status}: ${detail}`);
    if (![408, 429, 500, 502, 503, 504].includes(res.status)) break;
  }
  throw lastError;
}

module.exports = { translate, MODEL };
