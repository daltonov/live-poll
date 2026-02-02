// api/yandex-form.js
const { kv } = require("@vercel/kv");

/**
 * Map question.id -> вопрос (q1..q5)
 * Подставь свои id, которые ты дал:
 */
const QUESTION_MAP = {
  107664842: "q1",
  107665595: "q2",
  107665966: "q3",
  107716049: "q4",
  107716069: "q5",
};

function readRawBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    // на случай отсутствия body
    req.on("error", () => resolve(data));
  });
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Robust parse:
 * - try direct JSON.parse(raw)
 * - else extract substring between first { and last }
 * - then try iterative "unescape" passes (remove backslash-escapes for quotes/slashes)
 */
function robustParse(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();

  // 1) прямой парсинг
  let parsed = tryParseJSON(trimmed);
  if (parsed) {
    console.log("PARSER: direct JSON.parse OK");
    return parsed;
  }

  // 2) если тело — это строка-строка: try parse once to unquote a double-encoded JSON
  // например: raw == "\"{\\\"id\\\": ... }\""  -> JSON.parse -> string -> JSON.parse
  try {
    const once = tryParseJSON(trimmed);
    if (typeof once === "string") {
      const twice = tryParseJSON(once);
      if (twice) {
        console.log("PARSER: double-encoded JSON parsed (string -> JSON)");
        return twice;
      }
    }
  } catch (e) {
    // noop
  }

  // 3) Вырезаем от первого { до последнего }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    console.log("PARSER: no braces found");
    return null;
  }

  let candidate = trimmed.slice(first, last + 1);
  console.log("PARSER: candidate length", candidate.length);

  // 4) Попытки парсинга: прямой, затем пошаговое "распаковывание" экранирований
  parsed = tryParseJSON(candidate);
  if (parsed) {
    console.log("PARSER: candidate direct parse OK");
    return parsed;
  }

  // iterative unescape passes
  for (let pass = 1; pass <= 5; pass++) {
    // replace common escapes: \"  \\  \'
    // НЕ трогаем \uXXXX (unicode): заменяем только \\\" и двойные бэкраши
    candidate = candidate
      .replace(/\\"/g, '"')    // \" -> "
      .replace(/\\'/g, "'")    // \' -> '
      .replace(/\\\\/g, "\\"); // \\ -> \
    // возможно есть лишние внешние кавычки
    if (candidate.startsWith('"') && candidate.endsWith('"')) {
      candidate = candidate.slice(1, -1);
    }

    parsed = tryParseJSON(candidate);
    if (parsed) {
      console.log("PARSER: parse succeeded after unescape pass", pass);
      return parsed;
    }
    console.log("PARSER: pass", pass, "failed, len:", candidate.length);
  }

  // 5) если всё ещё не распарсилось — вернуть null
  console.log("PARSER: all attempts failed");
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  console.log("===== NEW YANDEX FORM EVENT =====");
  const raw = await readRawBody(req);
  console.log("RAW STRING:", raw && raw.slice(0, 1000)); // логируем начало

  const body = robustParse(raw);
  if (!body) {
    console.error("BODY PARSE FAILED");
    // для Яндекс-интеграции возвращаем 200 чтобы Яндекс видел успех, но отмечаем в теле
    return res.status(200).json({ ok: false, error: "body-parse-failed" });
  }

  // body должен содержать структуру answer.data
  // Пример структуры:
  // body.answer.data = { "answer_choices_9008...": { value: [ { key: "177..." , ... } ], question: { id: 1076... } } }
  const answerData = body?.answer?.data;
  if (!answerData || typeof answerData !== "object") {
    console.error("NO answer.data in parsed body");
    return res.status(200).json({ ok: false, error: "no-answer-data" });
  }

  // берем первый ключ в answerData — это поле выбора
  const answerKeys = Object.keys(answerData);
  if (answerKeys.length === 0) {
    console.error("answer.data has no keys");
    return res.status(200).json({ ok: false, error: "empty-answer-data" });
  }

  const firstKey = answerKeys[0];
  const answerObj = answerData[firstKey];
  const valEntry = answerObj?.value && Array.isArray(answerObj.value) ? answerObj.value[0] : null;
  const questionId = answerObj?.question?.id;

  if (!valEntry || !valEntry.key || !questionId) {
    console.error("MISSING value.key or question.id", { valEntry, questionId });
    return res.status(200).json({ ok: false, error: "missing-value-or-question" });
  }

  const choiceKey = valEntry.key;
  const qCode = QUESTION_MAP[questionId];
  if (!qCode) {
    console.error("UNKNOWN question.id", questionId);
    return res.status(200).json({ ok: false, error: "unknown-question-id", questionId });
  }

  const redisKey = `${qCode}:${choiceKey}`;
  console.log("COUNT KEY ->", redisKey);

  try {
    await kv.incr(redisKey);
  } catch (e) {
    console.error("KV.INCR ERROR", e && e.message);
    return res.status(500).json({ ok: false, error: "kv-error" });
  }

  return res.status(200).json({ ok: true });
};
