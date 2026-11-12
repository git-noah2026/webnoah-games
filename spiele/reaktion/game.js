// WebNoah-Games: reaktion. Wird von assets/js/shell.js gestartet.
(() => {
  "use strict";
  const { $, h, rnd, clamp, shuffle, store, pal, rr, karo, makeCanvas, segmented, MONO, BODY, SUB } = WNG;

    function mountReaktion(stage, ui) {
    const ROUNDS = 5;
    const pad = h("button", "react"); pad.type = "button";
    const list = h("ol", "times");
    stage.append(pad, list);
    let s, times, t0, to;
    function show(state, big, small) { s = state; pad.dataset.s = state; pad.innerHTML = `<strong>${big}</strong>${small ? `<span>${small}</span>` : ""}`; }
    function reset() { clearTimeout(to); times = []; list.innerHTML = ""; ui.score("–"); ui.status(""); show("idle", "Bereit?", "Tippe hier oder drücke die Leertaste. Wird die Fläche grün, sofort nochmal tippen."); }
    function hit() {
      if (s === "idle" || s === "early" || s === "shown") {
        show("wait", "Warten …", "Erst bei Grün tippen.");
        to = setTimeout(() => { show("go", "Jetzt!", ""); t0 = performance.now(); }, 1200 + Math.random() * 2600);
      } else if (s === "wait") {
        clearTimeout(to); show("early", "Zu früh", "Tippe, um die Runde zu wiederholen.");
      } else if (s === "go") {
        const ms = Math.round(performance.now() - t0);
        times.push(ms);
        list.append(h("li", "", `<span>Runde ${times.length}</span><b>${ms} ms</b>`));
        if (times.length === ROUNDS) {
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / ROUNDS);
          ui.score(avg + " ms");
          const rec = ui.submit(avg);
          ui.status(`Durchschnitt aus ${ROUNDS} Runden.`, rec ? "Neuer Rekord!" : "");
          show("done", `${avg} ms`, "Tippe für eine neue Serie.");
        } else show("shown", `${ms} ms`, `Runde ${times.length} von ${ROUNDS}. Tippe für die nächste.`);
      } else if (s === "done") { reset(); hit(); }
    }
    pad.addEventListener("pointerdown", e => { e.preventDefault(); hit(); });
    ui.onKey(e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) hit(); } });
    ui.onRestart(reset); reset();
    return () => clearTimeout(to);
  }

  WNG.games.reaktion = mountReaktion;
})();
