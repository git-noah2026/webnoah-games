// WebNoah-Games: Startseite (Rampenlicht, Pausenplan, Suche, Kategorien, Favoriten).
(() => {
  "use strict";
  const { $, h, favs, two, reduced } = WNG;
  const GAMES = window.WNG_GAMES;
  const CATS = ["Alle", "Kurze Spiele", "Denkspiele", "Action", "Logik", "Strategie", "Geschicklichkeit", "Zu zweit"];
  const state = { tab: "all", cat: "Alle", q: "" };

  $("#count-line").textContent = `${GAMES.length} Spiele · werbefrei · ohne Konto`;

  /* ---------- Rampenlicht ---------- */
  const spots = GAMES.filter(g => g.spotlight != null).sort((a, b) => a.spotlight - b.spotlight);
  let spotIdx = 0, spotTimer = 0;
  const spotNav = $("#spot-nav");
  spots.forEach((g, i) => {
    const b = h("button", "spot-pick", `<b>${g.name}</b><span>${g.cats[0]}</span>`);
    b.type = "button"; b.onclick = () => { showSpot(i); restartSpot(); };
    spotNav.append(b);
  });
  function showSpot(i) {
    spotIdx = (i + spots.length) % spots.length;
    const g = spots[spotIdx], art = $("#spot-art");
    $("#spot-count").textContent = `${two(spotIdx + 1)} / ${two(spots.length)}`;
    $("#spot-name").textContent = g.name;
    $("#spot-text").textContent = g.long || g.desc;
    $("#spot-tags").innerHTML = [g.cats[0], g.players, `≈ ${g.mins} Min`, g.ext ? "Original" : (g.isNew ? "Neu" : "")].filter(Boolean).map(t => `<span>${t}</span>`).join("");
    const play = $("#spot-play");
    play.href = WNG.href(g);
    if (g.ext) { play.target = "_blank"; play.rel = "noopener"; } else { play.removeAttribute("target"); play.removeAttribute("rel"); }
    WNG.thumbs.detachAll(art);
    art.innerHTML = "";
    const cv = h("canvas"); cv.setAttribute("aria-hidden", "true"); art.append(cv);
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

  /* ---------- Pausenplan ---------- */
  const DAY = [
    ["L", "1", "07:50", "08:40"], ["P", "Kleine Pause", "08:40", "08:45"],
    ["L", "2", "08:45", "09:35"], ["P", "Große Pause", "09:35", "09:50"],
    ["L", "3", "09:50", "10:40"], ["P", "Kleine Pause", "10:40", "10:45"],
    ["L", "4", "10:45", "11:35"], ["P", "Pause", "11:35", "11:45"],
    ["L", "5", "11:45", "12:35"], ["P", "Mittagspause", "12:35", "13:20"],
    ["L", "6", "13:20", "14:10"]
  ].map(([k, n, a, b]) => { const m = s => +s.slice(0, 2) * 60 + +s.slice(3); return { k, n, a, b, s: m(a), e: m(b) }; });
  const D0 = DAY[0].s, D1 = DAY[DAY.length - 1].e;
  const chip = g => `<a class="chip" href="${WNG.href(g)}"${g.ext ? ' target="_blank" rel="noopener"' : ""}>${g.name}${g.ext ? " ↗" : ""}</a>`;
  function renderDay() {
    const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), wd = now.getDay();
    const school = wd >= 1 && wd <= 5;
    const pct = v => ((v - D0) / (D1 - D0) * 100).toFixed(3) + "%";
    let next = null, inBreak = null;
    if (school) {
      inBreak = DAY.find(d => d.k === "P" && m >= d.s && m < d.e) || null;
      if (!inBreak) next = DAY.find(d => d.k === "P" && d.s > m) || null;
    }
    const track = $("#track"); track.innerHTML = "";
    DAY.forEach(d => {
      const el = h("div", "blk " + (d.k === "L" ? "lesson" : "brk") + (d === next || d === inBreak ? " next" : ""), d.k === "L" ? d.n : "");
      el.style.left = pct(d.s); el.style.width = pct(D0 + d.e - d.s);
      el.title = `${d.k === "L" ? d.n + ". Stunde" : d.n} · ${d.a}–${d.b}`;
      track.append(el);
    });
    if (school && m >= D0 && m <= D1) { const n = h("div", "now"); n.style.left = pct(m); n.title = "Jetzt"; track.append(n); }
    const fits = mins => GAMES.filter(g => g.mins <= mins);
    let head, list;
    if (inBreak) {
      const rest = inBreak.e - m;
      head = `Jetzt ist ${inBreak.n}. <span>Noch ${rest} Min, das passt:</span>`;
      list = fits(rest); if (!list.length) list = GAMES.filter(g => g.id === "reaktion");
    } else if (next) {
      const len = next.e - next.s;
      head = `Nächste Pause um ${next.a}: ${next.n}, ${len} Min. <span>In ${next.s - m} Min. Passt hinein:</span>`;
      list = fits(len);
    } else {
      head = school ? `Unterricht vorbei. <span>Heute passt alles:</span>` : `Kein Unterricht heute. <span>Alle Spiele passen:</span>`;
      list = GAMES;
    }
    $("#next-break").innerHTML = `<p>${head}</p><div class="chips">${list.map(chip).join("")}</div>`;
  }
  renderDay(); setInterval(renderDay, 20000);

  /* ---------- Bibliothek ---------- */
  const catsEl = $("#cats");
  CATS.forEach(c => {
    const n = c === "Alle" ? GAMES.length : GAMES.filter(g => g.cats.includes(c)).length;
    if (!n) return;
    const b = h("button", "cat", `${c}<span>${n}</span>`); b.type = "button"; b.dataset.cat = c;
    b.onclick = () => { state.cat = c; render(); };
    catsEl.append(b);
  });
  const tabs = $("#tabs");
  tabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { state.tab = b.dataset.tab; render(); } });
  const q = $("#q");
  q.addEventListener("input", () => { state.q = q.value.trim().toLowerCase(); render(); });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); }
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
    $("#hits").textContent = `${list.length} ${list.length === 1 ? "Treffer" : "Treffer"}`;
    $("#spot").hidden = !!state.q;
    WNG.thumbs.detachAll(grid);
    grid.innerHTML = "";
    list.forEach(g => grid.append(WNG.card(g, () => { if (state.tab === "fav") render(); else $("#fav-count").textContent = favs.all().length; })));
    const empty = $("#empty");
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.innerHTML = state.tab === "fav" && !f.length
        ? "<b>Noch keine Favoriten.</b> Tippe auf den Stern an einer Spielkarte, dann landet sie hier."
        : `<b>Nichts gefunden.</b> Versuch einen anderen Suchbegriff oder die Kategorie „Alle“.`;
    }
  }
  render();
})();
