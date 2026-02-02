// api/yandex-form.js
const { kv } = require('@vercel/kv');

module.exports.config = {
  api: { bodyParser: false },
};

const QUESTION_MAP = {
  107664842: 'q1',
  107665595: 'q2',
  107665966: 'q3',
  107716049: 'q4',
  107716069: 'q5',
};

function readRawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

function safeParse(raw) {
  const tries = [];

  try {
    return { ok: true, obj: JSON.parse(raw), tries };
  } catch (e) {
    tries.push({ step: 'direct', error: e.message });
  }

  const i1 = raw.indexOf('{');
  const i2 = raw.lastIndexOf('}');
  if (i1 !== -1 && i2 !== -1) {
    const sub = raw.slice(i1, i2 + 1);
    try {
      return { ok: true, obj: JSON.parse(sub), tries };
    } catch (e) {
      tries.push({ step: 'substring', error: e.message });
    }

    try {
      const cleaned = sub.replace(/\\"/g, '"');
      return { ok: true, obj: JSON.parse(cleaned), tries };
    } catch (e) {
      tries.push({ step: 'unescape', error: e.message });
    }
  }

  return { ok: false, tries };
}

module.exports = async function handler(req, res) {
  console.log('===== NEW YANDEX FORM EVENT =====');

  const raw = await readRawBody(req);
  console.log('RAW STRING:', raw);

  if (!raw) {
    return res.status(200).json({ ok: false, error: 'empty body' });
  }

  const parsed = safeParse(raw);
  console.log('PARSE TRIES:', parsed.tries);

  if (!parsed.ok) {
    return res.status(200).json({ ok: false, error: 'parse failed' });
  }

  const payload = parsed.obj;
  const answer = payload?.answer;
  if (!answer?.data) {
    return res.status(200).json({ ok: false, error: 'no answer.data' });
  }

  const dataKeys = Object.keys(answer.data);
  const firstKey = dataKeys[0];
  const entry = answer.data[firstKey];

  const value0 = entry?.value?.[0];
  const answerKey = value0?.key;

  // 🔴 ВАЖНОЕ ИСПРАВЛЕНИЕ ЗДЕСЬ
  const questionId = entry?.question?.id;

  console.log('DATA KEY:', firstKey);
  console.log('ANSWER KEY:', answerKey);
  console.log('QUESTION ID:', questionId);

  if (!questionId) {
    console.warn('question id not found in parsed payload');
    return res.status(200).json({ ok: false, error: 'question id not found' });
  }

  const q = QUESTION_MAP[questionId];
  if (!q) {
    console.warn('question not mapped:', questionId);
    return res.status(200).json({ ok: false, error: 'question not mapped' });
  }

  if (!answerKey) {
    return res.status(200).json({ ok: false, error: 'answer key missing' });
  }

  await kv.hincrby(`stats:${q}`, answerKey, 1);
  console.log(`COUNTED -> stats:${q} ${answerKey}`);

  return res.status(200).json({ ok: true, q, answerKey });
};
