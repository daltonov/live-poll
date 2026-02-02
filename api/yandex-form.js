// api/yandex-form.js
import { kv } from '@vercel/kv';

const QUESTION_MAP = {
  107664842: 'q1',
  107665595: 'q2',
  107665966: 'q3',
  107716049: 'q4',
  107716069: 'q5',
};

export default async function handler(req, res) {
  try {
    console.log('===== NEW YANDEX FORM EVENT =====');

    // Yandex Forms присылает body как string
    const raw = req.body;
    console.log('RAW STRING:', raw);

    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ error: 'empty body' });
    }

    // 1️⃣ Парсим JSON (он уже валидный, просто экранирован)
    const data = JSON.parse(raw);

    const answer = data?.answer;
    if (!answer?.data) {
      return res.status(400).json({ error: 'no answer.data' });
    }

    // 2️⃣ Берём первый вариант ответа
    const dataKey = Object.keys(answer.data)[0];
    const value = answer.data[dataKey]?.value?.[0];

    if (!value) {
      return res.status(400).json({ error: 'no answer value' });
    }

    const answerKey = value.key; // ← ID варианта ответа
    const questionId = value.question?.id;

    console.log('QUESTION ID:', questionId);
    console.log('ANSWER KEY:', answerKey);

    // 3️⃣ Определяем номер вопроса
    const q = QUESTION_MAP[questionId];
    if (!q) {
      return res.status(400).json({ error: 'unknown question' });
    }

    // 4️⃣ ПИШЕМ В ОДИН HASH
    const redisKey = `stats:${q}`;

    await kv.hincrby(redisKey, answerKey, 1);

    console.log(`COUNTED → ${redisKey} [${answerKey}]`);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('YANDEX FORM ERROR', err);
    return res.status(500).json({ error: 'internal error' });
  }
}
