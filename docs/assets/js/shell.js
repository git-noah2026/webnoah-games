// WebNoah-Games: Rahmen jeder Spielseite (Kopf, Punkte, Rekord, Tasten, Bestenliste, "Weitere Spiele").
// Erwartet <body data-game="id"> und vorher geladenes spiele/<id>/game.js.
(() => {
  "use strict";
  const { $, h, store, bestKey, favs, root, fmt } = WNG;
  const id = document.body.dataset.game;
  const g = window.WNG_GAMES.find(x => x.id === id);
  const mount = WNG.games[id];
  if (!g || !mount) { $("#stage").textContent = "Dieses Spiel konnte nicht geladen werden."; return; }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let keyDown = null, keyUp = null, restartFn = null, variant = g.variant || "";

  $("#p-eyebrow").textContent = `${g.cats.join(" · ")} · ≈ ${g.mins} Min`;
  $("#p-name").textContent = g.name;
  $("#p-lbl").textContent = g.scoreLabel;
  $("#p-blbl").textContent = g.bestLabel || "Rekord";
  $("#p-help").innerHTML = `<b>So geht’s</b>${g.help}`;

  const fav = $("#p-fav");
  const paintFav = () => { const on = favs.has(id); fav.setAttribute("aria-pressed", String(on)); fav.lastChild.textContent = on ? " Favorit" : " Merken"; };
  fav.addEventListener("click", () => { favs.toggle(id); paintFav(); });
  paintFav();

  /* ---------- Bestenliste ---------- */
  const board = h("section", "lb-panel");
  board.setAttribute("aria-label", "Bestenliste");
  board.hidden = true;
  $("#p-help").after(board);
  let lbSeq = 0;
  async function loadBoard() {
    const auth = WNG.auth;
    if (!auth || !auth.available) { board.hidden = true; return; }
    board.hidden = false;
    const seq = ++lbSeq;
    const label = g.variantLabel && variant ? ` · ${variant === "klein" ? "9 × 9" : "12 × 12"}` : "";
    board.innerHTML = `<div class="lb-head"><h2 class="display">Bestenliste${label}</h2><a href="${root}bestenliste/?spiel=${id}">Alle Bestenlisten →</a></div><p class="lb-empty">Lade …</p>`;
    try {
      const data = await auth.api(`leaderboard?game=${id}&variant=${encodeURIComponent(variant)}`);
      if (seq !== lbSeq) return;
      const rows = data.top.map((r, i) => `
        <li class="${auth.user && r.username.toLowerCase() === auth.user.username.toLowerCase() ? "me" : ""}">
          <span class="lb-rank">${i + 1}</span>
          <a class="lb-user" href="${root}profil/?u=${encodeURIComponent(r.username)}">${auth.avatar(r)}<span>${esc(r.display)}</span></a>
          <b class="lb-val">${fmt(g, r.value)}</b>
        </li>`).join("");
      let foot;
      if (!auth.user) foot = `<p class="lb-cta"><button class="btn primary" type="button" data-login>Anmelden</button> und mit deinem Rekord in die Liste kommen.</p>`;
      else if (data.mine) foot = `<p class="lb-cta">Dein Platz: <b>#${data.mine.rank}</b> mit <mark>${fmt(g, data.mine.value)}</mark></p>`;
      else foot = `<p class="lb-cta">Spiel eine Runde, dann steht dein Rekord hier.</p>`;
      board.querySelector(".lb-empty").outerHTML = (rows ? `<ol class="lb-list">${rows}</ol>` : `<p class="lb-empty">Noch niemand eingetragen. Der erste Platz ist frei.</p>`) + foot;
      const lb = board.querySelector("[data-login]"); if (lb) lb.onclick = () => auth.open("login");
    } catch (e) {
      if (seq === lbSeq) board.querySelector(".lb-empty").textContent = e.message;
    }
  }

  /* ---------- Schnittstelle für das Spiel ---------- */
  const ui = {
    tools: $("#p-tools"),
    score: v => { $("#p-score").textContent = v; },
    status(t, note) {
      const el = $("#p-status"); el.textContent = "";
      if (note) el.append(h("span", "pen", note), " ");
      el.append(t);
    },
    showBest(v) {
      const changed = v !== undefined && v !== variant;
      if (v !== undefined) variant = v;
      const b = store.get(bestKey(id, variant));
      $("#p-best").innerHTML = b == null ? "–" : `<mark>${fmt(g, b)}</mark>`;
      if (changed) loadBoard();
    },
    submit(v, vr) {
      if (vr !== undefined) variant = vr;
      const k = bestKey(id, variant), old = store.get(k);
      const better = old == null || (g.better === "low" ? v < old : v > old);
      if (better) store.set(k, v);
      ui.showBest();
      WNG.cloud && WNG.cloud.record(id, variant, v).then(r => { if (r) loadBoard(); });
      return better;
    },
    get: () => store.get(bestKey(id, variant)),
    set(v) {
      store.set(bestKey(id, variant), v); ui.showBest();
      WNG.cloud && WNG.cloud.record(id, variant, v).then(r => { if (r) loadBoard(); });
    },
    // Spielstand (z. B. erreichtes Level). Mit Konto auch auf dem Server.
    save: data => WNG.cloud ? WNG.cloud.save(id, data) : store.set("wng:save:" + id, data),
    load: () => store.get("wng:save:" + id),
    clearSave() { if (WNG.cloud) WNG.cloud.clear(id); else try { localStorage.removeItem("wng:save:" + id); } catch { /* egal */ } },
    onKey(f) { keyDown = f; }, onKeyUp(f) { keyUp = f; }, onRestart(f) { restartFn = f; }
  };

  document.addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("input, select, textarea, dialog[open]")) return;
    if (e.key === "Escape") { location.href = root; return; }
    if (keyDown) keyDown(e);
  });
  document.addEventListener("keyup", e => { if (keyUp) keyUp(e); });
  $("#p-restart").addEventListener("click", e => { if (restartFn) restartFn(); e.currentTarget.blur(); });

  ui.showBest();
  mount($("#stage"), ui);

  document.addEventListener("wng:sync", () => { ui.showBest(); paintFav(); });
  document.addEventListener("wng:auth", loadBoard);

  // Weitere Spiele: zuerst solche mit gemeinsamer Kategorie
  const others = window.WNG_GAMES.filter(x => x.id !== id)
    .map(x => ({ x, s: x.cats.filter(c => g.cats.includes(c)).length }))
    .sort((a, b) => b.s - a.s).slice(0, 4).map(o => o.x);
  const more = $("#more");
  others.forEach(x => more.append(WNG.card(x)));
})();
