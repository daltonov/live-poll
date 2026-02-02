import { parse } from "querystring";
import { kv } from "@vercel/kv";

export const config = {
  api: { bodyParser: false },
};

export default function handler(req, res) {
  let rawBody = "";

  req.on("data", chunk => {
    rawBody += chunk.toString();
  });

  req.on("end", async () => {
    const parsed = parse(rawBody);

    // ID варианта — это ключ
    const variantId = Object.keys(parsed)[0];

    if (variantId) {
      await kv.hincrby("votes", variantId, 1);
    }

    res.status(200).json({ ok: true });
  });
}
