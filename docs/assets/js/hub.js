// WebNoah-Games: Startseite (Sternenhimmel, Rampenlicht, Bibliothek, Ruhmeshalle).
(() => {
  "use strict";
  const { $, h, favs, two, reduced, pal, fmt, root } = WNG;
  const GAMES = window.WNG_GAMES;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Kopfzeile wird beim Scrollen fest ---------- */
  const onScroll = () => document.body.classList.toggle("scrolled", scrollY > 24);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Kennzahlen ---------- */
  const cats = new Set(GAMES.flatMap(g => g.cats));
  $("#hero-stats").innerHTML = [
    [GAMES.length, "Spiele"], [GAMES.filter(g => g.isNew).length, "neu"], [cats.size, "Kategorien"], [0, "Werbung"]
  ].map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join("");

  /* ---------- Sternenhimmel ---------- */
  (function sky() {
    const cv = $("#sky"), hero = $("#top"); if (!cv) return;
    const x = cv.getContext("2d");
    let w = 0, hh = 0, stars = [], dust = [], raf = 0, onScreen = true, p = pal();
    const mouse = { x: -1e4, y: -1e4 };
    const newDust = init => ({ x: Math.random() * w, y: init ? Math.random() * hh : hh + 10, r: Math.random() * 1.6 + .5, v: .12 + Math.random() * .3, a: Math.random() * .5 + .25, ph: Math.random() * 6.28 });
    function size() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; hh = r.height; cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(260, Math.round(w * hh / 5200));
      stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * hh, r: Math.random() * 1.2 + .25, p: Math.random() * 6.28, s: .4 + Math.random() * 1.4, vx: (Math.random() - .5) * .05, vy: (Math.random() - .5) * .03 }));
      dust = Array.from({ length: Math.round(n / 5) }, () => newDust(true));
      draw(performance.now());
    }
    function draw(t) {
      x.clearRect(0, 0, w, hh);
      x.fillStyle = p.fg;
      for (const s of stars) {
        if (!reduced) { s.x = (s.x + s.vx + w) % w; s.y = (s.y + s.vy + hh) % hh; }
        x.globalAlpha = .3 + .45 * (reduced ? .6 : Math.sin(t * .001 * s.s + s.p) * .5 + .5);
        x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.283); x.fill();
      }
      // Sternbild um den Mauszeiger
      const near = stars.filter(s => Math.abs(s.x - mouse.x) < 160 && Math.abs(s.y - mouse.y) < 160);
      x.strokeStyle = p.ink; x.lineWidth = .7;
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
        const d = Math.hypot(near[i].x - near[j].x, near[i].y - near[j].y);
        if (d > 95) continue;
        x.globalAlpha = (1 - d / 95) * .55;
        x.beginPath(); x.moveTo(near[i].x, near[i].y); x.lineTo(near[j].x, near[j].y); x.stroke();
      }
      // Goldstaub steigt auf
      x.fillStyle = p.marker;
      for (const d of dust) {
        if (!reduced) { d.y -= d.v; d.x += Math.sin(t * .0006 + d.ph) * .25; if (d.y < -10) Object.assign(d, newDust(false)); }
        x.globalAlpha = d.a * (.55 + .45 * Math.sin(t * .002 + d.ph));
        x.beginPath(); x.arc(d.x, d.y, d.r, 0, 6.283); x.fill();
      }
      x.globalAlpha = 1;
    }
    function loop(t) { raf = 0; if (!onScreen || document.hidden) return; draw(t); raf = requestAnimationFrame(loop); }
    const kick = () => { if (!reduced && !raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop); };
    new ResizeObserver(size).observe(cv);
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; kick(); }).observe(hero);
    document.addEventListener("visibilitychange", kick);
    hero.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; if (reduced) draw(performance.now()); });
    hero.addEventListener("pointerleave", () => { mouse.x = mouse.y = -1e4; });
    kick();
  })();

  /* ---------- Neigung mit Lichtreflex (Vitrine und Karten) ---------- */
  function tilt(el, max, onMove) {
    if (!finePointer || reduced) return;
    el.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.classList.add("tilting");
      el.style.setProperty("--ry", `${(px - .5) * max * 2}deg`);
      el.style.setProperty("--rx", `${(.5 - py) * max * 1.6}deg`);
      if (onMove) onMove(px, py);
    });
    el.addEventListener("pointerleave", () => {
      el.classList.remove("tilting");
      el.style.removeProperty("--ry"); el.style.removeProperty("--rx");
    });
  }
  const vitrine = $("#vitrine"), spotArt = $("#spot-art");
  tilt(vitrine, 7, (px, py) => { spotArt.style.setProperty("--gx", `${px * 100}%`); spotArt.style.setProperty("--gy", `${py * 100}%`); });

  /* ---------- Rampenlicht ---------- */
  const spots = GAMES.filter(g => g.spotlight != null).sort((a, b) => a.spotlight - b.spotlight);
  let spotIdx = 0, spotTimer = 0;
  const spotNav = $("#spot-nav");
  spots.forEach((g, i) => {
    const b = h("button", "spot-pick", `<b>${esc(g.name)}</b><span>${esc(g.cats[0])}</span>`);
    b.type = "button"; b.onclick = () => { showSpot(i); restartSpot(); };
    spotNav.append(b);
  });
  function showSpot(i) {
    spotIdx = (i + spots.length) % spots.length;
    const g = spots[spotIdx];
    $("#spot-count").textContent = `${two(spotIdx + 1)} / ${two(spots.length)}`;
    $("#spot-name").textContent = g.name;
    $("#spot-text").textContent = g.long || g.desc;
    $("#spot-tags").innerHTML = [g.players, `≈ ${g.mins} Min`, g.ext ? "Original" : ""].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("");
    const play = $("#spot-play");
    play.href = WNG.href(g);
    play.textContent = g.ext ? "Original öffnen ↗" : "Jetzt spielen";
    if (g.ext) { play.target = "_blank"; play.rel = "noopener"; } else { play.removeAttribute("target"); play.removeAttribute("rel"); }
    WNG.thumbs.detachAll(spotArt);
    spotArt.querySelectorAll("canvas").forEach(c => c.remove());
    const cv = h("canvas"); cv.setAttribute("aria-hidden", "true"); spotArt.prepend(cv);
    spotArt.classList.remove("swap"); void spotArt.offsetWidth; spotArt.classList.add("swap");
    WNG.thumbs.attach(cv, g.id);
    spotNav.querySelectorAll(".spot-pick").forEach((b, k) => b.setAttribute("aria-current", String(k === spotIdx)));
  }
  function restartSpot() {
    clearInterval(spotTimer);
    if (!reduced) spotTimer = setInterval(() => { if (!document.hidden && !$("#spot").matches(":hover, :focus-within")) showSpot(spotIdx + 1); }, 8000);
  }
  $("#spot-prev").onclick = () => { showSpot(spotIdx - 1); restartSpot(); };
  $("#spot-next").onclick = () => { showSpot(spotIdx + 1); restartSpot(); };
  showSpot(0); restartSpot();

  /* ---------- Bibliothek ---------- */
  const CATS = ["Alle", "Kurze Spiele", "Denkspiele", "Action", "Logik", "Strategie", "Geschicklichkeit", "Zu zweit"];
  const ICON = {
    "Alle": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    "Kurze Spiele": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    "Denkspiele": '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    "Action": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "Logik": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    "Strategie": '<path d="M8 21h8M9 17h6l-1-6h2l-1-4h-1V4h-2v2h-2V4H8v3H7l-1 4h2z"/>',
    "Geschicklichkeit": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    "Zu zweit": '<circle cx="8" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.8"/><path d="M2 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5M14.5 14.6c.8-.4 1.6-.6 2.5-.6 2.4 0 4.3 1.6 5 4.5"/>'
  };
  const state = { tab: "all", cat: "Alle", q: "" };
  const catsEl = $("#cats");
  CATS.forEach(c => {
    const n = c === "Alle" ? GAMES.length : GAMES.filter(g => g.cats.includes(c)).length;
    if (!n) return;
    const b = h("button", "cat", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[c]}</svg>${c}<span>${n}</span>`);
    b.type = "button"; b.dataset.cat = c;
    b.onclick = () => { state.cat = c; render(); };
    catsEl.append(b);
  });
  const tabs = $("#tabs");
  tabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { state.tab = b.dataset.tab; render(); } });
  const q = $("#q");
  q.addEventListener("input", () => { state.q = q.value.trim().toLowerCase(); render(); });
  document.addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("dialog[open]")) return;
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); $("#spiele").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }
    else if (e.key === "Escape" && document.activeElement === q) { q.value = ""; state.q = ""; render(); q.blur(); }
  });
  $("#random").onclick = () => { const pool = GAMES.filter(g => !g.ext); location.href = WNG.href(pool[Math.floor(Math.random() * pool.length)]); };

  const grid = $("#cards");
  function render() {
    const f = favs.all();
    tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tab === state.tab)));
    $("#fav-count").textContent = f.length;
    catsEl.querySelectorAll(".cat").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)));
    const list = GAMES.filter(g =>
      (state.tab === "all" || f.includes(g.id)) &&
      (state.cat === "Alle" || g.cats.includes(state.cat)) &&
      (!state.q || (g.name + " " + g.desc + " " + g.cats.join(" ")).toLowerCase().includes(state.q)));
    $("#hits").textContent = `${list.length} von ${GAMES.length} Spielen`;
    WNG.thumbs.detachAll(grid);
    grid.innerHTML = "";
    list.forEach(g => {
      const card = WNG.card(g, () => { if (state.tab === "fav") render(); else $("#fav-count").textContent = favs.all().length; });
      tilt(card, 6, (px, py) => { card.style.setProperty("--gx", `${px * 100}%`); card.style.setProperty("--gy", `${py * 100}%`); });
      grid.append(card);
    });
    const empty = $("#empty");
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.innerHTML = state.tab === "fav" && !f.length
        ? "<b>Noch keine Favoriten.</b> Tippe auf den Stern an einer Spielkarte, dann landet sie hier."
        : `<b>Nichts gefunden.</b> Versuch einen anderen Suchbegriff oder die Kategorie „Alle“.`;
    }
  }
  render();
  // Nach dem Anmelden kommen Rekorde und Favoriten vom Server
  document.addEventListener("wng:sync", render);

  /* ---------- Ruhmeshalle ---------- */
  const CROWN = '<svg viewBox="0 0 24 15" aria-hidden="true"><path fill="currentColor" d="M1 4l5 4 6-7 6 7 5-4-2 11H3z"/></svg>';
  async function fame() {
    const auth = await WNG.auth.ready;
    const sec = $("#ruhm");
    if (!auth.available) { sec.hidden = true; return; }
    const games = GAMES.filter(g => !g.ext);
    const boards = await Promise.all(games.map(g =>
      auth.api(`leaderboard?game=${g.id}&variant=${encodeURIComponent(g.variant || "")}`).catch(() => null)));
    $("#plaques").innerHTML = games.map((g, i) => {
      const top = boards[i] && boards[i].top[0];
      const label = `<div class="game"><span>${esc(g.name)}${g.variantLabel ? ` · ${g.variantLabel}` : ""}</span><b>Platz 1</b></div>`;
      if (!top) return `<a class="plaque free" href="${WNG.href(g)}">${label}
          <span class="crown"><span class="avatar">?</span></span>
          <span class="who"><strong>Noch frei</strong><span>Sei die oder der Erste</span></span>
          <span class="score">–</span></a>`;
      return `<a class="plaque" href="${root}profil/?u=${encodeURIComponent(top.username)}">${label}
          <span class="crown">${CROWN}${auth.avatar(top)}</span>
          <span class="who"><strong>${esc(top.display)}</strong><span>@${esc(top.username)}</span></span>
          <span class="score gold-text">${fmt(g, top.value)}</span></a>`;
    }).join("");
    sec.hidden = false;
  }
  fame();
  document.addEventListener("wng:auth", () => { WNG.auth.ready.then(fame); });
})();
