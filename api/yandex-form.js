export default async function handler(req, res) {
  console.log("=== YANDEX FORM PAYLOAD ===");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("===========================");

  res.status(200).json({ ok: true });
}
