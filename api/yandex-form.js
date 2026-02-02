// /api/yandex-form.js
import { kv } from '@vercel/kv'

export const config = {
  api: { bodyParser: false },
}

function tryParseJson(s) {
  try {
    return JSON.parse(s)
  } catch (e) {
    return null
  }
}

export default async function handler(req, res) {
  try {
    // read raw body
    let raw = ''
    await new Promise((resolve) => {
      req.on('data', (chunk) => (raw += chunk.toString()))
      req.on('end', resolve)
    })

    console.log('RAW BODY:', raw)

    let parsed = null

    // 1) пробуем прямой JSON
    parsed = tryParseJson(raw)

    // 2) если не JSON — возможно form-urlencoded (answer=...), парсим
    if (!parsed && raw.includes('=')) {
      try {
        const params = new URLSearchParams(raw)
        const ans = params.get('answer') || params.get('Ответ на вопрос') || params.get('response')
        if (ans) {
          // если значение — JSON-подстрока, пробуем распарсить её
          parsed = tryParseJson(ans) || { answer: ans }
        }
      } catch (e) {
        // ignore
      }
    }

    // 3) если не получилось — возможно внутри строки экранированные кавычки: \" ... \"
    if (!parsed) {
      // убираем типичные экранирования сверху
      let norm = raw.replace(/\\'/g, "'").replace(/\\"/g, '"')
      // если строка заключена в кавычки, снимаем их
      norm = norm.replace(/^"(.*)"$/, '$1')
      norm = norm.replace(/^'(.*)'$/, '$1')

      parsed = tryParseJson(norm)
    }

    // 4) если всё ещё не получилось — попытка извлечь первую {...} подстроку и распарсить её
    if (!parsed) {
      const first = raw.indexOf('{')
      const last = raw.lastIndexOf('}')
      if (first !== -1 && last !== -1 && last > first) {
        let sub = raw.slice(first, last + 1)
        sub = sub.replace(/\\+"/g, '"').replace(/\\'/g, "'") // убрать лишние escape
        parsed = tryParseJson(sub)
      }
    }

    if (!parsed) {
      console.log('PARSING FAILED, returning ok')
      return res.status(200).json({ ok: true }) // не ломаем форму
    }

    // --- теперь разбираем parsed, ищем answer.data[...] → value[0].key
    const answerData =
      parsed?.answer?.data ||
      // возможный другой путь: parsed.params.responses...
      parsed?.params?.responses ||
      parsed?.params?.answer ||
      null

    let answerKey = null

    if (answerData && typeof answerData === 'object') {
      // если answerData — объект с ключом типа answer_choices_...
      const qKey = Object.keys(answerData)[0]
      const choice = qKey ? answerData[qKey]?.value?.[0] : null
      answerKey = choice?.key || choice?.id || null
    }

    // ещё варианты: если parsed.answer уже простая строк / id
    if (!answerKey) {
      if (typeof parsed?.answer === 'string') {
        answerKey = parsed.answer
      } else if (parsed?.answer?.value) {
        answerKey = parsed.answer.value
      }
    }

    if (!answerKey) {
      console.log('NO ANSWER KEY FOUND, parsed:', parsed)
      return res.status(200).json({ ok: true })
    }

    console.log('ANSWER KEY:', answerKey)

    // write to KV
    const votes = (await kv.get('votes')) || {}
    votes[answerKey] = (votes[answerKey] || 0) + 1
    await kv.set('votes', votes)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('YANDEX FORM ERROR', e)
    return res.status(500).json({ error: e.message })
  }
}
