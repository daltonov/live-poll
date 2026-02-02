export default async function handler(req, res) {
  try {
    const body = req.body;

    console.log("===== NEW YANDEX FORM EVENT =====");
    console.log("RAW BODY:", JSON.stringify(body, null, 2));

    const data = body?.answer?.data;

    if (!data || typeof data !== "object") {
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
    console.error("YANDEX FORM PARSER ERROR", e);
    return res.status(200).json({ ok: true });
  }
}
