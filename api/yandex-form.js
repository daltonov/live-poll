import { parse } from "querystring";

export const config = {
  api: {
    bodyParser: false,
  },
};

globalThis.votes = globalThis.votes || {};

export default function handler(req, res) {
  let rawBody = "";

  req.on("data", chunk => {
    rawBody += chunk.toString();
  });

  req.on("end", () => {
    const parsed = parse(rawBody);

    // 👇 ВАЖНО: берём КЛЮЧ, а не значение
    const variantId = Object.keys(parsed)[0];

    if (variantId) {
      globalThis.votes[variantId] =
        (globalThis.votes[variantId] || 0) + 1;
    }

    res.status(200).json({ ok: true });
  });
}
