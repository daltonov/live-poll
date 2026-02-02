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
    console.log("RAW BODY:", rawBody);

    const parsed = parse(rawBody);
    console.log("PARSED BODY:", parsed);

    // берём ID варианта (ключ)
    const variantId = Object.keys(parsed)[0];

    if (variantId) {
      globalThis.votes[variantId] =
        (globalThis.votes[variantId] || 0) + 1;
    }

    res.status(200).json({ ok: true });
  });
}
