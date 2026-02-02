import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  try {
    const { answer } = req.body
    if (!answer) return res.status(400).json({ ok: false })

    const votes = (await kv.get('votes')) || {}
    votes[answer] = (votes[answer] || 0) + 1

    await kv.set('votes', votes)

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
