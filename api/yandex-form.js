// api/yandex-form.js
// CommonJS version — require() и module.exports
const { kv } = require('@vercel/kv');

// Tell Vercel not to parse the body (we read raw)
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      resolve(buf.toString('utf8'));
    });
    req.on('error', reject);
  });
}

// QUESTION_MAP: сопоставь реальные id вопросов -> q1..q5
const QUESTION_MAP = {
  107664842: 'q1',
  107665595: 'q2',
  107665966: 'q3',
  107716049: 'q4',
  107716069: 'q5',
};

// Try a few parsing strategies, log attempts for debugging
function tryParseWithHeuristics(raw) {
  const attempts = [];

  // helper that tries JSON.parse and records result or error
  const attemptParse = (label, candidate) => {
    attempts.push({ label, length: candidate.length });
    try {
      return { ok: true, obj: JSON.parse(candidate), candidate };
    } catch (e) {
      attempts[attempts.length - 1].err = e.message;
      return { ok: false, err: e };
    }
  };

  const s0 = (raw ?? '').toString().trim();
  // quick direct attempt
  let r = attemptParse('direct', s0);
  if (r.ok) return { result: r.obj, attempts };

  // if wrapped like ("...") or ('...') or ( ... )
  let s = s0;
  if (s.startsWith('("') && s.endsWith('")')) {
    s = s.slice(2, -2);
    r = attemptParse('unwrap-("...")', s);
    if (r.ok) return { result: r.obj, attempts };
  }
  if (s0.startsWith('("') && s0.endsWith('")')) {
    // try also unescape inside
    let u = s0.slice(2, -2).replace(/\\"/g, '"');
    r = attemptParse('unwrap-and-unescape', u);
    if (r.ok) return { result: r.obj, attempts };
  }

  // remove outer parentheses ( (...) )
  if (s0.startsWith('(') && s0.endsWith(')')) {
    s = s0.slice(1, -1).trim();
    r = attemptParse('unwrap-parens', s);
    if (r.ok) return { result: r.obj, attempts };
  }

  // strip surrounding quotes if any
  if ((s0.startsWith('"') && s0.endsWith('"')) || (s0.startsWith("'") && s0.endsWith("'"))) {
    s = s0.slice(1, -1);
    r = attemptParse('strip-quotes', s);
    if (r.ok) return { result: r.obj, attempts };
  }

  // Extract substring between first { and last } — often fixes wrapper noise
  const firstBrace = s0.indexOf('{');
  const lastBrace = s0.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    let candidate = s0.slice(firstBrace, lastBrace + 1);
    r = attemptParse('between-braces', candidate);
    if (r.ok) return { result: r.obj, attempts };

    // If that fails, try unescaping backslashes (double-encoded)
    const unescaped = candidate.replace(/\\"/g, '"').replace(/\\n/g, '');
    r = attemptParse('between-braces-unescape', unescaped);
    if (r.ok) return { result: r.obj, attempts };

    // try to replace double slashes
    const dblUn = unescaped.replace(/\\\\/g, '\\');
    r = attemptParse('between-braces-unescape-2', dblUn);
    if (r.ok) return { result: r.obj, attempts };
  }

  // Try to find first JSON object substring (fallback scanning)
  // Look for any { ... } balanced substring up to some length
  const maxLen = Math.min(5000, s0.length);
  for (let i = 0; i < Math.min(200, s0.length); i++) {
    if (s0[i] !== '{') continue;
    for (let j = Math.min(s0.length - 1, i + maxLen); j > i; j--) {
      if (s0[j] !== '}') continue;
      const cand = s0.slice(i, j + 1);
      r = attemptParse(`scan-{...}@${i}-${j}`, cand);
      if (r.ok) return { result: r.obj, attempts };
    }
  }

  // nothing worked
  return { error: 'all-parses-failed', attempts };
}

function safelyGetQuestionId(parsed) {
  // possible locations from logs/observations:
  // 1) parsed.answer.data -> value array -> value[0].question.id
  // 2) parsed.answer.question?.id
  // 3) parsed.question?.id
  // 4) parsed.value?.question?.id
  const safe = (o, path) => {
    try {
      return path.split('.').reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), o);
    } catch (e) {
      return undefined;
    }
  };

  // try common routes
  let qid = safe(parsed, 'answer.data');
  if (qid && typeof qid === 'object') {
    // drill into first value entry
    try {
      const dataKeys = Object.keys(parsed.answer.data || {});
      if (dataKeys.length > 0) {
        const first = parsed.answer.data[dataKeys[0]];
        const maybeValue = first?.value?.[0];
        const candidateQuestionId = maybeValue?.question?.id || maybeValue?.question?.id;
        if (candidateQuestionId) return candidateQuestionId;
      }
    } catch (e) {}
  }

  qid = safe(parsed, 'answer.question.id');
  if (qid) return qid;

  qid = safe(parsed, 'question.id');
  if (qid) return qid;

  // sometimes question id is attached to value objects at root
  try {
    const dataKeys = Object.keys(parsed?.answer?.data || {});
    if (dataKeys.length) {
      const first = parsed.answer.data[dataKeys[0]];
      const v = first?.value?.[0];
      if (v?.question && v.question.id) return v.question.id;
    }
  } catch (e) {}

  // fallback: if the whole parsed has question
  if (parsed?.question?.id) return parsed.question.id;

  return undefined;
}

function safelyGetAnswerKey(parsed) {
  // find first data key and then value[0].key
  try {
    const answer = parsed?.answer || parsed;
    const data = answer?.data;
    if (!data || typeof data !== 'object') return undefined;
    const keys = Object.keys(data);
    if (!keys.length) return undefined;
    const firstKey = keys[0];
    const entry = data[firstKey];
    const val = entry?.value?.[0];
    return val?.key || val?.id || undefined;
  } catch (e) {
    return undefined;
  }
}

module.exports = async function handler(req, res) {
  try {
    console.log('===== NEW YANDEX FORM EVENT =====');

    const raw = await readRawBody(req);
    console.log('RAW STRING:', raw ?? '(empty)');

    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      console.warn('RAW body empty or undefined');
      // respond 200 to webhook but report ok:false
      return res.status(200).json({ ok: false, error: 'empty body' });
    }

    const parseResult = tryParseWithHeuristics(raw);
    if (parseResult.error) {
      console.warn('ALL PARSE ATTEMPTS FAILED:', parseResult.attempts || parseResult);
      return res.status(200).json({ ok: false, error: 'parse-failed', detail: parseResult });
    }

    const parsed = parseResult.result;
    console.log('PARSER: parse succeeded');

    // find answer/values
    const answerObj = parsed?.answer || parsed;
    if (!answerObj) {
      console.warn('no answer object');
      return res.status(200).json({ ok: false, error: 'no answer object' });
    }

    // get question id (robust)
    const questionId = safelyGetQuestionId(parsed);
    if (!questionId) {
      console.warn('question id not found in parsed payload');
      return res.status(200).json({ ok: false, error: 'question not found', parsedSample: Object.keys(answerObj || {}) });
    }

    const q = QUESTION_MAP[questionId];
    if (!q) {
      console.warn('question id not mapped:', questionId);
      return res.status(200).json({ ok: false, error: 'unknown question id', questionId });
    }

    // get answer option key
    const answerKey = safelyGetAnswerKey(parsed);
    if (!answerKey) {
      console.warn('answer key not found');
      return res.status(200).json({ ok: false, error: 'answer key not found' });
    }

    // increment in KV (hash per question)
    const redisKey = `stats:${q}`;
    try {
      await kv.hincrby(redisKey, answerKey, 1);
      console.log(`COUNT KEY → ${q}:${answerKey}`);
    } catch (e) {
      console.error('KV INCR FAILED', e);
      return res.status(200).json({ ok: false, error: 'kv-failed', detail: String(e) });
    }

    return res.status(200).json({ ok: true, questionId, q, answerKey });
  } catch (err) {
    console.error('YANDEX FORM ERROR:', err && err.stack ? err.stack : err);
    // respond 200 to avoid retries; include error for debugging
    return res.status(200).json({ ok: false, error: 'internal', detail: String(err) });
  }
};
