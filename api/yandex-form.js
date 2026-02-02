const { kv } = require("@vercel/kv");

exports.config = {
  api: {
    bodyParser: false,
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

module.exports = async function handler(req, res) {
  try {
    const raw = (await readBody(req)) || "";

    console.log("===== NEW YANDEX FORM EVENT =====");
    console.log("RAW STRING:", raw.slice(0, 2000));

    let jsonText = raw;

    // 🔑 убираем экранирование
    if (jsonText.trim().startsWith("\\{")) {
      console.log("Detected escaped JSON, unescaping...");
      jsonText = jsonText.replace(/\\"/g, '"');
    }

    let body;
    try {
      body = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON.parse FAILED");
      console.error(jsonText.slice(0, 500));
      return res.status(200).json({ ok: false });
    }

    const answerData = body?.answer?.data;
    if (!answerData) {
      console.log("NO answer.data");
      return res.status(200).json({ ok: true });
    }

    for (const block of Object.values(answerData)) {
      const questionId = block?.question?.id;
      const values = block?.value;

      if (!questionId || !QUESTION_MAP[questionId]) {
        console.log("Unknown question:", questionId);
        continue;
      }

      const qKey = QUESTION_MAP[questionId];

      if (!Array.isArray(values)) continue;

      for (const v of values) {
        const answerKey = v?.key;
        if (!answerKey) continue;

        const redisKey = `${qKey}:${answerKey}`;
        await kv.incr(redisKey);

        console.log("COUNTED:", redisKey);
      }
    }

    console.log("===== END EVENT =====");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("HANDLER ERROR:", err);
    return res.status(200).json({ ok: true });
  }
};
