import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  try {
    const stats = await kv.get('poll:stats')
    res.status(200).json(stats ?? {})
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'stats failed' })
  }
}
