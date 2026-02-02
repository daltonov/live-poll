export const config = {
  api: {
    bodyParser: false, // 🔴 КЛЮЧЕВО
  },
};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    const raw = await readBody(req);

    console.log("===== NEW YANDEX FORM EVENT =====");
    console.log("RAW STRING:", raw);

    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      console.log("JSON PARSE FAILED");
      return res.status(200).json({ ok: true });
    }

    console.log("PARSED BODY:", JSON.stringify(body, null, 2));

    const data = body?.answer?.data;

    if (!data) {
      console.log("NO answer.data");
      return res.status(200).json({ ok: true });
    }

    for (const key of Object.keys(data)) {
      const block = data[key];

      console.log("ANSWER BLOCK KEY:", key);

      if (block?.question) {
        console.log("QUESTION ID:", block.question.id);
        console.log("QUESTION SLUG:", block.question.slug);
      }

      if (block?.value?.length) {
        console.log(
          "ANSWER VALUE KEYS:",
          block.value.map(v => v.key)
        );
      }
    }

    console.log("===== END EVENT =====");

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error("YANDEX FORM ERROR", e);
    return res.status(200).json({ ok: true });
  }
}
