// api/yandex-form.js
const { kv } = require('@vercel/kv');

module.exports.config = {
  api: { bodyParser: false },
};

// === ВОПРОСЫ ===
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
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

module.exports = async function handler(req, res) {
  console.log('===== NEW YANDEX FORM EVENT =====');

  try {
    const raw = await readRawBody(req);
    console.log('RAW STRING:', raw);

    if (!raw) {
      console.warn('EMPTY BODY');
      return res.status(200).json({ ok: false, error: 'empty body' });
    }

    // 🔥 ЯНДЕКС ПРИСЫЛАЕТ КОРРЕКТНЫЙ JSON — parse напрямую
    const payload = JSON.parse(raw);
    console.log('PARSE OK');

    const answer = payload.answer;
    if (!answer || !answer.data) {
      console.warn('NO answer.data');
      return res.status(200).json({ ok: false, error: 'no answer.data' });
    }

    // === ГЛАВНОЕ МЕСТО ===
    const dataKeys = Object.keys(answer.data);
    if (dataKeys.length === 0) {
      console.warn('answer.data empty');
      return res.status(200).json({ ok: false });
    }

    const entry = answer.data[dataKeys[0]];
    const value = entry.value?.[0];

    if (!value || !value.question || !value.question.id) {
      console.warn('question.id NOT FOUND', value);
      return res.status(200).json({ ok: false, error: 'question.id not found' });
    }

    const questionId = value.question.id;
    const answerKey = value.key;

    console.log('QUESTION ID:', questionId);
    console.log('ANSWER KEY:', answerKey);

    const q = QUESTION_MAP[questionId];
    if (!q) {
      console.warn('UNKNOWN QUESTION:', questionId);
      return res.status(200).json({ ok: false, error: 'unknown question' });
    }

    // === СЧЁТЧИК ===
    await kv.hincrby(`stats:${q}`, answerKey, 1);
    console.log(`COUNTED → stats:${q} ${answerKey}`);

    return res.status(200).json({ ok: true, q, answerKey });
  } catch (err) {
    console.error('YANDEX FORM ERROR:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
