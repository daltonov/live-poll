import { kv } from "@vercel/kv";

export const config = {
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
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    const raw = await readBody(req);

    console.log("===== NEW YANDEX FORM EVENT =====");
    console.log("RAW:", raw);

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      console.log("❌ JSON parse failed");
      return res.status(200).json({ ok: true });
    }

    const answerData = body?.answer?.data;

    if (!answerData) {
      console.log("❌ NO answer.data");
      return res.status(200).json({ ok: true });
    }

    for (const block of Object.values(answerData)) {
      const questionId = block?.question?.id;

      if (!questionId) continue;

      const questionKey = QUESTION_MAP[questionId];

      if (!questionKey) {
        console.log("⚠️ UNKNOWN QUESTION ID:", questionId);
        continue;
      }

      const values = block?.value || [];

      for (const v of values) {
        const answerKey = v.key;

        if (!answerKey) continue;

        const redisKey = `${questionKey}:${answerKey}`;

        await kv.incr(redisKey);

        console.log(
          `✅ COUNTED → ${redisKey}`
        );
      }
    }

    console.log("===== END EVENT =====");

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error("🔥 YANDEX FORM ERROR", e);
    return res.status(200).json({ ok: true });
  }
}
