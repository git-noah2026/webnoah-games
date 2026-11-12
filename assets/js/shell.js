// WebNoah-Games: Rahmen jeder Spielseite (Kopf, Punkte, Rekord, Tasten, "Weitere Spiele").
// Erwartet <body data-game="id"> und vorher geladenes spiele/<id>/game.js.
(() => {
  "use strict";
  const { $, h, store, bestKey, favs, root, fmt } = WNG;
  const id = document.body.dataset.game;
  const g = window.WNG_GAMES.find(x => x.id === id);
  const mount = WNG.games[id];
  if (!g || !mount) { $("#stage").textContent = "Dieses Spiel konnte nicht geladen werden."; return; }

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

  const ui = {
    tools: $("#p-tools"),
    score: v => { $("#p-score").textContent = v; },
    status(t, note) {
      const el = $("#p-status"); el.textContent = "";
      if (note) el.append(h("span", "pen", note), " ");
      el.append(t);
    },
    showBest(v) {
      if (v !== undefined) variant = v;
      const b = store.get(bestKey(id, variant));
      $("#p-best").innerHTML = b == null ? "–" : `<mark>${fmt(g, b)}</mark>`;
    },
    submit(v, vr) {
      if (vr !== undefined) variant = vr;
      const k = bestKey(id, variant), old = store.get(k);
      const better = old == null || (g.better === "low" ? v < old : v > old);
      if (better) store.set(k, v);
      ui.showBest(); return better;
    },
    get: () => store.get(bestKey(id, variant)),
    set(v) { store.set(bestKey(id, variant), v); ui.showBest(); },
    onKey(f) { keyDown = f; }, onKeyUp(f) { keyUp = f; }, onRestart(f) { restartFn = f; }
  };

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { location.href = root; return; }
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    if (keyDown) keyDown(e);
  });
  document.addEventListener("keyup", e => { if (keyUp) keyUp(e); });
  $("#p-restart").addEventListener("click", e => { if (restartFn) restartFn(); e.currentTarget.blur(); });

  ui.showBest();
  mount($("#stage"), ui);

  // Weitere Spiele: zuerst solche mit gemeinsamer Kategorie
  const others = window.WNG_GAMES.filter(x => x.id !== id)
    .map(x => ({ x, s: x.cats.filter(c => g.cats.includes(c)).length }))
    .sort((a, b) => b.s - a.s).slice(0, 4).map(o => o.x);
  const more = $("#more");
  others.forEach(x => more.append(WNG.card(x)));
})();
