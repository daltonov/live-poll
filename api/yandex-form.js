// Храним голоса в памяти (для ивента этого достаточно)
globalThis.votes = globalThis.votes || {};

export default function handler(req, res) {
  // Яндекс Форма пришлёт параметр answer
  const variantId = req.body?.answer;

  if (variantId) {
    globalThis.votes[variantId] =
      (globalThis.votes[variantId] || 0) + 1;
  }

  res.status(200).json({ ok: true });
}
