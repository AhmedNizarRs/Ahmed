// Runs automatically on Netlify after every verified sign-up from the "investor-lead" form.
// Netlify Forms already stores each sign-up and emails the founders. This adds two optional extras,
// each switched on by setting environment variables in Netlify (Project configuration > Environment variables):
//
//   Copy every sign-up into a Google Sheet:
//     SHEETS_WEBHOOK_URL     the web-app address of the Apps Script in tools/google-sheet-webhook.gs
//     SHEETS_WEBHOOK_SECRET  any long random text, the same value saved in the script
//
//   Send the person a thank-you email from your own domain (needs a verified domain at resend.com):
//     RESEND_API_KEY         the API key from resend.com
//     REPLY_FROM             for example "DALIL <hello@your-domain.com>"
//     REPLY_TO               optional, defaults to dalilwayfinding@gmail.com
//
// With none of these set, the function does nothing and the sign-up is still saved and emailed by Netlify.

const FORM_NAME = "investor-lead";

function clean(value, max = 2000) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toLead(payload) {
  const d = payload.data || {};
  return {
    received: payload.created_at || new Date().toISOString(),
    name: clean(d["full-name"], 200),
    email: clean(d.email, 200),
    phone: clean(d.phone, 40),
    organisation: clean(d.organisation, 200),
    interests: clean(d.interests, 300),
    investorType: clean(d["investor-type"], 100),
    ticketSize: clean(d["ticket-size"], 100),
    message: clean(d.message, 2000),
    source: clean(d.src || "direct", 40),
  };
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${url.split("?")[0]} answered ${res.status}`);
  return res;
}

function copyToSheet(lead) {
  return postJson(process.env.SHEETS_WEBHOOK_URL, { secret: process.env.SHEETS_WEBHOOK_SECRET || "", ...lead });
}

function sendThankYou(lead) {
  const first = lead.name.split(" ")[0] || "there";
  const replyTo = process.env.REPLY_TO || "dalilwayfinding@gmail.com";
  const text = [
    `Hi ${first},`,
    "",
    "Thank you for your interest in DALIL. You're on our waitlist, and we'll be in touch within 48 hours.",
    "",
    "DALIL is a 3D-printed clip that makes any handrail readable by hand: braille, raised numbers, and a glow for when the lights fail.",
    "",
    `If you'd like to talk sooner, reply to this email or write to ${replyTo}.`,
    "",
    "Ahmed Nazar and Mohammed Alarcon",
    "DALIL, Sharjah",
  ].join("\n");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111315;max-width:520px">
<p>Hi ${escapeHtml(first)},</p>
<p>Thank you for your interest in DALIL. You’re on our waitlist, and we’ll be in touch within 48 hours.</p>
<p>DALIL is a 3D-printed clip that makes any handrail readable by hand: braille, raised numbers, and a glow for when the lights fail.</p>
<p>If you’d like to talk sooner, reply to this email or write to <a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a>.</p>
<p>Ahmed Nazar and Mohammed Alarcon<br>DALIL, Sharjah</p>
</div>`;
  return postJson(
    "https://api.resend.com/emails",
    { from: process.env.REPLY_FROM, to: [lead.email], reply_to: replyTo, subject: "Thank you for your interest in DALIL", text, html },
    { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }
  );
}

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}").payload;
  } catch (e) {
    return { statusCode: 400, body: "Unreadable payload" };
  }
  if (!payload || payload.form_name !== FORM_NAME) return { statusCode: 200, body: "Not a DALIL sign-up" };

  const lead = toLead(payload);
  const jobs = [];
  if (process.env.SHEETS_WEBHOOK_URL) jobs.push(["Google Sheet", copyToSheet(lead)]);
  if (process.env.RESEND_API_KEY && process.env.REPLY_FROM && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) {
    jobs.push(["thank-you email", sendThankYou(lead)]);
  }
  const results = await Promise.allSettled(jobs.map((j) => j[1]));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`DALIL sign-up: ${jobs[i][0]} failed: ${r.reason && r.reason.message}`);
  });
  // Always 200: the sign-up itself is already saved by Netlify, so a failed extra must not cause a retry storm.
  return { statusCode: 200, body: `Done (${jobs.length} extra${jobs.length === 1 ? "" : "s"})` };
};

// Exposed for the local test in tools/test-submission.js
exports._toLead = toLead;
