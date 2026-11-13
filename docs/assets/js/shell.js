// WebNoah-Games: Rahmen jeder Spielseite. Das Spiel füllt den Bildschirm, oben links geht es zurück ins Hauptmenü.
// Punkte, Rekord, Neustart und eine ausklappbare Leiste mit Spielregeln, Favorit und Bestenliste.
// Erwartet <body data-game="id"> und vorher geladenes spiele/<slug>/<slug>.js.
(() => {
  "use strict";
  const { $, h, store, bestKey, favs, root, fmt } = WNG;
  const id = document.body.dataset.game;
  const g = window.WNG_GAMES.find(x => x.id === id);
  const mount = WNG.games[id];
  if (!g || !mount) { $("#stage").textContent = "Dieses Spiel konnte nicht geladen werden."; return; }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let keyDown = null, keyUp = null, restartFn = null, variant = g.variant || "";

  $("#p-lbl").textContent = g.scoreLabel;
  $("#p-blbl").textContent = g.bestLabel || "Rekord";

  /* ---------- Ausklappbare Leiste: Spielregeln, Favorit, Bestenliste ---------- */
  const drawer = $("#p-drawer"), infoBtn = $("#p-info");
  drawer.querySelector(".gp-d-name").textContent = g.name;
  drawer.querySelector(".gp-d-meta").textContent = `${g.cats.join(" · ")} · ${g.players} · ≈ ${g.mins} Min`;
  drawer.querySelector(".gp-d-help").textContent = g.help;
  const openDrawer = open => {
    drawer.hidden = !open; drawer.setAttribute("aria-hidden", String(!open));
    infoBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("drawer-open", open);
    if (open) { drawer.querySelector(".gp-d-close").focus(); loadBoard(); }
  };
  infoBtn.addEventListener("click", () => openDrawer(drawer.hidden));
  drawer.querySelector(".gp-d-close").addEventListener("click", () => { openDrawer(false); infoBtn.focus(); });
  $("#p-scrim").addEventListener("click", () => openDrawer(false));

  const fav = $("#p-fav");
  const paintFav = () => { const on = favs.has(id); fav.setAttribute("aria-pressed", String(on)); fav.querySelector("span").textContent = on ? "In deinen Favoriten" : "Als Favorit merken"; };
  fav.addEventListener("click", () => { favs.toggle(id); paintFav(); });
  paintFav();

  const board = $("#p-board");
  let lbSeq = 0;
  async function loadBoard() {
    const auth = WNG.auth;
    if (!auth || !auth.available) { board.hidden = true; return; }
    if (drawer.hidden) return; // nur laden, wenn jemand hinschaut
    board.hidden = false;
    const seq = ++lbSeq;
    const label = g.variants && variant ? ` · ${WNG.variantName(g, variant)}` : "";
    board.innerHTML = `<div class="lb-head"><h3 class="display">Bestenliste${label}</h3><a href="${root}bestenliste/?spiel=${id}">Alle →</a></div><p class="lb-empty">Lade …</p>`;
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
      if (!auth.user) foot = `<p class="lb-cta"><button class="btn primary small-btn" type="button" data-login>Anmelden</button> und mit deinem Rekord in die Liste kommen.</p>`;
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
      $("#p-best").textContent = b == null ? "–" : fmt(g, b);
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
    if (e.key === "Escape") {
      if (!drawer.hidden) { openDrawer(false); infoBtn.focus(); return; }
      location.href = root; return;
    }
    if (!drawer.hidden) return; // offene Leiste: Tasten nicht ans Spiel
    if (keyDown) keyDown(e);
  });
  document.addEventListener("keyup", e => { if (keyUp) keyUp(e); });
  $("#p-restart").addEventListener("click", e => { if (restartFn) restartFn(); e.currentTarget.blur(); });

  ui.showBest();
  mount($("#stage"), ui);

  document.addEventListener("wng:sync", () => { ui.showBest(); paintFav(); });
  document.addEventListener("wng:auth", loadBoard);

  // Vom Admin pausiert: Spieler sehen einen Hinweis, Admins dürfen weiter testen
  document.addEventListener("wng:settings", e => {
    const old = document.querySelector(".paused-note"); if (old) old.remove();
    const paused = (e.detail.disabled || []).includes(id);
    const stage = $("#stage");
    if (!paused) { document.body.classList.remove("paused"); return; }
    const admin = WNG.auth.user && WNG.auth.user.role === "admin";
    const note = h("div", "paused-note", admin
      ? `<b>Pausiert.</b> Dieses Spiel ist für Spieler gerade ausgeblendet. Du siehst es, weil du Admin bist.`
      : `<b>Dieses Spiel macht gerade Pause.</b> Es kommt bald wieder. <a href="${root}#spiele">Zu den anderen Spielen →</a>`);
    stage.before(note);
    if (!admin) { document.body.classList.add("paused"); keyDown = keyUp = null; }
  });
})();
