import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const { question } = req.query;

    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    const key = `votes:q${question}`;

    const data = await kv.hgetall(key);

    res.status(200).json(data || {});
  } catch (err) {
    console.error('STATS ERROR', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
