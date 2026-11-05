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

  // ---- Interviews: play inline. Nothing loads from YouTube until someone clicks play. ----
  var stage = document.getElementById("iv-player");
  if (stage && stage.querySelector(".iv-facade")) {
    var ivCards = Array.prototype.slice.call(document.querySelectorAll(".iv-card"));
    var facadeTpl = stage.querySelector(".iv-facade").cloneNode(true);
    var now = {
      name: document.querySelector(".iv-now-name"),
      meta: document.querySelector(".iv-now-meta"),
      quote: document.querySelector(".iv-now-quote"),
      read: document.querySelector('.iv-now-links [data-role="read"]'),
      watch: document.querySelector('.iv-now-links [data-role="watch"]')
    };

    var play = function (id, name) {
      var frame = document.createElement("iframe");
      frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&playsinline=1";
      frame.title = name + " interview";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      stage.replaceChildren(frame);
    };

    var showFacade = function (card) {
      var f = facadeTpl.cloneNode(true);
      var id = card.getAttribute("data-video");
      var name = card.getAttribute("data-name");
      f.href = id ? "https://www.youtube.com/watch?v=" + id : card.getAttribute("data-read");
      f.setAttribute("data-video", id);
      f.classList.toggle("is-written", !id);
      f.querySelector("img").src = card.getAttribute("data-img");
      f.querySelector(".sr-only").textContent = id ? "Play the " + name + " interview" : "Read the " + name + " interview (opens in a new tab)";
      stage.replaceChildren(f);
    };

    var select = function (card) {
      ivCards.forEach(function (c) { c.removeAttribute("aria-current"); });
      card.setAttribute("aria-current", "true");
      var id = card.getAttribute("data-video");
      now.name.textContent = card.getAttribute("data-name");
      now.meta.textContent = card.getAttribute("data-meta");
      now.quote.textContent = "“" + card.getAttribute("data-quote") + "”";
      now.read.href = card.getAttribute("data-read");
      now.watch.hidden = !id;
      if (id) now.watch.href = "https://www.youtube.com/watch?v=" + id;
    };

    stage.addEventListener("click", function (e) {
      var f = e.target.closest(".iv-facade");
      if (!f || !f.getAttribute("data-video")) return; // written-only: follow the link to the article
      e.preventDefault();
      var current = document.querySelector('.iv-card[aria-current="true"]');
      play(f.getAttribute("data-video"), current ? current.getAttribute("data-name") : "Video");
    });

    ivCards.forEach(function (card) {
      card.addEventListener("click", function (e) {
        e.preventDefault();
        select(card);
        var id = card.getAttribute("data-video");
        if (id) play(id, card.getAttribute("data-name"));
        else showFacade(card);
        var r = stage.getBoundingClientRect();
        if (r.top < 64 || r.bottom > window.innerHeight) {
          stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        }
      });
    });
  }

  // ---- TikTok: one video at a time, loaded only when someone presses play ----
  var ttPlayer = document.getElementById("tt-player");
  if (ttPlayer) {
    var ttRows = Array.prototype.slice.call(document.querySelectorAll(".tt-row"));
    var ttPlay = function (id, title) {
      var frame = document.createElement("iframe");
      frame.src = "https://www.tiktok.com/player/v1/" + id + "?autoplay=1&rel=0&description=0&music_info=0&native_context_menu=0";
      frame.title = title || "TikTok video";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      ttPlayer.replaceChildren(frame);
    };
    ttPlayer.addEventListener("click", function (e) {
      var f = e.target.closest(".tt-facade");
      if (!f) return;
      e.preventDefault();
      var current = document.querySelector('.tt-row[aria-current="true"]');
      ttPlay(f.getAttribute("data-tt"), current && current.getAttribute("data-title"));
    });
    ttRows.forEach(function (row) {
      row.addEventListener("click", function (e) {
        e.preventDefault();
        ttRows.forEach(function (r) { r.removeAttribute("aria-current"); });
        row.setAttribute("aria-current", "true");
        ttPlay(row.getAttribute("data-tt"), row.getAttribute("data-title"));
        var r = ttPlayer.getBoundingClientRect();
        if (r.top < 64 || r.bottom > window.innerHeight) {
          ttPlayer.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        }
      });
    });
  }

  // ---- Copy email button (only shown where the clipboard API works) ----
  document.querySelectorAll(".email-copy").forEach(function (btn) {
    if (!(navigator.clipboard && window.isSecureContext)) return;
    btn.hidden = false;
    var label = btn.querySelector("span");
    var announce = btn.parentElement.querySelector("[data-copy-status]");
    var timer;
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(function () {
        btn.classList.add("is-copied");
        label.textContent = "Copied";
        if (announce) announce.textContent = "Email address copied";
        clearTimeout(timer);
        timer = setTimeout(function () {
          btn.classList.remove("is-copied");
          label.textContent = "Copy";
          if (announce) announce.textContent = "";
        }, 2000);
      });
    });
  });

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
