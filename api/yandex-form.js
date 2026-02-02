globalThis.votes = globalThis.votes || {
  A: 0,
  B: 0,
  C: 0
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const answers = req.body.answers || [];
    const value = answers[0]?.answer;

    if (globalThis.votes[value] !== undefined) {
      globalThis.votes[value]++;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "fail" });
  }
}
