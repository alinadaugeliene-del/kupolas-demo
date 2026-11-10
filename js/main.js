/* ==========================================================
   KUPOLAS — main.js
   1) Generuojami SVG peizažai (.scene[data-scene])
   2) Antraštė, meniu, atsiradimo animacijos
   3) Galerijos filtrai + peržiūra, užklausos forma
   ========================================================== */

(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  /* ---------- palettes ---------- */
  const PALETTES = {
    night: { sky: ["#04070a", "#0b1410", "#1a271f"], far: "#152019", rows: ["#101a14", "#0b130e", "#070b08"], glow: "#f2b766", moon: "#e8e2d4", stars: 160, fog: 0 },
    dusk:  { sky: ["#0f0d12", "#3b2826", "#b8693c"], far: "#3a2a24", rows: ["#221a17", "#15100e", "#0a0807"], glow: "#ffcf8a", sun: "#f3b06a", stars: 14, fog: 0 },
    mist:  { sky: ["#151b18", "#38433b", "#7c8679"], far: "#5a6559", rows: ["#3a453c", "#232b25", "#121713"], glow: "#f6d6a0", stars: 0, fog: 0.55 },
    dawn:  { sky: ["#161d22", "#4c5a5d", "#d3a777"], far: "#55605a", rows: ["#2e3730", "#1b221d", "#0e120f"], glow: "#ffd9a0", sun: "#fbe1b5", stars: 6, fog: 0.25 },
    ember: { sky: ["#07060a", "#1a1214", "#3a2016"], far: "#24171a", rows: ["#170f10", "#0f0a0a", "#070505"], glow: "#ff9b45", moon: "#d8c7a8", stars: 90, fog: 0, fire: true },
    frost: { sky: ["#0a1016", "#1f2d36", "#5b6f78"], far: "#7a8c92", rows: ["#40525a", "#24323a", "#10181d"], glow: "#ffd59a", moon: "#eef1f2", stars: 70, fog: 0.2, snow: true }
  };

  /* deterministic random so each scene looks the same on every load */
  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  let uid = 0;

  function pinePath(x, base, h, w) {
    const t = (f) => base - h * f;
    return [
      "M", x - w, base,
      "L", x - w * 0.42, t(0.32),
      "L", x - w * 0.72, t(0.32),
      "L", x - w * 0.26, t(0.62),
      "L", x - w * 0.46, t(0.62),
      "L", x, t(1),
      "L", x + w * 0.46, t(0.62),
      "L", x + w * 0.26, t(0.62),
      "L", x + w * 0.72, t(0.32),
      "L", x + w * 0.42, t(0.32),
      "L", x + w, base, "Z"
    ].join(" ");
  }

  /* Nuotraukos aprašymas pagal artimiausią antraštę ar užrašą */
  function altFor(host) {
    const box = host.closest("figure, .card, .dome, .tile, .frame, .page-hero, .cta");
    if (!box) return "Kupolas pušyne prie ežero";
    const t = box.querySelector("figcaption, .frame__tag, h3, h2, h1");
    const text = t ? t.textContent.trim() : "";
    if (box.matches(".card, .dome")) return `Kupolas „${text}“ pušyne`;
    return text ? `${text} — Kupolas` : "Kupolas pušyne prie ežero";
  }

  /* Nuotrauka (Unsplash) su piešiniu kaip atsarginiu variantu */
  function buildScene(host) {
    if (host.dataset.img && !host.dataset.failed) {
      const img = new Image();
      img.alt = host.dataset.alt || altFor(host);
      img.decoding = "async";
      const ref = host.dataset.img;
      img.src = ref.startsWith("photo-")
        ? `https://images.unsplash.com/${ref}?w=${host.dataset.w || 1200}&q=72&auto=format&fit=crop`
        : ref; // vietinė nuotrauka, pvz. images/kadras-05.jpg
      if (host.dataset.pos) img.style.objectPosition = host.dataset.pos;
      img.onerror = () => { img.remove(); host.dataset.failed = "1"; drawScene(host); };
      img.onload = () => img.classList.add("is-loaded");
      host.classList.add("scene--photo");
      host.appendChild(img);
      return;
    }
    drawScene(host);
  }

  function drawScene(host) {
    const name = host.dataset.scene || "night";
    const p = PALETTES[name] || PALETTES.night;
    const seed = parseInt(host.dataset.seed || "7", 10);
    const r = rng(seed * 9973 + 17);
    const W = 1600, H = 1000;
    const id = "s" + ++uid;
    const domeX = host.dataset.dome === "none" ? null : W * parseFloat(host.dataset.dome || "0.5");
    const domeR = parseFloat(host.dataset.domeSize || "150");
    const horizon = H * parseFloat(host.dataset.horizon || "0.62");

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMax slice", "aria-hidden": "true" });
    const defs = el("defs", {}, svg);

    // sky gradient
    const sky = el("linearGradient", { id: id + "sky", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    p.sky.forEach((c, i) => el("stop", { offset: [0, 0.55, 1][i], "stop-color": c }, sky));

    // glow gradient
    const glow = el("radialGradient", { id: id + "glow" }, defs);
    el("stop", { offset: 0, "stop-color": p.glow, "stop-opacity": 0.75 }, glow);
    el("stop", { offset: 0.35, "stop-color": p.glow, "stop-opacity": 0.22 }, glow);
    el("stop", { offset: 1, "stop-color": p.glow, "stop-opacity": 0 }, glow);

    // interior light inside dome
    const inner = el("radialGradient", { id: id + "in", cx: 0.5, cy: 0.9, r: 0.8 }, defs);
    el("stop", { offset: 0, "stop-color": p.glow, "stop-opacity": 0.55 }, inner);
    el("stop", { offset: 1, "stop-color": p.glow, "stop-opacity": 0.04 }, inner);

    // fog
    const fog = el("linearGradient", { id: id + "fog", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#cfd6cc", "stop-opacity": 0 }, fog);
    el("stop", { offset: 0.6, "stop-color": "#cfd6cc", "stop-opacity": p.fog * 0.55 }, fog);
    el("stop", { offset: 1, "stop-color": "#cfd6cc", "stop-opacity": 0 }, fog);

    el("rect", { width: W, height: H, fill: `url(#${id}sky)` }, svg);

    // stars
    if (p.stars) {
      const g = el("g", { fill: "#f3efe4" }, svg);
      for (let i = 0; i < p.stars; i++) {
        const c = el("circle", {
          cx: (r() * W).toFixed(1),
          cy: (r() * horizon * 0.85).toFixed(1),
          r: (r() * 1.5 + 0.3).toFixed(2),
          opacity: (r() * 0.7 + 0.2).toFixed(2)
        }, g);
        if (r() > 0.75) {
          c.setAttribute("class", "twinkle");
          c.style.animationDelay = (r() * 4).toFixed(2) + "s";
        }
      }
    }

    // moon or sun
    if (p.moon) {
      const mx = W * (0.72 + r() * 0.16), my = H * (0.14 + r() * 0.08);
      const halo = el("radialGradient", { id: id + "halo" }, defs);
      el("stop", { offset: 0, "stop-color": p.moon, "stop-opacity": 0.22 }, halo);
      el("stop", { offset: 1, "stop-color": p.moon, "stop-opacity": 0 }, halo);
      el("circle", { cx: mx, cy: my, r: 180, fill: `url(#${id}halo)` }, svg);
      el("circle", { cx: mx, cy: my, r: 34, fill: p.moon, opacity: 0.92 }, svg);
      el("circle", { cx: mx + 11, cy: my - 6, r: 30, fill: p.sky[0], opacity: 0.35 }, svg);
    }
    if (p.sun) {
      const sx = W * (0.2 + r() * 0.6), sy = horizon - 30;
      el("circle", { cx: sx, cy: sy, r: 420, fill: `url(#${id}glow)`, opacity: 0.8 }, svg);
      el("circle", { cx: sx, cy: sy, r: 46, fill: p.sun, opacity: 0.9 }, svg);
    }

    // far hills
    let d = `M0 ${H} L0 ${horizon}`;
    for (let x = 0; x <= W; x += 80) {
      d += ` L${x} ${(horizon - 40 - Math.sin(x / 260 + seed) * 40 - r() * 30).toFixed(1)}`;
    }
    d += ` L${W} ${H} Z`;
    el("path", { d, fill: p.far }, svg);

    if (p.fog) el("rect", { y: horizon - 160, width: W, height: 300, fill: `url(#${id}fog)` }, svg);

    // tree rows: back, mid, front
    const rows = [
      { base: horizon + 40, min: 90, max: 170, step: 26, color: p.rows[0] },
      { base: horizon + 110, min: 140, max: 260, step: 46, color: p.rows[1] },
      { base: horizon + 260, min: 260, max: 520, step: 120, color: p.rows[2] }
    ];

    rows.forEach((row, ri) => {
      const g = el("g", { fill: row.color }, svg);
      el("rect", { x: 0, y: row.base - 4, width: W, height: H - row.base + 4 }, g);
      let x = -40;
      while (x < W + 60) {
        const h = row.min + r() * (row.max - row.min);
        // keep clearing around the dome
        const clear = domeX !== null && ri > 0 && Math.abs(x - domeX) < domeR * (ri === 1 ? 1.5 : 2.4);
        if (!clear && !(ri === 2 && r() > 0.55)) {
          el("path", { d: pinePath(x, row.base, h, h * 0.24) }, g);
          if (p.snow && ri < 2) {
            el("path", { d: pinePath(x, row.base - h * 0.62, h * 0.38, h * 0.1), fill: "#c9d3d6", opacity: 0.35 }, g);
          }
        }
        x += row.step * (0.6 + r() * 0.8);
      }

      // dome sits between the mid and front rows
      if (ri === 1 && domeX !== null) drawDome(svg, id, p, domeX, row.base + 30, domeR);
    });

    if (p.fog) el("rect", { y: horizon + 40, width: W, height: 260, fill: `url(#${id}fog)`, opacity: 0.7 }, svg);

    host.appendChild(svg);
  }

  function drawDome(svg, id, p, cx, gy, R) {
    // glow on ground
    el("ellipse", { cx, cy: gy, rx: R * 3.2, ry: R * 1.1, fill: `url(#${id}glow)`, class: "flicker" }, svg);

    // platform
    el("rect", { x: cx - R * 1.25, y: gy, width: R * 2.5, height: 10, fill: "#1a140f" }, svg);

    // body
    el("path", { d: `M${cx - R} ${gy} A${R} ${R} 0 0 1 ${cx + R} ${gy} Z`, fill: "#14110e" }, svg);
    el("path", { d: `M${cx - R} ${gy} A${R} ${R} 0 0 1 ${cx + R} ${gy} Z`, fill: `url(#${id}in)` }, svg);

    // geodesic lattice
    const g = el("g", { stroke: "#c2a273", "stroke-width": 1.4, fill: "none", opacity: 0.75 }, svg);
    const lats = [0, 0.3, 0.58, 0.82];
    const lons = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2];
    const node = (lat, lon) => [cx + R * Math.cos(lat * Math.PI / 2) * Math.sin(lon), gy - R * Math.sin(lat * Math.PI / 2)];
    for (let i = 0; i < lats.length; i++) {
      for (let j = 0; j < lons.length; j++) {
        const a = node(lats[i], lons[j]);
        if (j < lons.length - 1) {
          const b = node(lats[i], lons[j + 1]);
          el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, g);
        }
        const top = i < lats.length - 1 ? node(lats[i + 1], lons[j]) : [cx, gy - R];
        el("line", { x1: a[0], y1: a[1], x2: top[0], y2: top[1] }, g);
        if (i < lats.length - 1 && j < lons.length - 1 && (i + j) % 2 === 0) {
          const c = node(lats[i + 1], lons[j + 1]);
          el("line", { x1: a[0], y1: a[1], x2: c[0], y2: c[1] }, g);
        }
      }
    }
    el("path", { d: `M${cx - R} ${gy} A${R} ${R} 0 0 1 ${cx + R} ${gy}`, stroke: "#c2a273", "stroke-width": 2, fill: "none", opacity: 0.9 }, svg);

    // round window + door
    el("circle", { cx: cx + R * 0.42, cy: gy - R * 0.55, r: R * 0.13, fill: p.glow, opacity: 0.85, class: "flicker" }, svg);
    const dw = R * 0.36, dh = R * 0.62;
    el("path", {
      d: `M${cx - dw / 2} ${gy} L${cx - dw / 2} ${gy - dh + dw / 2} A${dw / 2} ${dw / 2} 0 0 1 ${cx + dw / 2} ${gy - dh + dw / 2} L${cx + dw / 2} ${gy} Z`,
      fill: p.glow, class: "flicker"
    }, svg);

    // fire pit
    if (p.fire) {
      const fx = cx + R * 1.7;
      el("ellipse", { cx: fx, cy: gy + 20, rx: 160, ry: 60, fill: `url(#${id}glow)`, class: "flicker" }, svg);
      el("path", { d: `M${fx - 16} ${gy + 20} Q${fx - 10} ${gy - 20} ${fx} ${gy - 40} Q${fx + 12} ${gy - 14} ${fx + 16} ${gy + 20} Z`, fill: "#ffb25c", class: "flicker" }, svg);
      el("rect", { x: fx - 26, y: gy + 18, width: 52, height: 6, fill: "#3a2416" }, svg);
    }
  }

  /* lazy build scenes when near the viewport */
  const scenes = document.querySelectorAll(".scene[data-scene]");
  if ("IntersectionObserver" in window) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { buildScene(e.target); so.unobserve(e.target); }
      });
    }, { rootMargin: "400px" });
    scenes.forEach((s) => so.observe(s));
  } else {
    scenes.forEach(buildScene);
  }

  /* ---------- header + menu ---------- */
  const header = document.querySelector(".header");
  const onScroll = () => header && header.classList.toggle("is-solid", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = document.querySelector(".burger");
  if (burger) {
    burger.addEventListener("click", () => {
      const open = document.body.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    document.querySelectorAll(".nav a").forEach((a) =>
      a.addEventListener("click", () => {
        document.body.classList.remove("menu-open");
        document.body.style.overflow = "";
      })
    );
  }

  /* ---------- reveal on scroll ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); ro.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach((r) => ro.observe(r));
  } else {
    reveals.forEach((r) => r.classList.add("is-in"));
  }

  /* ---------- gallery ---------- */
  const shots = Array.from(document.querySelectorAll(".shot"));
  document.querySelectorAll(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const f = btn.dataset.filter;
      shots.forEach((s) => s.classList.toggle("is-hidden", f !== "all" && !s.dataset.tags.includes(f)));
    });
  });

  const lb = document.querySelector(".lightbox");
  if (lb && shots.length) {
    const stage = lb.querySelector(".lightbox__stage");
    const cap = lb.querySelector(".lightbox__cap");
    let current = 0;

    const visible = () => shots.filter((s) => !s.classList.contains("is-hidden"));
    const show = (shot) => {
      const src = shot.querySelector(".scene");
      const scene = document.createElement("div");
      scene.className = "scene";
      Object.assign(scene.dataset, src.dataset);
      scene.dataset.w = 2000;
      stage.querySelector(".scene")?.remove();
      stage.prepend(scene);
      buildScene(scene);
      cap.textContent = shot.querySelector("figcaption").textContent;
      current = visible().indexOf(shot);
    };
    const step = (dir) => {
      const v = visible();
      show(v[(current + dir + v.length) % v.length]);
    };
    const close = () => { lb.classList.remove("is-open"); document.body.style.overflow = ""; };

    shots.forEach((s) => s.addEventListener("click", () => {
      show(s);
      lb.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }));
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", () => step(-1));
    lb.querySelector(".lb-next").addEventListener("click", () => step(1));
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
  }

  /* ---------- formos (demo: niekas neišsiunčiama) ---------- */
  const params = new URLSearchParams(location.search);
  document.querySelectorAll("form.form").forEach((form) => {
    // užpildome iš nuorodos: ?kupolas=…, ?paketas=…, ?tema=komanda
    ["kupolas", "paketas"].forEach((k) => {
      const v = params.get(k);
      if (v && form[k]) form[k].value = v;
    });
    if (params.get("tema") === "komanda" && form.zinute && !form.zinute.value) {
      form.zinute.value = "Norėtume visos teritorijos komandai. Žmonių skaičius: … Datos: …";
      if (form.kupolas) form.kupolas.value = "Visa teritorija (komandai)";
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      form.classList.add("is-sent");
      form.querySelector(".form__ok").scrollIntoView({ behavior: "smooth", block: "center" });
      track("generate_lead", { form: form.dataset.name || "form" });
    });
  });

  /* ---------- naujienlaiškis ---------- */
  document.querySelectorAll(".newsletter__form").forEach((f) =>
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      f.classList.add("is-sent");
      track("sign_up", { method: "newsletter" });
    })
  );

  /* ---------- greitas kontaktas (WhatsApp) + mobilus rezervacijos mygtukas ---------- */
  const PHONE = "37060000000";
  const quick = document.createElement("a");
  quick.className = "quick";
  quick.href = `https://wa.me/${PHONE}?text=${encodeURIComponent("Labas! Norėčiau pasiteirauti apie nakvynę kupole.")}`;
  quick.target = "_blank";
  quick.rel = "noopener";
  quick.setAttribute("aria-label", "Parašyti per WhatsApp");
  quick.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2.3-2.3l.8-1-1-2z"/></svg><span class="quick__tip">Klausimas? Rašykite per WhatsApp</span>';
  quick.addEventListener("click", () => track("contact", { method: "whatsapp" }));
  document.body.appendChild(quick);

  if (!document.querySelector("#rezervacija")) {
    const bar = document.createElement("div");
    bar.className = "mobile-bar";
    bar.innerHTML = '<a href="kontaktai.html#rezervacija" class="btn">Laisvos datos</a><a href="tel:+' + PHONE + '" class="btn btn--ghost">Skambinti</a>';
    document.body.appendChild(bar);
    const toggleBar = () => bar.classList.toggle("is-on", window.scrollY > window.innerHeight * 0.6);
    toggleBar();
    window.addEventListener("scroll", toggleBar, { passive: true });
  }

  /* ---------- slapukai + analitika ----------
     Įrašykite savo ID, kai svetainė bus tikra. Kol tušti — niekas neįkeliama. */
  const ANALYTICS = { ga4: "", metaPixel: "" }; // pvz. "G-ABC123XYZ", "1234567890"
  const CONSENT_KEY = "kupolas-cookies";

  function track(event, data) {
    if (window.gtag) window.gtag("event", event, data || {});
    if (window.fbq) window.fbq("trackCustom", event, data || {});
  }

  function loadAnalytics() {
    if (ANALYTICS.ga4 && !window.gtag) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + ANALYTICS.ga4;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", ANALYTICS.ga4, { anonymize_ip: true });
    }
    if (ANALYTICS.metaPixel && !window.fbq) {
      /* oficialus Meta Pixel įkėlimo kodas, sutrumpintas */
      const n = (window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
      n.queue = []; n.loaded = true; n.version = "2.0";
      const s = document.createElement("script");
      s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(s);
      window.fbq("init", ANALYTICS.metaPixel);
      window.fbq("track", "PageView");
    }
  }

  function showCookies() {
    let box = document.querySelector(".cookies");
    if (!box) {
      box = document.createElement("div");
      box.className = "cookies";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-label", "Slapukai");
      box.innerHTML =
        '<p>Naudojame slapukus, kad suprastume, kas svetainėje veikia gerai, ir galėtume rodyti aktualius pasiūlymus. Būtinieji slapukai veikia visada.</p>' +
        '<div class="cookies__btns"><button class="btn" data-c="all">Sutinku</button><button class="btn btn--ghost" data-c="necessary">Tik būtinieji</button></div>';
      document.body.appendChild(box);
      box.addEventListener("click", (e) => {
        const c = e.target.closest("[data-c]");
        if (!c) return;
        localStorage.setItem(CONSENT_KEY, c.dataset.c);
        box.classList.remove("is-on");
        if (c.dataset.c === "all") loadAnalytics();
      });
    }
    requestAnimationFrame(() => box.classList.add("is-on"));
  }

  const consent = localStorage.getItem(CONSENT_KEY);
  if (consent === "all") loadAnalytics();
  else if (!consent) setTimeout(showCookies, 1200);
  document.querySelectorAll("[data-cookie-settings]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); showCookies(); })
  );

  /* footer year */
  document.querySelectorAll("[data-year]").forEach((n) => (n.textContent = new Date().getFullYear()));
})();
