// api/yandex-form.js
import { kv } from '@vercel/kv';

export const config = {
  api: {
    bodyParser: false,
  },
};

const QUESTION_MAP = {
  107664842: 'q1',
  107665595: 'q2',
  107665966: 'q3',
  107716049: 'q4',
  107716069: 'q5',
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function safeParse(raw) {
  let s = raw.trim();

  // Убираем обёртку (" ... ")
  if (s.startsWith('("') && s.endsWith('")')) {
    s = s.slice(2, -2);
  }

  // Первый parse
  let parsed = JSON.parse(s);

  // Если это всё ещё строка — парсим второй раз
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }

  return parsed;
}

export default async function handler(req, res) {
  try {
    console.log('===== NEW YANDEX FORM EVENT =====');

    const raw = await readRawBody(req);
    console.log('RAW STRING:', raw);

    if (!raw) {
      return res.status(400).json({ error: 'empty body' });
    }

    const data = safeParse(raw);

    const answer = data?.answer;
    if (!answer?.data) {
      return res.status(400).json({ error: 'no answer.data' });
    }

    const dataKey = Object.keys(answer.data)[0];
    const value = answer.data[dataKey]?.value?.[0];

    if (!value) {
      return res.status(400).json({ error: 'no value' });
    }

    const answerKey = value.key;
    const questionId = value.question.id;

    const q = QUESTION_MAP[questionId];
    if (!q) {
      return res.status(400).json({ error: 'unknown question' });
    }

    const redisKey = `stats:${q}`;
    await kv.hincrby(redisKey, answerKey, 1);

    console.log(`COUNTED → ${redisKey} [${answerKey}]`);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('YANDEX FORM ERROR:', err);
    return res.status(500).json({ error: 'internal error' });
  }
}
