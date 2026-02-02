import { kv } from '@vercel/kv'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  try {
    let rawBody = ''

    await new Promise((resolve) => {
      req.on('data', (chunk) => {
        rawBody += chunk.toString()
      })
      req.on('end', resolve)
    })

    console.log('RAW BODY:', rawBody)

    // 🔧 FIX: Яндекс присылает python-repr, а не JSON
    const normalized = rawBody
      .replace(/\\'/g, '"') // \' → "
      .replace(/^'/, '')
      .replace(/'$/, '')

    const parsed = JSON.parse(normalized)

    // 1️⃣ answer.data
    const answerData = parsed?.answer?.data
    if (!answerData) {
      console.log('NO answer.data')
      return res.status(200).json({ ok: true })
    }

    // 2️⃣ первый ключ вопроса
    const questionKey = Object.keys(answerData)[0]
    const choice = answerData[questionKey]?.value?.[0]

    // 3️⃣ ID варианта ответа
    const answerKey = choice?.key
    if (!answerKey) {
      console.log('NO answer key')
      return res.status(200).json({ ok: true })
    }

    console.log('ANSWER KEY:', answerKey)

    // 4️⃣ Redis
    const votes = (await kv.get('votes')) || {}
    votes[answerKey] = (votes[answerKey] || 0) + 1
    await kv.set('votes', votes)

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('YANDEX FORM ERROR', e)
    res.status(500).json({ error: e.message })
  }
}
