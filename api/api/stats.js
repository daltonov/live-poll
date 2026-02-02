export default function handler(req, res) {
  const votes = globalThis.votes || { A: 0, B: 0, C: 0 };

  res.json({
    labels: ["A", "B", "C"],
    values: [votes.A, votes.B, votes.C]
  });
}
