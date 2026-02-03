import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'q is required' });
  }

  const key = `stats:${q}`;

  await kv.del(key);

  console.log(`RESET → ${key}`);

  res.json({ ok: true });
}
