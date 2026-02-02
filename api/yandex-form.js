globalThis.votes = globalThis.votes || {};

export default function handler(req, res) {
  const answers = req.body?.answers;

  if (answers) {
    const value = Object.values(answers)[0];
    globalThis.votes[value] = (globalThis.votes[value] || 0) + 1;
  }

  res.status(200).json({ ok: true });
}
