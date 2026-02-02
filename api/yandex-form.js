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

    const parsed = JSON.parse(rawBody)

    // 1️⃣ Достаём answer.data
    const answerData = parsed?.answer?.data
    if (!answerData) {
      console.log('NO answer.data')
      return res.status(200).json({ ok: true })
    }

    // 2️⃣ Берём первый ключ (answer_choices_XXXX)
    const firstQuestionKey = Object.keys(answerData)[0]
    if (!firstQuestionKey) {
      console.log('NO question key')
      return res.status(200).json({ ok: true })
    }

    // 3️⃣ Берём value[0].key → ID варианта ответа
    const choice = answerData[firstQuestionKey]?.value?.[0]
    const answerKey = choice?.key

    if (!answerKey) {
      console.log('NO answer key')
      return res.status(200).json({ ok: true })
    }

    console.log('ANSWER KEY:', answerKey)

    // 4️⃣ Пишем в Redis
    const votes = (await kv.get('votes')) || {}
    votes[answerKey] = (votes[answerKey] || 0) + 1
    await kv.set('votes', votes)

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('YANDEX FORM ERROR', e)
    res.status(500).json({ error: e.message })
  }
}
