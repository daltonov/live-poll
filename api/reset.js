import { kv } from "@vercel/kv"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Получаем все ключи
    const keys = await kv.keys("*")

    // Удаляем только голоса
    for (const key of keys) {
      await kv.del(key)
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error("RESET ERROR", err)
    res.status(500).json({ error: "Reset failed" })
  }
}
