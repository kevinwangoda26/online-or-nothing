// Vercel serverless function: receives an application and emails it to the admin via Resend.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HOURS = ["Under 5 hours", "5 to 10 hours", "10 to 20 hours", "More than 20 hours"];
const YN = ["Yes", "No"];
const txt = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const { RESEND_API_KEY, ADMIN_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !ADMIN_EMAIL) return res.status(500).json({ ok: false, error: "not_configured" });

  const body = req.body || {};
  if (body.website) return res.status(200).json({ ok: true, ref: "MDS-SENT" }); // honeypot: bots fill this in
  const a = body.answers || {};
  const bad = (m) => res.status(400).json({ ok: false, error: m });

  const d = {
    youtubeSubscribed: a.youtubeSubscribed === true,
    name: txt(a.name, 120),
    age: parseInt(a.age, 10),
    location: txt(a.location, 160),
    occupation: txt(a.occupation, 160),
    soldOnlineBefore: txt(a.soldOnlineBefore, 5),
    platforms: Array.isArray(a.platforms) ? a.platforms.map((p) => txt(p, 60)).filter(Boolean).slice(0, 10) : [],
    hoursPerWeek: txt(a.hoursPerWeek, 40),
    whyInterested: txt(a.whyInterested, 1200),
    willingWeeklyTraining: txt(a.willingWeeklyTraining, 5),
    goal90Days: txt(a.goal90Days, 1200),
    phone: txt(a.phone, 40),
  };
  if (!d.youtubeSubscribed) return bad("subscribe");
  if (d.name.length < 2) return bad("name");
  if (isNaN(d.age) || d.age < 10 || d.age > 100) return bad("age");
  if (d.location.length < 2) return bad("location");
  if (d.occupation.length < 2) return bad("occupation");
  if (!YN.includes(d.soldOnlineBefore)) return bad("sold");
  if (!d.platforms.length) return bad("platforms");
  if (!HOURS.includes(d.hoursPerWeek)) return bad("hours");
  if (d.whyInterested.length < 10) return bad("why");
  if (!YN.includes(d.willingWeeklyTraining)) return bad("willing");
  if (d.goal90Days.length < 10) return bad("goal");
  if (!/^[+()\d][\d\s()+-]{6,}$/.test(d.phone)) return bad("phone");

  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let ref = "MDS-";
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];

  const rows = [
    ["Reference", ref],
    ["Subscribed to the YouTube channel", "Yes"],
    ["Name", d.name],
    ["Age", d.age],
    ["Location", d.location],
    ["Current occupation", d.occupation],
    ["Sold anything online before", d.soldOnlineBefore],
    ["Platforms used", d.platforms.join(", ")],
    ["Hours per week", d.hoursPerWeek],
    ["Why interested in online sales", d.whyInterested],
    ["Willing to attend one weekly training", d.willingWeeklyTraining],
    ["Goal for the next 90 days", d.goal90Days],
    ["Phone or WhatsApp", d.phone],
  ];
  const html = '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:15px">' +
    rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#555;vertical-align:top"><b>${esc(k)}</b></td><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join("") + "</table>";

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL || "Mbale Digital Sales Team <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `New application: ${d.name} (${ref})`,
      html,
    }),
  });
  if (!r.ok) return res.status(502).json({ ok: false, error: "email_failed" });
  return res.status(200).json({ ok: true, ref });
};
