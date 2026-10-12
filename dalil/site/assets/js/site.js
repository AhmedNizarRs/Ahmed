/* DALIL investor page, v2.
   Everything here is an enhancement: without JavaScript the page reads top to bottom,
   videos show their posters and the form posts straight to Netlify.
   Scroll-linked motion (the sideways places, the film zoom, the roadmap rail, the word reveal)
   uses GSAP ScrollTrigger, loaded after the page has finished loading and never under reduced motion. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var hasIO = "IntersectionObserver" in window;
  var smoothScrolling = false;

  /* ---------- English braille (grade 1), used by the hero and the rail readout ---------- */
  var BRAILLE = { a: "⠁", b: "⠃", c: "⠉", d: "⠙", e: "⠑", f: "⠋", g: "⠛", h: "⠓", i: "⠊", j: "⠚", k: "⠅", l: "⠇", m: "⠍",
    n: "⠝", o: "⠕", p: "⠏", q: "⠟", r: "⠗", s: "⠎", t: "⠞", u: "⠥", v: "⠧", w: "⠺", x: "⠭", y: "⠽", z: "⠵" };
  var DIGITS = "jabcdefghi"; // 0-9 written as a-j after the number sign
  function toBraille(text) {
    var out = "", inNumber = false;
    text.toLowerCase().split("").forEach(function (ch) {
      if (/[0-9]/.test(ch)) {
        if (!inNumber) { out += "⠼"; inNumber = true; }
        out += BRAILLE[DIGITS[+ch]];
      } else {
        inNumber = false;
        out += BRAILLE[ch] || (ch === " " ? " " : "");
      }
    });
    return out;
  }
  var BRAILLE_CELLS = Object.keys(BRAILLE).map(function (k) { return BRAILLE[k]; });

  /* ---------- ?src= capture (qr, linkedin, whatsapp...) ---------- */
  var srcInput = $("#f-src");
  if (srcInput) {
    try {
      var src = new URLSearchParams(window.location.search).get("src");
      if (src) {
        src = src.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
        if (src) {
          srcInput.value = src;
          try { sessionStorage.setItem("dalil-src", src); } catch (e) { /* storage unavailable */ }
        }
      } else {
        var saved = null;
        try { saved = sessionStorage.getItem("dalil-src"); } catch (e) { /* storage unavailable */ }
        if (saved) srcInput.value = saved;
      }
    } catch (e) { /* keep the default "direct" */ }
  }

  /* ---------- Places: reserve the scroll length of the sideways walk before anything loads ---------- */
  var placesSection = $(".places");
  var placesTrack = $(".places-track");
  var wideScreen = window.matchMedia("(min-width: 960px)");
  function panDistance() { return placesTrack ? Math.max(0, placesTrack.scrollWidth - window.innerWidth) : 0; }
  function reservePan() {
    if (!placesSection) return;
    var on = wideScreen.matches && !reduceMotion;
    placesSection.classList.toggle("has-pan", on);
    if (on) placesSection.style.setProperty("--pan", panDistance() + "px");
  }
  reservePan();

  /* ---------- Hero: braille resolves into the headline ---------- */
  var scramble = $(".scramble");
  if (scramble && !reduceMotion) {
    var finalText = scramble.getAttribute("data-text");
    var real = document.createElement("span");
    real.className = "visually-hidden";
    real.textContent = finalText;
    scramble.parentNode.insertBefore(real, scramble);
    scramble.setAttribute("aria-hidden", "true");
    // Braille cells are wider than the letters they stand for. Keep the headline's own line breaks
    // (measured once) and stop wrapping while it scrambles, so its height never changes.
    var words = finalText.split(" ");
    scramble.innerHTML = words.map(function (w) { return "<span>" + w + "</span>"; }).join(" ");
    var lines = [], lastTop = null;
    $$("span", scramble).forEach(function (s, i) {
      var top = s.offsetTop;
      if (top !== lastTop) { lines.push([]); lastTop = top; }
      lines[lines.length - 1].push(words[i]);
    });
    var layout = lines.map(function (l) { return l.join(" "); }).join("\n");
    var chars = layout.split("");
    scramble.textContent = layout; // same words, same breaks, so switching off wrapping changes nothing
    scramble.classList.add("is-scrambling");
    var start = null, last = 0, duration = 1400;
    var frame = function (t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / duration);
      if (t - last >= 50 || p === 1) {
        last = t;
        var settled = Math.floor(p * chars.length), out = "";
        for (var i = 0; i < chars.length; i++) {
          var c = chars[i];
          out += (i < settled || c === " " || c === "." || c === "\n") ? c : BRAILLE_CELLS[(Math.random() * BRAILLE_CELLS.length) | 0];
        }
        scramble.textContent = out;
      }
      if (p < 1) window.requestAnimationFrame(frame);
      else { scramble.classList.remove("is-scrambling"); scramble.textContent = finalText; }
    };
    window.requestAnimationFrame(frame);
  }

  /* ---------- Videos ----------
     Every video plays muted, only while it is on screen, and never under reduced motion or Save-Data.
     Each one has a small pause button, and a video someone paused stays paused. */
  var videoExt = document.createElement("video").canPlayType('video/mp4; codecs="avc1.640028"') ? ".mp4" : ".webm";
  var autoMotion = !reduceMotion && !saveData;

  // Pick the file the first time a video is needed: the hero has one size; the film has a sharper one for big screens.
  function ensureSource(v) {
    if (v.dataset.sourced) return;
    v.dataset.sourced = "1";
    var base = v.getAttribute("data-src") ||
      (v.getAttribute("data-src-wide") && (window.innerWidth > 760 ? v.getAttribute("data-src-wide") : v.getAttribute("data-src-narrow")));
    if (base) { v.src = base + videoExt; }
  }
  function syncControls(v) {
    $$('.vid-toggle[data-video="#' + v.id + '"]').forEach(function (b) { b.setAttribute("aria-pressed", v.paused ? "true" : "false"); });
    $$('.vid-sound[data-video="#' + v.id + '"]').forEach(function (b) { b.setAttribute("aria-pressed", v.muted ? "false" : "true"); });
  }
  function playVideo(v) {
    if (v.dataset.userPaused === "true") return;
    ensureSource(v);
    var p = v.play();
    if (p && p.catch) p.catch(function () { syncControls(v); });
  }
  function watchVideo(v, threshold) {
    v.addEventListener("playing", function () { v.classList.add("is-playing"); syncControls(v); });
    v.addEventListener("pause", function () { syncControls(v); });
    v.addEventListener("volumechange", function () { syncControls(v); });
    syncControls(v);
    if (!autoMotion || !hasIO) return;
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) playVideo(v); else v.pause();
    }, { threshold: threshold }).observe(v);
  }
  $$(".vid-toggle, .vid-sound").forEach(function (b) { b.hidden = false; });
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".vid-toggle, .vid-sound") : null;
    if (!btn) return;
    var v = $(btn.getAttribute("data-video"));
    if (!v) return;
    if (btn.classList.contains("vid-sound")) {
      v.muted = !v.muted;
      if (!v.muted && v.paused) { v.dataset.userPaused = "false"; playVideo(v); }
    } else if (v.paused) {
      v.dataset.userPaused = "false";
      playVideo(v);
    } else {
      v.dataset.userPaused = "true";
      v.pause();
    }
    syncControls(v);
  });

  // The hero video waits until the page has loaded (see afterLoad), so it never delays the first picture.
  var heroVideo = $("#hero-video");
  function startHero() {
    if (!heroVideo) return;
    watchVideo(heroVideo, 0.1);
  }
  // The film, the clip and the hand play as they scroll into view.
  $$("video.autoplay").forEach(function (v) { watchVideo(v, 0.45); });

  /* ---------- The rail: slide your hand, meet a clip, read it ---------- */
  var rail = $("[data-rail]");
  if (rail) initRail(rail);

  function initRail(rail) {
    var stage = $(".rail-stage", rail);
    var hand = $(".rail-hand", rail);
    var clips = $$(".rail-clip", rail);
    var kindText = $(".readout-kind-text", rail);
    var ribsBox = $(".readout-ribs", rail);
    var msg = $(".readout-msg", rail);
    var brailleBox = $(".readout-braille", rail);
    var x = 4, touched = null, dragging = false, autoplay = null, interacted = false;
    rail.classList.add("is-idle");

    function setX(next, fromUser) {
      x = Math.max(0, Math.min(100, next));
      hand.style.setProperty("--x", x.toFixed(2));
      hand.setAttribute("aria-valuenow", String(Math.round(x)));
      var hit = null;
      clips.forEach(function (c) {
        if (Math.abs(+c.getAttribute("data-at") - x) < 4.5) hit = c;
      });
      if (hit !== touched) {
        if (touched) touched.classList.remove("is-touched");
        touched = hit;
        if (hit) {
          hit.classList.add("is-touched");
          var ribs = +hit.getAttribute("data-ribs");
          kindText.textContent = hit.getAttribute("data-kind") + ", " + ribs + (ribs === 1 ? " rib" : " ribs");
          ribsBox.innerHTML = new Array(ribs + 1).join("<i></i>");
          msg.textContent = hit.getAttribute("data-msg");
          brailleBox.textContent = toBraille(hit.getAttribute("data-braille"));
          hand.setAttribute("aria-valuetext", "On a clip: " + hit.getAttribute("data-msg"));
          rail.classList.remove("has-touch"); void rail.offsetWidth; rail.classList.add("has-touch");
          if (fromUser && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* not allowed */ } }
        } else {
          hand.setAttribute("aria-valuetext", x < 50 ? "Between clips, near the start" : "Between clips, near the end");
        }
      }
    }
    function fromPointer(e) {
      var r = stage.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    }
    function stopAuto() {
      interacted = true;
      rail.classList.remove("is-idle");
      if (autoplay) { window.cancelAnimationFrame(autoplay); autoplay = null; }
    }
    stage.addEventListener("pointerdown", function (e) {
      stopAuto();
      dragging = true;
      stage.setPointerCapture(e.pointerId);
      setX(fromPointer(e), true);
      hand.focus({ preventScroll: true });
    });
    stage.addEventListener("pointermove", function (e) { if (dragging) setX(fromPointer(e), true); });
    stage.addEventListener("pointerup", function () { dragging = false; });
    stage.addEventListener("pointercancel", function () { dragging = false; });
    hand.addEventListener("keydown", function (e) {
      var step = { ArrowRight: 2, ArrowUp: 2, ArrowLeft: -2, ArrowDown: -2, PageUp: 10, PageDown: -10 }[e.key];
      if (e.key === "Home") { stopAuto(); setX(0, true); e.preventDefault(); return; }
      if (e.key === "End") { stopAuto(); setX(100, true); e.preventDefault(); return; }
      if (step) { stopAuto(); setX(x + step, true); e.preventDefault(); }
    });

    // A slow demonstration glide the first time the rail comes into view, until someone takes over.
    if (!reduceMotion && hasIO) {
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting || interacted) return;
        seen.disconnect();
        var t0 = null, from = 4, to = 96, dur = 5200;
        var tick = function (t) {
          if (interacted) return;
          if (t0 === null) t0 = t;
          var p = Math.min(1, (t - t0) / dur);
          var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          setX(from + (to - from) * eased, false);
          if (p < 1) autoplay = window.requestAnimationFrame(tick);
          else rail.classList.remove("is-idle");
        };
        autoplay = window.requestAnimationFrame(tick);
      }, { threshold: 0.6 });
      seen.observe(rail);
    }
    setX(4, false);
  }

  /* ---------- Tactile grammar: filter modules by rib count ---------- */
  var ribKeys = $$(".rib-key");
  var modules = $(".modules");
  ribKeys.forEach(function (key) {
    key.addEventListener("click", function () {
      var on = key.getAttribute("aria-pressed") !== "true";
      ribKeys.forEach(function (k) { k.setAttribute("aria-pressed", "false"); });
      key.setAttribute("aria-pressed", on ? "true" : "false");
      var kind = key.getAttribute("data-kind");
      modules.classList.toggle("is-filtered", on);
      $$(".module", modules).forEach(function (m) {
        m.classList.toggle("is-match", on && m.getAttribute("data-kind") === kind);
      });
    });
  });

  /* ---------- Lights off: the clip keeps glowing ---------- */
  var sight = $(".sight");
  var lightsBtn = $("[data-lights-toggle]");
  if (sight && lightsBtn) {
    var glow = $(".glow-video", sight);
    var label = $(".switch-label", lightsBtn);
    lightsBtn.addEventListener("click", function () {
      var off = lightsBtn.getAttribute("aria-pressed") !== "true";
      lightsBtn.setAttribute("aria-pressed", off ? "true" : "false");
      sight.setAttribute("data-lights", off ? "off" : "on");
      label.textContent = off ? "Turn the lights on" : "Turn the lights off";
      if (off) {
        if (reduceMotion) {
          // Jump straight to the glowing frame, no playback.
          var toEnd = function () {
            glow.addEventListener("seeked", function () { glow.classList.add("is-playing"); }, { once: true });
            glow.currentTime = Math.max(0, glow.duration - 0.1);
          };
          if (glow.readyState >= 1) toEnd(); else { glow.preload = "auto"; glow.addEventListener("loadedmetadata", toEnd, { once: true }); glow.load(); }
        } else {
          glow.currentTime = 0;
          glow.addEventListener("playing", function () { glow.classList.add("is-playing"); }, { once: true });
          var p = glow.play();
          if (p && p.catch) p.catch(function () {});
        }
      } else {
        glow.pause();
        glow.classList.remove("is-playing");
        glow.currentTime = 0;
      }
    });
  }

  /* ---------- In-page links: smooth scroll and move focus to the target ---------- */
  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var id = link.getAttribute("href").slice(1);
    var target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    if (!reduceMotion) {
      smoothScrolling = true;
      var done = function () { smoothScrolling = false; };
      if ("onscrollend" in window) window.addEventListener("scrollend", done, { once: true });
      setTimeout(done, 2500);
    }
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (history.pushState) history.pushState(null, "", "#" + id);
    if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });

  /* ---------- First-report observer: anything already on screen at load is left alone ---------- */
  function belowFold(elements, onFirstHidden, onShow, options) {
    if (!hasIO || reduceMotion) return;
    var first = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (!first.has(el)) {
          first.add(el);
          if (entry.isIntersecting) { io.unobserve(el); return; }
          onFirstHidden(el);
          return;
        }
        if (entry.isIntersecting) { onShow(el); io.unobserve(el); }
      });
    }, options || { rootMargin: "0px 0px -8% 0px" });
    elements.forEach(function (el) { io.observe(el); });
  }

  // Count-ups for the big numbers
  function countUp(el) {
    var to = parseFloat(el.getAttribute("data-to"));
    var decimals = +(el.getAttribute("data-decimals") || 0);
    var t0 = null, dur = 1400;
    var tick = function (t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * eased).toFixed(decimals);
      if (p < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }
  belowFold($$(".count"), function (el) { el.textContent = (0).toFixed(+(el.getAttribute("data-decimals") || 0)); }, countUp, { threshold: 0.6 });

  // Charts grow from their baseline when they arrive
  belowFold($$(".bars, .range-chart"), function (el) { el.classList.add("will-grow"); }, function (el) { el.classList.add("is-in"); }, { threshold: 0.35 });

  // Gentle reveals
  belowFold($$(".section-reveal, .problem h2, .stat, .product-title, .rail-demo, .steps > li, .manifesto, .grammar-key, .module, .sight-copy, .glow-frame, .places-head, .compare h2, .table-scroll, .market-chart h2, .per-building, .pricing h2, .price-pair > div, .range-chart, .included, .roadmap h2, .customers h2, .founder, .join-intro, .lead-form"),
    function (el) { el.classList.add("reveal"); }, function (el) { el.classList.add("is-in"); });

  /* ---------- GSAP: loaded after everything else, only with motion allowed ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function initScrollMotion() {
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return;
    // CSS smooth scrolling fights ScrollTrigger when it re-measures the page; in-page links are smoothed in script instead.
    document.documentElement.classList.add("st-on");
    gsap.registerPlugin(ScrollTrigger);
    var mm = gsap.matchMedia();

    // The blank handrail: words light up as you scroll past.
    var words = $(".reveal-words");
    if (words) {
      var html = words.innerHTML.replace(/(<em>)?([^\s<]+)(<\/em>)?/g, function (m, a, w, b) { return (a || "") + '<span class="w">' + w + "</span>" + (b || ""); });
      words.innerHTML = html;
      var ws = $$(".w", words);
      words.classList.add("is-scrubbing");
      ScrollTrigger.create({
        trigger: ".blank-rail", start: "top 70%", end: "bottom 60%", scrub: true,
        onUpdate: function (self) {
          var n = Math.round(self.progress * ws.length);
          ws.forEach(function (w, i) { w.classList.toggle("on", i < n); });
        }
      });
    }

    // The film frame opens up as it arrives.
    gsap.fromTo(".film-frame", { scale: 0.86, borderRadius: 40 }, {
      scale: 1, borderRadius: 28, ease: "none",
      scrollTrigger: { trigger: ".film", start: "top bottom", end: "top 20%", scrub: true }
    });

    // Places: vertical scroll becomes a sideways walk along the eight places (desktop only).
    // The scroll length is already reserved as padding (see reservePan), so pinning adds no height.
    ScrollTrigger.addEventListener("refreshInit", reservePan);
    mm.add("(min-width: 960px)", function () {
      if (!placesSection || !placesTrack) return;
      placesSection.classList.add("is-pinned");
      gsap.to(placesTrack, {
        x: function () { return -panDistance(); }, ease: "none",
        scrollTrigger: { trigger: ".places-pin", start: "top top", end: function () { return "+=" + panDistance(); }, pin: true, pinSpacing: false, scrub: 1, invalidateOnRefresh: true }
      });
      return function () { placesSection.classList.remove("is-pinned"); };
    });

    // Roadmap: a yellow line runs up the rail and each month lights up as it is reached.
    var road = $(".road");
    if (road) {
      var line = $(".road-progress", road);
      var stops = [0.06, 0.36, 0.64, 0.94];
      var ms = $$(".ms", road);
      road.classList.add("is-live");
      ScrollTrigger.create({
        trigger: road, start: "top 75%", end: "bottom 45%", scrub: true,
        onUpdate: function (self) {
          var p = self.progress;
          if (line) line.style.strokeDashoffset = String(1 - p);
          ms.forEach(function (m, i) { m.classList.toggle("on", p >= stops[i] - 0.02); });
        }
      });
      if (line) line.style.strokeDashoffset = "1";
    }
  }

  function whenIdle(fn, timeout) {
    if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: timeout }); else setTimeout(fn, 600);
  }
  // Waits until no link-driven smooth scroll is running and the page has been still for a moment.
  function whenScrollSettles(fn) {
    var lastY = window.scrollY, still = 0;
    var check = function () {
      if (window.scrollY === lastY && !smoothScrolling) still++; else { still = 0; lastY = window.scrollY; }
      if (still >= 3) fn(); else setTimeout(check, 120);
    };
    setTimeout(check, 120);
  }
  function afterLoad() {
    whenIdle(startHero, 2500);
    if (reduceMotion) return;
    var loaded = false;
    var go = function () {
      if (loaded) return;
      loaded = true;
      loadScript("/assets/js/gsap.min.js")
        .then(function () { return loadScript("/assets/js/ScrollTrigger.min.js"); })
        .then(function () { whenScrollSettles(initScrollMotion); })
        .catch(function () { if (placesSection) placesSection.classList.remove("has-pan"); /* motion is optional */ });
    };
    // Load the scroll effects when the browser is idle, or as soon as the visitor starts to interact.
    whenIdle(go, 3000);
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (type) {
      window.addEventListener(type, go, { once: true, passive: true });
    });
  }

  if (document.readyState === "complete") afterLoad(); else window.addEventListener("load", afterLoad);

  /* ---------- Form ---------- */
  var form = $("#lead-form");
  if (form) initForm(form);

  function initForm(form) {
    form.noValidate = true; // We validate in JS; without JS the browser's own validation runs.
    var summary = $("#error-summary");
    var summaryList = $("#error-summary-list");
    var status = $("#form-status");
    var submit = $("#f-submit");
    var interestsHidden = $("#f-interests");
    var group = $("#f-interest");
    var touchedFields = {};

    var rules = [
      { id: "f-name", errorId: "f-name-error", message: "Enter your full name.",
        check: function (el) { return el.value.trim().length >= 2; } },
      { id: "f-email", errorId: "f-email-error", message: "Enter an email address, like name@company.com.",
        check: function (el) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim()); } },
      { id: "f-phone", errorId: "f-phone-error", message: "Enter a phone or WhatsApp number, including the country code.",
        check: function (el) { var d = el.value.replace(/\D/g, ""); return d.length >= 9 && d.length <= 15; } },
      { id: "f-org", errorId: "f-org-error", message: "Enter your organisation, or write Individual.",
        check: function (el) { return el.value.trim().length >= 2; } },
      { id: "f-interest", errorId: "f-interest-error", group: true, focusId: "f-interest-first",
        message: "Choose at least one thing you’re interested in.",
        check: function () { return $$('input[type="checkbox"]', group).some(function (c) { return c.checked; }); } },
      { id: "f-consent", errorId: "f-consent-error", message: "Tick the box so we can contact you.",
        check: function (el) { return el.checked; } }
    ];

    var firstInterest = $('input[type="checkbox"]', group);
    if (firstInterest) firstInterest.id = "f-interest-first";

    function showError(rule, valid) {
      var el = document.getElementById(rule.id);
      var err = document.getElementById(rule.errorId);
      if (valid) { el.removeAttribute("aria-invalid"); err.hidden = true; err.textContent = ""; }
      else { el.setAttribute("aria-invalid", "true"); err.textContent = rule.message; err.hidden = false; }
    }
    function validate(rule) {
      var valid = rule.check(document.getElementById(rule.id));
      showError(rule, valid);
      return valid;
    }

    rules.forEach(function (rule) {
      var el = document.getElementById(rule.id);
      var inputs = rule.group ? $$("input", el) : [el];
      inputs.forEach(function (input) {
        input.addEventListener("blur", function () {
          if (rule.group) return;
          if (input.value.trim() !== "" && !(rule.id === "f-phone" && input.value.trim() === "+971")) touchedFields[rule.id] = true;
          if (touchedFields[rule.id]) validate(rule);
        });
        input.addEventListener(input.type === "checkbox" ? "change" : "input", function () {
          if (touchedFields[rule.id] || el.getAttribute("aria-invalid") === "true") validate(rule);
        });
      });
    });

    function collectInterests() {
      interestsHidden.value = $$('input[type="checkbox"][data-interest]', group)
        .filter(function (c) { return c.checked; })
        .map(function (c) { return c.getAttribute("data-interest"); })
        .join(", ");
    }
    function renderSummary(failed) {
      summaryList.innerHTML = "";
      failed.forEach(function (rule) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + (rule.focusId || rule.id);
        a.textContent = rule.message;
        a.addEventListener("click", function (e) {
          e.preventDefault();
          var target = document.getElementById(rule.focusId || rule.id);
          target.focus();
          target.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
        });
        li.appendChild(a);
        summaryList.appendChild(li);
      });
      $("#error-summary-title").textContent = failed.length === 1 ? "Please fix 1 thing before sending" : "Please fix " + failed.length + " things before sending";
      summary.hidden = false;
      summary.focus();
    }
    function setBusy(busy) {
      submit.disabled = busy;
      submit.setAttribute("aria-busy", busy ? "true" : "false");
      $(".btn-label", submit).textContent = busy ? "Sending your details…" : "Join the waitlist";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.textContent = "";
      status.classList.remove("is-error");
      rules.forEach(function (r) { touchedFields[r.id] = true; });
      var failed = rules.filter(function (rule) { return !validate(rule); });
      if (failed.length) { renderSummary(failed); return; }
      summary.hidden = true;
      collectInterests();
      setBusy(true);
      status.textContent = "Sending your details…";

      var body = new URLSearchParams(new FormData(form)).toString();
      var controller = "AbortController" in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, 15000);

      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body,
        signal: controller ? controller.signal : undefined
      }).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        status.textContent = "Sent. Taking you to the next page.";
        window.location.assign("/thanks/");
      }).catch(function () {
        clearTimeout(timer);
        setBusy(false);
        status.classList.add("is-error");
        status.textContent = "We couldn’t send your details. Check your connection and try again, or email dalilwayfinding@gmail.com.";
      });
    });
  }
})();
