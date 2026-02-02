await kv.del('votes')
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  try {
    const votes = (await kv.get('votes')) || {}
    res.status(200).json(votes)
  } catch (e) {
    console.error('STATS ERROR', e)
    res.status(500).json({ error: e.message })
  }
}
