const { kv } = require('@vercel/kv');

const QUESTION_MAP = {
  107664842: 'q1',
  107665595: 'q2',
  107665966: 'q3',
  107716049: 'q4',
  107716069: 'q5',
};

module.exports = async function handler(req, res) {
  try {
    console.log('===== NEW YANDEX FORM EVENT =====');

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ✅ Vercel уже дал нам объект
    const body = req.body;

    if (!body || !body.answer || !body.answer.data) {
      console.warn('Invalid payload structure');
      return res.status(200).json({ ok: true });
    }

    // берём первый (и единственный) ключ answer_choices_XXXX
    const dataKeys = Object.keys(body.answer.data);
    if (!dataKeys.length) {
      console.warn('No answer data keys');
      return res.status(200).json({ ok: true });
    }

    const answerBlock = body.answer.data[dataKeys[0]];

    const questionId = answerBlock?.question?.id;
    const answerKey = answerBlock?.value?.[0]?.key;

    if (!questionId || !answerKey) {
      console.warn('questionId or answerKey missing');
      return res.status(200).json({ ok: true });
    }

    const questionCode = QUESTION_MAP[questionId];
    if (!questionCode) {
      console.warn('Unknown question id:', questionId);
      return res.status(200).json({ ok: true });
    }

    const kvKey = `${questionCode}:${answerKey}`;

    console.log('COUNT →', kvKey);

    await kv.incr(kvKey);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('YANDEX FORM ERROR:', err);
    return res.status(500).json({ error: 'internal error' });
  }
};
