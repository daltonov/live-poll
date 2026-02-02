import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const q = req.query.question;
  if (!q) {
    return res.status(400).json({ error: "question is required" });
  }

  const data = await kv.hgetall(`votes:q${q}`);
  res.status(200).json(data || {});
}
