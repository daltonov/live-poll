import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const body = req.body;

    if (!body?.answer?.data) {
      return res.status(200).end();
    }

    // 1️⃣ Берём ключ вида answer_choices_XXXX
    const answerData = body.answer.data;
    const answerChoiceKey = Object.keys(answerData)[0];

    if (!answerChoiceKey) {
      console.warn("No answer_choices key");
      return res.status(200).end();
    }

    // 2️⃣ Маппинг answer_choices → номер вопроса
    const ANSWER_CHOICES_MAP = {
      "answer_choices_9008969287495760": 1,
      "answer_choices_9008969287733368": 2,
      "answer_choices_9008969287833068": 3,
      "answer_choices_9008969313885372": 4,
      "answer_choices_9008969313915496": 5
    };

    const questionNumber = ANSWER_CHOICES_MAP[answerChoiceKey];

    if (!questionNumber) {
      console.warn("Unknown answer choice:", answerChoiceKey);
      return res.status(200).end();
    }

    // 3️⃣ Ключ Redis
    const redisKey = `votes:q${questionNumber}`;

    // 4️⃣ Сами ответы
    const values = answerData[answerChoiceKey]?.value || [];

    for (const v of values) {
      await kv.hincrby(redisKey, v.key, 1);
    }

    res.status(200).end();
  } catch (err) {
    console.error("YANDEX FORM ERROR", err);
    res.status(500).end();
  }
}
