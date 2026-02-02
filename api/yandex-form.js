const { kv } = require("@vercel/kv");

/**
 * Соответствие question.id → номер вопроса
 */
const QUESTION_MAP = {
  107664842: "q1", // первая форма
  107665595: "q2", // вторая форма
  107665966: "q3", // третья форма
  107716049: "q4", // четвертая форма
  107716069: "q5", // пятая форма
};

/**
 * Читаем raw body вручную
 */
function readRawBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

/**
 * Надежный парсер Яндекс Форм
 * (вытаскивает JSON между { ... })
 */
function safeParse(raw) {
  if (!raw) return null;

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1) return null;

  const jsonString = raw.slice(start, end + 1);

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("JSON.parse failed");
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  console.log("===== NEW YANDEX FORM EVENT =====");

  const raw = await readRawBody(req);
  console.log("RAW STRING:", raw.slice(0, 500));

  const body = safeParse(raw);
  if (!body) {
    console.log("❌ BODY PARSE FAILED");
    return res.status(200).json({ ok: false });
  }

  const answer = body?.answer?.data;
  if (!answer) {
    console.log("❌ NO answer.data");
    return res.status(200).json({ ok: false });
  }

  const answerKey = Object.keys(answer)[0];
  const value = answer[answerKey]?.value?.[0];
  const questionId = answer[answerKey]?.question?.id;

  if (!value || !questionId) {
    console.log("❌ NO value OR questionId");
    return res.status(200).json({ ok: false });
  }

  const questionCode = QUESTION_MAP[questionId];
  if (!questionCode) {
    console.log("❌ UNKNOWN question.id:", questionId);
    return res.status(200).json({ ok: false });
  }

  const choiceKey = value.key;
  const redisKey = `${questionCode}:${choiceKey}`;

  console.log(`✅ COUNTED → ${redisKey}`);

  await kv.incr(redisKey);

  return res.status(200).json({ ok: true });
};
