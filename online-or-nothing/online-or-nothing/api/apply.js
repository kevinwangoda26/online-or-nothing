// Vercel serverless function: receives an application and emails it to the admin via Resend.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const { RESEND_API_KEY, ADMIN_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !ADMIN_EMAIL) return res.status(500).json({ ok: false, error: "not_configured" });

  const body = req.body || {};
  if (body.website) return res.status(200).json({ ok: true, ref: "APP-SENT" }); // honeypot: bots fill this in
  const a = body.answers || {};
  const files = Array.isArray(body.files) ? body.files : [];

  const bad = (m) => res.status(400).json({ ok: false, error: m });
  if (String(a.name || "").trim().length < 2) return bad("name");
  if (!/^[+()\d][\d\s()+-]{6,}$/.test(String(a.phone || ""))) return bad("phone");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.email || ""))) return bad("email");
  if (String(a.business || "").trim().length < 2) return bad("business");
  if (files.length > 3) return bad("files");

  let total = 0;
  const attachments = [];
  for (const f of files) {
    if (!ALLOWED.includes(f.type) || typeof f.data !== "string") return bad("file_type");
    total += Math.floor((f.data.length * 3) / 4);
    attachments.push({ filename: String(f.name || "file").replace(/[^\w.\- ]/g, "_").slice(0, 80), content: f.data });
  }
  if (total > 3.2 * 1024 * 1024) return bad("file_size");

  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let ref = "APP-";
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];

  const rows = [["Reference", ref], ["Full name", a.name], ["Phone / WhatsApp", a.phone], ["Email", a.email], ["Business name", a.business], ["Business type", a.businessType], ["Location", a.location], ["Applying for", a.need], ["Documents", attachments.length ? attachments.map((x) => x.filename).join(", ") : "None"]];
  const html = '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:15px">' +
    rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#555;vertical-align:top"><b>${esc(k)}</b></td><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join("") + "</table>";

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL || "Online Or Nothing <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      reply_to: a.email,
      subject: `New application: ${String(a.business).slice(0, 60)} (${ref})`,
      html,
      attachments,
    }),
  });
  if (!r.ok) return res.status(502).json({ ok: false, error: "email_failed" });
  return res.status(200).json({ ok: true, ref });
};
