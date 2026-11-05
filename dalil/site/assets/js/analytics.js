/* DALIL page analytics (PostHog).
   Privacy-first setup:
   - No cookies or local storage: the visitor ID lives in memory and is gone when the tab closes.
   - No session recordings, no surveys, and no form contents are ever sent.
   - Respects "Do Not Track".
   - Only runs on the live site, so local testing never pollutes the numbers. */
(function () {
  var host = window.location.hostname;
  var live = /(^|\.)dalil-team\.com$/.test(host) || /\.netlify\.app$/.test(host);
  if (!live) return;

  // Official PostHog loader stub: queues calls until the library arrives from PostHog's CDN.
  !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset get_distinct_id getFeatureFlag isFeatureEnabled onFeatureFlags".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);

  window.posthog.init("phc_rXW2kneRDmc3ZQZ6yFf6rBwhPZwLMJZGraPQrJ8RnBzP", {
    api_host: "https://us.i.posthog.com",
    persistence: "memory",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: true,
    disable_surveys: true,
    respect_dnt: true
  });

  // Tag every event with how the visitor arrived (?src=qr, linkedin, whatsapp...).
  var src = null;
  try { src = new URLSearchParams(window.location.search).get("src"); } catch (e) { /* old browser */ }
  if (!src) { try { src = sessionStorage.getItem("dalil-src"); } catch (e) { /* storage unavailable */ } }
  if (src) {
    src = src.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (src) window.posthog.register({ src: src });
  }
})();
