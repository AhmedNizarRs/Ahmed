/* DALIL investor page: form validation and submission, ?src= capture,
   phone sticky button, sideways gallery controls and gentle reveals.
   The page works without this file: the form then posts normally to Netlify. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

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
    var touched = {};

    var rules = [
      {
        id: "f-name", errorId: "f-name-error",
        check: function (el) { return el.value.trim().length >= 2; },
        message: "Enter your full name."
      },
      {
        id: "f-email", errorId: "f-email-error",
        check: function (el) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim()); },
        message: "Enter an email address, like name@company.com."
      },
      {
        id: "f-phone", errorId: "f-phone-error",
        check: function (el) {
          var digits = el.value.replace(/\D/g, "");
          return digits.length >= 9 && digits.length <= 15;
        },
        message: "Enter a phone or WhatsApp number, including the country code."
      },
      {
        id: "f-org", errorId: "f-org-error",
        check: function (el) { return el.value.trim().length >= 2; },
        message: "Enter your organisation, or write Individual."
      },
      {
        id: "f-interest", errorId: "f-interest-error", group: true,
        focusId: "f-interest-first",
        check: function () { return $$('input[type="checkbox"]', group).some(function (c) { return c.checked; }); },
        message: "Choose at least one thing you’re interested in."
      },
      {
        id: "f-consent", errorId: "f-consent-error",
        check: function (el) { return el.checked; },
        message: "Tick the box so we can contact you."
      }
    ];

    // Give the first interest checkbox an id so the error summary can link to it.
    var firstInterest = $('input[type="checkbox"]', group);
    if (firstInterest) firstInterest.id = "f-interest-first";

    function showError(rule, valid) {
      var el = document.getElementById(rule.id);
      var err = document.getElementById(rule.errorId);
      if (valid) {
        el.removeAttribute("aria-invalid");
        err.hidden = true;
        err.textContent = "";
      } else {
        el.setAttribute("aria-invalid", "true");
        err.textContent = rule.message;
        err.hidden = false;
      }
    }

    function validate(rule) {
      var el = document.getElementById(rule.id);
      var valid = rule.check(el);
      showError(rule, valid);
      return valid;
    }

    // Inline validation: after a field has been left once, re-check as the person types.
    rules.forEach(function (rule) {
      var el = document.getElementById(rule.id);
      var inputs = rule.group ? $$("input", el) : [el];
      inputs.forEach(function (input) {
        input.addEventListener("blur", function () {
          if (rule.group) return;
          if (input.value.trim() !== "" && !(rule.id === "f-phone" && input.value.trim() === "+971")) touched[rule.id] = true;
          if (touched[rule.id]) validate(rule);
        });
        input.addEventListener(input.type === "checkbox" ? "change" : "input", function () {
          if (touched[rule.id] || el.getAttribute("aria-invalid") === "true") validate(rule);
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
      $("#error-summary-title").textContent = failed.length === 1
        ? "Please fix 1 thing before sending"
        : "Please fix " + failed.length + " things before sending";
      summary.hidden = false;
      summary.focus();
    }

    function setBusy(busy) {
      submit.disabled = busy;
      submit.setAttribute("aria-busy", busy ? "true" : "false");
      $(".btn-label", submit).textContent = busy ? "Sending your details…" : "Get the investor pack";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.textContent = "";
      status.classList.remove("is-error");
      rules.forEach(function (r) { touched[r.id] = true; });
      var failed = rules.filter(function (rule) { return !validate(rule); });
      if (failed.length) {
        renderSummary(failed);
        return;
      }
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

  /* ---------- Sideways gallery ---------- */
  var scroller = $(".scroller");
  var controls = $(".scroller-controls");
  if (scroller && controls) {
    controls.hidden = false;
    var prev = $('[data-scroll="-1"]', controls);
    var next = $('[data-scroll="1"]', controls);
    var step = function () {
      var card = $(".place", scroller);
      return card ? card.getBoundingClientRect().width + 14 : scroller.clientWidth * 0.8;
    };
    var update = function () {
      var max = scroller.scrollWidth - scroller.clientWidth - 2;
      prev.disabled = scroller.scrollLeft <= 2;
      next.disabled = scroller.scrollLeft >= max;
    };
    $$("[data-scroll]", controls).forEach(function (btn) {
      btn.addEventListener("click", function () {
        scroller.scrollBy({ left: Number(btn.getAttribute("data-scroll")) * step(), behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
    scroller.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", function () { window.requestAnimationFrame(update); });
    if ("IntersectionObserver" in window) {
      var seen = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { update(); seen.disconnect(); }
      }, { rootMargin: "200px 0px" });
      seen.observe(scroller);
    } else {
      update();
    }
  }

  /* ---------- Visualisations: a sideways strip on phones, a plain grid from 640 px.
     Only keep it in the tab order while it actually scrolls. ---------- */
  var situ = $(".situ-scroller");
  if (situ && window.matchMedia) {
    var wide = window.matchMedia("(min-width: 640px)");
    var syncSitu = function () {
      if (wide.matches) {
        situ.removeAttribute("tabindex"); situ.removeAttribute("role"); situ.removeAttribute("aria-label");
      } else {
        situ.setAttribute("tabindex", "0"); situ.setAttribute("role", "region");
        situ.setAttribute("aria-label", "Visualisations, scrolls sideways");
      }
    };
    syncSitu();
    if (wide.addEventListener) wide.addEventListener("change", syncSitu);
  }

  /* ---------- Phone sticky button: hidden while the hero button or the form is on screen ---------- */
  var sticky = $("#sticky-cta");
  var heroCta = $("#hero-cta");
  var formSection = $("#get-the-pack");
  if (sticky && heroCta && formSection && "IntersectionObserver" in window) {
    var heroVisible = true, formVisible = false;
    var sync = function () {
      var show = !heroVisible && !formVisible;
      sticky.hidden = false;
      sticky.classList.toggle("is-away", !show);
      // Keep it out of the tab order and the accessibility tree while it is off screen.
      if (show) sticky.removeAttribute("inert"); else sticky.setAttribute("inert", "");
      sticky.setAttribute("aria-hidden", show ? "false" : "true");
    };
    new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; sync(); }).observe(heroCta);
    new IntersectionObserver(function (entries) { formVisible = entries[0].isIntersecting; sync(); }, { rootMargin: "0px 0px -20% 0px" }).observe(formSection);
    sync();
  }

  /* ---------- Gentle reveals for content below the fold ---------- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    var firstReport = new WeakSet();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (!firstReport.has(el)) {
          firstReport.add(el);
          // Already on screen at load: leave it alone. Below the fold: hide it until it scrolls in.
          if (entry.isIntersecting) { io.unobserve(el); return; }
          el.classList.add("reveal");
          return;
        }
        if (entry.isIntersecting) { el.classList.add("is-in"); io.unobserve(el); }
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    $$(".section h2, .rail-step, .statement, .shot, .sight-card, .situ-grid li, .win-figures li, .market li, .raise, .route, .pilot-figures li, .person").forEach(function (el) {
      io.observe(el);
    });
  }
})();
