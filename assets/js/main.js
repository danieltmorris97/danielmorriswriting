// Small enhancements only — every section works without this file.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Mobile menu ----
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // ---- Highlight the nav link for the section in view ----
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]:not(.nav-cta)'));
  if ("IntersectionObserver" in window && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) { a.removeAttribute("aria-current"); });
        var link = byId[entry.target.id];
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }

  // ---- Reveal on scroll ----
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { revealer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // ---- Count-up scoreboard ----
  var counters = document.querySelectorAll("[data-count]");
  var fmt = new Intl.NumberFormat("en-GB");
  var runCount = function (el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var render = function (v) {
      el.textContent = decimals ? v.toFixed(decimals) : fmt.format(Math.round(v));
    };
    if (reduceMotion) { render(target); return; }
    var start = null;
    var duration = 1200;
    var step = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      render(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    var counterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCount(entry.target);
          counterObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { counterObs.observe(el); });
  }

  // ---- Work archive filters ----
  var grid = document.getElementById("work-grid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".work-card"));
  var status = document.getElementById("work-status");
  var moreWrap = document.getElementById("work-more");
  var moreBtn = moreWrap && moreWrap.querySelector("button");
  var INITIAL = 12;
  var state = { type: "all", outlet: "all", expanded: false };

  var apply = function () {
    var filtered = state.type !== "all" || state.outlet !== "all";
    var matches = cards.filter(function (card) {
      return (state.type === "all" || card.getAttribute("data-type") === state.type) &&
             (state.outlet === "all" || card.getAttribute("data-outlet") === state.outlet);
    });
    var limit = filtered || state.expanded ? Infinity : INITIAL;
    cards.forEach(function (card) { card.hidden = true; });
    matches.forEach(function (card, i) { card.hidden = i >= limit; });

    var shown = Math.min(matches.length, limit);
    if (status) {
      status.textContent = matches.length
        ? "Showing " + shown + " of " + matches.length + (filtered ? " matching" : "") + " articles"
        : "No articles match those filters yet. Try another combination.";
    }
    if (moreWrap) moreWrap.hidden = shown >= matches.length;
    if (moreBtn) moreBtn.querySelector("span").textContent = "Show all " + matches.length;
  };

  document.querySelectorAll("[data-filter]").forEach(function (group) {
    var key = group.getAttribute("data-filter");
    group.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      group.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      chip.setAttribute("aria-pressed", "true");
      state[key] = chip.getAttribute("data-value");
      apply();
    });
  });

  if (moreBtn) {
    moreBtn.addEventListener("click", function () {
      state.expanded = true;
      var firstHidden = cards.filter(function (c) { return c.hidden; })[0];
      apply();
      if (firstHidden) {
        var link = firstHidden.querySelector("a") || firstHidden;
        link.focus({ preventScroll: true });
      }
    });
  }

  // Preselect filters from the URL, e.g. /?outlet=hotspawn#work (used by the old Squarespace page redirects).
  var params = new URLSearchParams(window.location.search);
  ["type", "outlet"].forEach(function (key) {
    var value = params.get(key);
    var chip = value && document.querySelector('[data-filter="' + key + '"] .chip[data-value="' + CSS.escape(value) + '"]');
    if (chip) chip.click();
  });

  document.querySelectorAll(".filters").forEach(function (f) { f.hidden = false; });
  apply();
})();
