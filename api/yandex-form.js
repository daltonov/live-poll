globalThis.votes = globalThis.votes || {};

export default function handler(req, res) {
  const body = req.body || {};

  // берём первое значение из body (ID варианта)
  const variantId = Object.values(body)[0];

  if (variantId) {
    globalThis.votes[variantId] =
      (globalThis.votes[variantId] || 0) + 1;
  }

  res.status(200).json({ ok: true });
}
