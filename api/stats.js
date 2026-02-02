import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const votes = (await kv.hgetall("votes")) || {};

  const labels = Object.keys(votes);
  const values = Object.values(votes).map(Number);

  const total = values.reduce((a, b) => a + b, 0);
  const percents = values.map(v =>
    total === 0 ? 0 : Math.round((v / total) * 100)
  );

  res.json({ labels, values, percents, total });
}
