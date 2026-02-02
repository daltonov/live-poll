import { parse } from "querystring";

// хранилище голосов
globalThis.votes = globalThis.votes || {};

export const config = {
  api: {
    bodyParser: false, // ⬅️ ВАЖНО
  },
};

export default async function handler(req, res) {
  let body = "";

  req.on("data", chunk => {
    body += chunk.toString();
  });

  req.on("end", () => {
    // body вида: answer=abc123
    const parsed = parse(body);
    const variantId = parsed.answer;

    if (variantId) {
      globalThis.votes[variantId] =
        (globalThis.votes[variantId] || 0) + 1;
    }

    res.status(200).json({ ok: true });
  });
}
