export default function handler(req, res) {
  const votes = globalThis.votes || {};

  const labels = Object.keys(votes);
  const values = Object.values(votes);

  const total = values.reduce((a, b) => a + b, 0);

  const percents = values.map(v =>
    total === 0 ? 0 : Math.round((v / total) * 100)
  );

  res.json({
    labels,
    values,
    percents,
    total
  });
}
