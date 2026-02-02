import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  try {
    console.log('KV ENV:', {
      url: process.env.KV_REST_API_URL?.slice(0, 30),
      token: !!process.env.KV_REST_API_TOKEN,
    })

    const allKeys = await kv.keys('*')
    console.log('KV KEYS:', allKeys)

    const data = {}
    for (const key of allKeys) {
      data[key] = await kv.get(key)
    }

    res.status(200).json(data)
  } catch (e) {
    console.error('STATS ERROR', e)
    res.status(500).json({ error: e.message })
  }
}
