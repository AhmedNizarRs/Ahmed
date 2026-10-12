// Local test for netlify/functions/submission-created.js. Run: node tools/test-submission.js
const assert = require("assert");
const fn = require("../netlify/functions/submission-created.js");

const sample = {
  payload: {
    form_name: "investor-lead",
    created_at: "2026-10-12T20:15:00.000Z",
    data: {
      "full-name": "Layla Haddad", email: "layla@example.com", phone: "+971 50 123 4567", organisation: "Individual",
      interests: "Investing, DALIL in my building", "investor-type": "Angel", "ticket-size": "AED 50k to 250k",
      message: "Interested in a pilot <b>at our school</b>.", src: "qr", "bot-field": "",
    },
  },
};
const event = (body) => ({ body: JSON.stringify(body) });
let calls = [];
global.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers }); return { ok: !url.includes("fail"), status: url.includes("fail") ? 500 : 200 }; };
const reset = () => { calls = []; for (const k of ["SHEETS_WEBHOOK_URL", "SHEETS_WEBHOOK_SECRET", "RESEND_API_KEY", "REPLY_FROM", "REPLY_TO"]) delete process.env[k]; };

(async () => {
  const results = [];
  const check = async (name, f) => { try { await f(); results.push("PASS  " + name); } catch (e) { results.push("FAIL  " + name + ": " + e.message); } };

  await check("does nothing extra when no settings are present", async () => {
    reset(); const r = await fn.handler(event(sample));
    assert.strictEqual(r.statusCode, 200); assert.strictEqual(calls.length, 0);
  });
  await check("ignores other forms", async () => {
    reset(); process.env.SHEETS_WEBHOOK_URL = "https://sheet.test/exec";
    const r = await fn.handler(event({ payload: { ...sample.payload, form_name: "other" } }));
    assert.strictEqual(r.statusCode, 200); assert.strictEqual(calls.length, 0);
  });
  await check("copies the sign-up to the Google Sheet with the secret", async () => {
    reset(); process.env.SHEETS_WEBHOOK_URL = "https://sheet.test/exec"; process.env.SHEETS_WEBHOOK_SECRET = "s3cret";
    await fn.handler(event(sample));
    assert.strictEqual(calls.length, 1);
    const b = calls[0].body;
    assert.deepStrictEqual([b.secret, b.name, b.email, b.phone, b.source, b.interests, b.ticketSize], ["s3cret", "Layla Haddad", "layla@example.com", "+971 50 123 4567", "qr", "Investing, DALIL in my building", "AED 50k to 250k"]);
  });
  await check("sends the thank-you email through Resend, escaping HTML", async () => {
    reset(); process.env.RESEND_API_KEY = "re_test"; process.env.REPLY_FROM = "DALIL <hello@dalil.test>";
    await fn.handler(event(sample));
    assert.strictEqual(calls.length, 1);
    const c = calls[0];
    assert.strictEqual(c.url, "https://api.resend.com/emails");
    assert.strictEqual(c.headers.Authorization, "Bearer re_test");
    assert.deepStrictEqual(c.body.to, ["layla@example.com"]);
    assert.strictEqual(c.body.reply_to, "dalilwayfinding@gmail.com");
    assert.ok(c.body.html.includes("Hi Layla,"));
  });
  await check("skips the email when the address is not valid", async () => {
    reset(); process.env.RESEND_API_KEY = "re_test"; process.env.REPLY_FROM = "DALIL <hello@dalil.test>";
    await fn.handler(event({ payload: { ...sample.payload, data: { ...sample.payload.data, email: "not-an-email" } } }));
    assert.strictEqual(calls.length, 0);
  });
  await check("a failing extra is logged but still answers 200", async () => {
    reset(); process.env.SHEETS_WEBHOOK_URL = "https://fail.test/exec";
    const orig = console.error; let logged = ""; console.error = (m) => { logged += m; };
    const r = await fn.handler(event(sample)); console.error = orig;
    assert.strictEqual(r.statusCode, 200); assert.ok(logged.includes("Google Sheet failed"));
  });
  await check("rejects an unreadable body", async () => {
    reset(); const r = await fn.handler({ body: "{not json" }); assert.strictEqual(r.statusCode, 400);
  });
  console.log(results.join("\n"));
  if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
})();
