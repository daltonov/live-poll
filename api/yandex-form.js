import { kv } from '@vercel/kv';

const QUESTION_MAP = {
  9008969287495760: 1,
  9008969287733368: 2,
  9008969287833068: 3,
  9008969313885372: 4,
  9008969313915496: 5
};

export default async function handler(req, res) {
  try {
    const raw = req.body;

    if (!raw?.answer?.data) {
      return res.status(200).end();
    }

    const questionId = raw.answer.question.id;
    const questionNumber = QUESTION_MAP[questionId];

    if (!questionNumber) {
      console.warn('Unknown question id', questionId);
      return res.status(200).end();
    }

    const redisKey = `votes:q${questionNumber}`;

    const answers =
      raw.answer.data.answer_choices_9008969287495760?.value || [];

    for (const item of answers) {
      await kv.hincrby(redisKey, item.key, 1);
    }

    res.status(200).end();
  } catch (err) {
    console.error('YANDEX FORM ERROR', err);
    res.status(500).end();
  }
}
