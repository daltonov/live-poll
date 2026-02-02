// api/yandex-form.js
// CommonJS (не используем import) — Vercel functions ожидают так.
// Убедитесь, что @vercel/kv установлен и доступен в проде.
const { kv } = require('@vercel/kv');

module.exports.config = {
  api: { bodyParser: false }, // читаем raw body вручную
};

// Мэп question.id -> q1..q5
const QUESTION_MAP = {
  107664842: 'q1',
  107665595: 'q2',
  107665966: 'q3',
  107716049: 'q4',
  107716069: 'q5',
};

function readRawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    // на случай отсутствия body
    req.on('error', () => resolve(''));
  });
}

/**
 * Попытки безопасного парсинга:
 * 1) JSON.parse(raw) => если вернёт объект, ok
 * 2) Если вернул string => попытка JSON.parse(thatString)
 * 3) Если не получилось, ищем первую { и последнюю }, вырезаем и пробуем JSON.parse(sub)
 * 4) Если sub содержит одинарные кавычки (') — пробуем заменить ключи/значения на двойные кавычки
 * 5) Логируем все попытки и ошибки
 */
function safeParse(raw) {
  const tries = [];
  const note = (t, ok, detail) => tries.push({ t, ok, detail });

  try {
    const direct = JSON.parse(raw);
    note('direct JSON.parse', true, typeof direct);
    return { ok: true, obj: direct, tries };
  } catch (e) {
    note('direct JSON.parse', false, e.message);
  }

  // Вдруг raw — строка JSON, т.е. "\"{...}\"" либо startsWith '"' and contains \"
  try {
    const asString = JSON.parse(JSON.stringify(raw)); // just ensure string
    // if JSON.parse(raw) failed but raw itself is quoted JSON, try removing surrounding quotes
    if (typeof raw === 'string' && raw.length > 0) {
      // если raw начинается и заканчивается кавычками — уберём внешние
      const rtrim = raw.trim();
      if ((rtrim[0] === '"' && rtrim[rtrim.length - 1] === '"') || (rtrim[0] === "'" && rtrim[rtrim.length - 1] === "'")) {
        const inner = rtrim.slice(1, -1);
        try {
          const parsedInner = JSON.parse(inner);
          note('strip outer quotes -> JSON.parse', true, 'inner parsed');
          return { ok: true, obj: parsedInner, tries };
        } catch (e) {
          note('strip outer quotes -> JSON.parse', false, e.message);
        }
      }
    }
  } catch (e) {
    note('stringify-check', false, e.message);
  }

  // Попытка: найти первую { и последнюю } и вырезать подстроку
  const i1 = raw.indexOf('{');
  const i2 = raw.lastIndexOf('}');
  if (i1 !== -1 && i2 !== -1 && i2 > i1) {
    const candidate = raw.slice(i1, i2 + 1);
    try {
      const parsed = JSON.parse(candidate);
      note('substring {..} parse', true, 'parsed');
      return { ok: true, obj: parsed, tries };
    } catch (e) {
      note('substring {..} parse', false, e.message);
    }

    // Попробуем "подчистить" одинарные кавычки -> двойные (для случаев like {'id': 1, 'a': 'b'})
    try {
      // Step1: заменить `\'` на `'` (если есть экранирование)
      let s = candidate.replace(/\\'/g, "'");
      // Step2: заменить ключи 'key':  на "key":
      // аккуратно: ключи обычно бывают без пробелов внутри
      s = s.replace(/'([^']+?)'\s*:/g, (_m, g1) => {
        // если внутри есть двойные кавычки — экранируем их
        const escaped = g1.replace(/"/g, '\\"');
        return `"${escaped}":`;
      });
      // Step3: заменить оставшиеся одиночные кавычки вокруг строк -> двойные
      s = s.replace(/:\s*'([^']*?)'/g, (_m, g1) => {
        const escaped = g1.replace(/"/g, '\\"');
        return `: "${escaped}"`;
      });

      const parsed2 = JSON.parse(s);
      note("single-quote -> convert -> JSON.parse", true, 'parsed after conversion');
      return { ok: true, obj: parsed2, tries };
    } catch (e) {
      note("single-quote -> convert -> JSON.parse", false, e.message);
    }

    // Попробуем удалить слеш-экранирования перед кавычками (\" -> ")
    try {
      let s2 = candidate.replace(/\\"/g, '"').replace(/\\'/g, "'");
      const parsed3 = JSON.parse(s2);
      note('unescape backslashes -> JSON.parse', true, 'parsed after unescape');
      return { ok: true, obj: parsed3, tries };
    } catch (e) {
      note('unescape backslashes -> JSON.parse', false, e.message);
    }
  } else {
    note('no braces found', false, `i1=${i1}, i2=${i2}`);
  }

  return { ok: false, tries };
}

module.exports = async function handler(req, res) {
  console.log('===== NEW YANDEX FORM EVENT =====');

  try {
    const raw = (await readRawBody(req)) || '';
    console.log('RAW STRING:', raw);

    if (!raw || raw.trim().length === 0) {
      console.warn('RAW EMPTY');
      return res.status(200).json({ ok: false, error: 'empty body' });
    }

    const parsedResult = safeParse(raw);
    console.log('PARSE TRIES:', parsedResult.tries);

    if (!parsedResult.ok) {
      console.warn('ALL PARSE ATTEMPTS FAILED');
      return res.status(200).json({ ok: false, error: 'direct-json failed', detail: parsedResult.tries });
    }

    const payload = parsedResult.obj;
    // defensive logging
    // console.log('PARSED PAYLOAD:', JSON.stringify(payload).slice(0, 2000));

    // Navigate to answer.data -> take first key -> value[0].question.id
    const answer = payload?.answer;
    if (!answer) {
      console.warn('NO answer field in payload');
      return res.status(200).json({ ok: false, error: 'no answer' });
    }
    const dataObj = answer.data;
    if (!dataObj || typeof dataObj !== 'object') {
      console.warn('NO answer.data');
      return res.status(200).json({ ok: false, error: 'no answer.data' });
    }

    const dataKeys = Object.keys(dataObj);
    if (dataKeys.length === 0) {
      console.warn('answer.data empty');
      return res.status(200).json({ ok: false, error: 'answer.data empty' });
    }

    const firstKey = dataKeys[0];
    const entry = dataObj[firstKey];
    const value0 = entry?.value?.[0];

    if (!value0) {
      console.warn('NO value[0] under answer.data first key', firstKey);
      return res.status(200).json({ ok: false, error: 'no value' });
    }

    // question id может быть на value0.question.id
    const questionId = value0?.question?.id;
    const answerKey = value0?.key || value0?.value || null;

    console.log('RESOLVED first data key =>', firstKey);
    console.log('VALUE0:', typeof value0 === 'object' ? JSON.stringify(value0).slice(0, 300) : String(value0));
    console.log('QUESTION ID:', questionId, 'ANSWER KEY:', answerKey);

    if (!questionId) {
      console.warn('question id not found in parsed payload');
      return res.status(200).json({ ok: false, error: 'question id not found' });
    }

    const q = QUESTION_MAP[questionId];
    if (!q) {
      console.warn('question_id not mapped in QUESTION_MAP:', questionId);
      return res.status(200).json({ ok: false, error: 'question not mapped', questionId });
    }

    if (!answerKey) {
      console.warn('answer key missing (value0.key)');
      return res.status(200).json({ ok: false, error: 'answer key missing' });
    }

    // Записываем в KV: используем hash per question (stats:q1) и инкрементируем поле answerKey
    try {
      await kv.hincrby(`stats:${q}`, answerKey, 1);
      console.log('COUNT KEY ->', `${q}:${answerKey}`);
      return res.status(200).json({ ok: true, q, answerKey });
    } catch (e) {
      console.error('KV ERROR:', e);
      return res.status(200).json({ ok: false, error: 'kv error', detail: String(e) });
    }
  } catch (err) {
    console.error('YANDEX FORM ERROR:', err);
    // всегда 200 чтобы Яндекс не ретраил, но сообщаем что произошло
    return res.status(200).json({ ok: false, error: err.message || String(err) });
  }
};
