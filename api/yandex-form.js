import { kv } from "@vercel/kv";

export const config = {
  api: {
    bodyParser: false, // обязательно — читаем raw
  },
};

const QUESTION_MAP = {
  107664842: "q1",
  107665595: "q2",
  107665966: "q3",
  107716049: "q4",
  107716069: "q5",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function tryParseJsonMaybeDouble(input) {
  // Попытки парсинга:
  // 1) JSON.parse(raw)
  // 2) если результат строка -> JSON.parse(result)
  // возвращает { ok: true, value: obj, method: "direct"|"double" } или { ok:false, error }
  try {
    const r1 = JSON.parse(input);
    if (typeof r1 === "string") {
      // JSON: "\"{...}\"" → r1 is inner JSON text
      try {
        const r2 = JSON.parse(r1);
        return { ok: true, value: r2, method: "double-json" };
      } catch (e2) {
        return { ok: false, error: "double-json failed", detail: e2.message };
      }
    } else {
      return { ok: true, value: r1, method: "direct-json" };
    }
  } catch (e) {
    return { ok: false, error: "direct-json failed", detail: e.message };
  }
}

export default async function handler(req, res) {
  try {
    const raw = (await readBody(req)) || "";

    console.log("===== NEW YANDEX FORM EVENT =====");
    console.log("RAW STRING:", raw.slice(0, 2000)); // показываем до 2000 символов

    // 1) Попытка 1: прямой JSON / двойной JSON
    let parsed = tryParseJsonMaybeDouble(raw);
    if (!parsed.ok) {
      // 2) Попытка 2: urlencoded (payload=... или любое поле=...),
      //    возьмём первое значение из URLSearchParams и попытаемся парсить
      try {
        if (raw.includes("=") && (raw.includes("%") || raw.includes("&") || raw.includes("="))) {
          const params = new URLSearchParams(raw);
          const firstValue = params.values().next().value;
          if (firstValue) {
            console.log("Attempt: detected urlencoded, using first param value (decoded)");
            parsed = tryParseJsonMaybeDouble(firstValue);
          } else {
            console.log("Attempt: urlencoded but no param value found");
          }
        }
      } catch (e) {
        console.warn("URLSearchParams parsing failed:", e.message);
      }
    }

    // 3) Попытка 3: найти JSON-подстроку по первым { ... } — как крайняя мера
    if (!parsed.ok) {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const sub = raw.slice(firstBrace, lastBrace + 1);
        console.log("Attempt: extracting substring between braces for parse (length):", sub.length);
        parsed = tryParseJsonMaybeDouble(sub);
      }
    }

    if (!parsed.ok) {
      console.warn("ALL PARSE ATTEMPTS FAILED:", parsed);
      // Отвечаем 200, чтобы Яндекс не ретраил — но логируем
      return res.status(200).json({ ok: false, note: "could not parse body" });
    }

    const body = parsed.value;
    console.log("PARSED BY:", parsed.method);
    console.log("PARSED BODY (short):", JSON.stringify(body).slice(0, 2000));

    const answerData = body?.answer?.data;
    if (!answerData || typeof answerData !== "object") {
      console.log("NO answer.data — nothing to count");
      return res.status(200).json({ ok: true });
    }

    // Пройдёмся по каждому блоку (обычно один)
    for (const blockKey of Object.keys(answerData)) {
      const block = answerData[blockKey];
      const questionId = block?.question?.id;
      if (!questionId) {
        console.log("Block has no question.id, skipping. blockKey=", blockKey);
        continue;
      }

      const qKey = QUESTION_MAP[questionId];
      if (!qKey) {
        console.log("Unknown question id:", questionId, " — skipping");
        continue;
      }

      const values = Array.isArray(block.value) ? block.value : [];
      if (values.length === 0) {
        console.log("No value array for block", blockKey);
        continue;
      }

      for (const v of values) {
        const answerKey = v?.key;
        if (!answerKey) {
          console.log("Value has no key, skipping value:", v);
          continue;
        }

        // Redis key: qN:answerKey
        const redisKey = `${qKey}:${answerKey}`;

        // Инкремент
        await kv.incr(redisKey);

        console.log(`COUNTED → ${redisKey}`);
      }
    }

    console.log("===== END EVENT =====");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("YANDEX FORM HANDLER ERROR", err);
    return res.status(200).json({ ok: true });
  }
}
