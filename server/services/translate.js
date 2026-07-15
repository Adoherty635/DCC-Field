const config = require('../config');

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `You translate short work instructions from English to natural, everyday
US jobsite Spanish for commercial painting crews. Keep it plain and direct, the
way a foreman would say it out loud — not formal or literary.

Rules:
- Keep product names, paint color codes (e.g. "SW 7029"), manufacturer names,
  measurements, addresses, and times UNCHANGED — do not translate or convert them.
- Preserve the original line breaks exactly.
- Return ONLY the translation. No preamble, no notes, no quotes around it.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  const status = err?.status || err?.statusCode;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('overloaded');
}

async function translateToSpanish(text) {
  if (!config.anthropicConfigured) return null;
  if (!text || !text.trim()) return '';

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const attempt = async () => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    });
    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
  };

  try {
    return await attempt();
  } catch (err) {
    if (isRetryable(err)) {
      await sleep(800);
      try {
        return await attempt();
      } catch (err2) {
        console.error('[translate] retry failed:', err2.message);
        return null;
      }
    }
    console.error('[translate] failed:', err.message);
    return null;
  }
}

module.exports = { translateToSpanish };
