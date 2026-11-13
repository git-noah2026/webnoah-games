// WebNoah-Games: gemeinsame Helfer, Speicher, Kopf- und Fußzeile.
// Alle Seiten laden diese Datei zuerst. Pfade sind relativ zu <html data-root="...">.
(() => {
  "use strict";
  const W = window.WNG = window.WNG || {};
  W.games = W.games || {};

  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rnd = n => Math.floor(Math.random() * n);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const two = n => String(n).padStart(2, "0");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement.dataset.root || "./";

  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* Speicher nicht verfügbar */ } }
  };
  const bestKey = (id, v) => "wng:" + id + (v ? ":" + v : "");
  const fmt = (g, v) => g.unit ? `${v} ${g.unit}` : `${v}`;
  // Adresse eines Spiels: eigener Name (slug) im Pfad, externe Spiele direkt
  const href = g => g.ext || `${root}spiele/${g.slug || g.id}/`;
  const variantName = (g, v) => ((g && g.variants) || []).reduce((out, [k, l]) => k === v ? l : out, "");
  const favs = {
    all: () => store.get("wng:favs") || [],
    has: id => favs.all().includes(id),
    toggle(id) {
      const f = favs.all(), i = f.indexOf(id); if (i < 0) f.push(id); else f.splice(i, 1);
      store.set("wng:favs", f);
      if (W.cloud) W.cloud.favs();
      return i < 0;
    }
  };

  function pal() {
    const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim();
    return {
      paper: g("--paper"), sheet: g("--sheet"), sheet2: g("--sheet-2"), grid: g("--grid"), line: g("--line"), fg: g("--fg"), muted: g("--muted"),
      ink: g("--ink"), red: g("--red"), marker: g("--marker"), good: g("--good"), on: g("--on-color"),
      c: [1, 2, 3, 4, 5, 6, 7, 8].map(i => g("--c" + i))
    };
  }
  function rr(x, X, Y, w, hh, r) {
    r = Math.min(r, w / 2, hh / 2);
    x.beginPath(); x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + hh, r); x.arcTo(X + w, Y + hh, X, Y + hh, r);
    x.arcTo(X, Y + hh, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  function karo(x, w, hh, step, p) {
    x.fillStyle = p.sheet; x.fillRect(0, 0, w, hh);
    x.strokeStyle = p.grid; x.lineWidth = 1; x.beginPath();
    for (let i = step; i < w; i += step) { x.moveTo(Math.round(i) + .5, 0); x.lineTo(Math.round(i) + .5, hh); }
    for (let j = step; j < hh; j += step) { x.moveTo(0, Math.round(j) + .5); x.lineTo(w, Math.round(j) + .5); }
    x.stroke();
  }
  const MONO = "600 13px 'IBM Plex Mono', Consolas, monospace";
  const BODY = "600 15px Inter, 'Segoe UI', sans-serif";
  const disp = px => `800 ${px}px Inter, 'Segoe UI', sans-serif`;

  function makeCanvas(stage, Wd, Ht) {
    const wrap = h("div", "board");
    wrap.style.aspectRatio = `${Wd} / ${Ht}`;
    // Auf der Vollbild-Spielseite füllt das Feld die freie Höhe (--gp-chrome = Platz für Leiste, Knöpfe, Status)
    wrap.style.width = `min(100%, ${Math.round(Wd * 1.8)}px, max(240px, calc((100dvh - var(--gp-chrome, 330px)) * ${(Wd / Ht).toFixed(3)})))`;
    const cv = h("canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Wd * dpr; cv.height = Ht * dpr;
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    const ov = h("div", "overlay"); ov.hidden = true;
    wrap.append(cv, ov); stage.append(wrap);
    return {
      wrap, cv, ctx, ov,
      show(title, text, label, fn, note, alt) {
        ov.innerHTML = "";
        const card = h("div", "ov-card");
        if (note) card.append(h("span", "pen", note));
        card.append(h("strong", "", title));
        if (text) card.append(h("p", "", text));
        if (label) { const b = h("button", "btn primary", label); b.type = "button"; b.onclick = fn; card.append(b); setTimeout(() => b.focus({ preventScroll: true }), 0); }
        if (alt) { const b = h("button", "btn", alt[0]); b.type = "button"; b.onclick = alt[1]; card.append(b); }
        ov.append(card); ov.hidden = false;
      },
      hide() { ov.hidden = true; },
      pt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * Wd / r.width, y: (e.clientY - r.top) * Ht / r.height }; }
    };
  }

  function segmented(parent, opts, val, onChange) {
    const g = h("div", "seg"); g.setAttribute("role", "group");
    opts.forEach(([v, l]) => {
      const b = h("button", "", l); b.type = "button";
      b.setAttribute("aria-pressed", String(v === val));
      b.onclick = () => {
        if (b.getAttribute("aria-pressed") === "true") return;
        g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        onChange(v);
      };
      g.append(b);
    });
    parent.append(g); return g;
  }

  const SUB = [["D", "Deutsch"], ["E", "Englisch"], ["M", "Mathematik"], ["RW", "Rechnungs­wesen"], ["BWL", "Betriebs­wirtschaft"], ["INF", "Informatik"], ["GW", "Geografie"], ["BSP", "Bewegung & Sport"]];

  /* ---------- Kopf- und Fußzeile ---------- */
  const LOGO = "https://games.webnoah.andrerer.org/logo.png";
  const REPO = "https://github.com/git-noah2026/webnoah-games";
  function chrome() {
    const head = $("#site-header");
    if (head) {
      head.outerHTML = `
<header class="bar">
  <div class="gutter">
    <a class="brand" href="${root}" aria-label="WebNoah-Games Startseite">
      <span class="mark-logo" aria-hidden="true">W</span>
      <span class="wordmark"><b>WebNoah</b><small>· GAMES ·</small></span>
    </a>
    <nav class="nav" aria-label="Hauptnavigation">
      <a href="${root}#spiele">Spiele</a>
      <a href="${root}bestenliste/">Bestenliste</a>
      <a href="${root}#mitmachen">Mitmachen</a>
    </nav>
    <div class="clock"><span id="clock-day"></span><b id="clock-time"></b></div>
    <div id="account-slot"></div>
  </div>
</header>`;
      const img = new Image();
      img.onload = () => { const m = $(".mark-logo"); if (m) { m.classList.add("has-img"); m.textContent = ""; m.append(img); } };
      img.alt = ""; img.src = LOGO;
    }
    const foot = $("#site-footer");
    if (foot) {
      foot.outerHTML = `
<footer class="foot">
  <div class="gutter">
    <div>
      <b class="display">WebNoah-Games</b>
      <p>Browser-Spiele ohne Konto und ohne Werbung. Ein Projekt der WebNoah Services GmbH, aus der WebNoah+ Familie.</p>
    </div>
    <ul>
      <li><a href="${root}#spiele">Alle Spiele</a></li>
      <li><a href="${REPO}" target="_blank" rel="noopener">Quellcode auf GitHub</a></li>
      <li><a href="${REPO}/issues/new" target="_blank" rel="noopener">Fehler melden</a></li>
    </ul>
    <small>Rekorde und Favoriten werden nur in diesem Browser gespeichert.</small>
  </div>
</footer>`;
    }
    tickClock(); setInterval(tickClock, 15000);
  }
  function tickClock() {
    const now = new Date(), d = $("#clock-day"), t = $("#clock-time");
    if (d) d.textContent = now.toLocaleDateString("de-AT", { weekday: "short" });
    if (t) t.textContent = `${two(now.getHours())}:${two(now.getMinutes())}`;
  }

  Object.assign(W, { $, h, rnd, clamp, shuffle, two, reduced, root, store, bestKey, fmt, variantName, href, favs, pal, rr, karo, MONO, BODY, disp, makeCanvas, segmented, SUB, REPO });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chrome); else chrome();
})();
