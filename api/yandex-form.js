import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    const data = body?.answer?.data;
    if (!data) {
      return res.status(400).json({ error: "No answer data" });
    }

    // 1. Получаем ID вопроса
    const questionKey = Object.keys(data)[0]; 
    // example: answer_choices_9008969287495760

    const QUESTION_MAP = {
      "answer_choices_9008969287495760": 1,
      "answer_choices_9008969287733368": 2,
      "answer_choices_9008969287833068": 3,
      "answer_choices_9008969313885372": 4,
      "answer_choices_9008969313915496": 5
    };

    const questionNumber = QUESTION_MAP[questionKey];
    if (!questionNumber) {
      return res.status(400).json({ error: "Unknown question" });
    }

    // 2. Получаем ID варианта ответа
    const answerKey = data[questionKey]?.value?.[0]?.key;
    if (!answerKey) {
      return res.status(400).json({ error: "No answer key" });
    }

    // 3. Увеличиваем счётчик
    const redisKey = `votes:q${questionNumber}`;
    await kv.hincrby(redisKey, answerKey, 1);

    return res.status(200).json({
      ok: true,
      question: questionNumber,
      answer: answerKey
    });

  } catch (e) {
    console.error("YANDEX FORM ERROR", e);
    return res.status(500).json({ error: e.message });
  }
}
