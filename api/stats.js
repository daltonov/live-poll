// api/stats.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // принимаем ?q=q1
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'q is required (q1..q5)' });
    }

    const redisKey = `stats:${q}`;

    const data = await kv.hgetall(redisKey);

    // если данных нет — вернуть пустой объект, а не ошибку
    return res.status(200).json(data || {});
  } catch (err) {
    console.error('STATS ERROR', err);
    return res.status(500).json({ error: 'internal error' });
  }
}
