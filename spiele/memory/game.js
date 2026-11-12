// WebNoah-Games: memory. Wird von assets/js/shell.js gestartet.
(() => {
  "use strict";
  const { $, h, rnd, clamp, shuffle, store, pal, rr, karo, makeCanvas, segmented, MONO, BODY, SUB } = WNG;

    function mountMemory(stage, ui) {
    const grid = h("div", "mem"); stage.append(grid);
    let cards, open, moves, found, lock, t0, timer, hideT;
    function deal() {
      clearInterval(timer); clearTimeout(hideT); timer = null; t0 = null;
      moves = 0; found = 0; open = []; lock = false; ui.score(0);
      ui.status("Decke zwei Karten auf. Gleiche Fächer bleiben liegen.");
      cards = shuffle([...SUB.keys(), ...SUB.keys()]);
      grid.innerHTML = "";
      cards.forEach((k, i) => {
        const b = h("button", "mcard"); b.type = "button"; b.dataset.i = i;
        b.style.setProperty("--cc", `var(--c${k + 1})`);
        b.setAttribute("aria-label", "Verdeckte Karte");
        b.innerHTML = `<span class="back"></span><span class="face"><b>${SUB[k][0]}</b><small>${SUB[k][1]}</small></span>`;
        grid.append(b);
      });
    }
    const secs = () => Math.round((Date.now() - t0) / 1000);
    grid.addEventListener("click", e => {
      const b = e.target.closest(".mcard");
      if (!b || lock || b.classList.contains("open")) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(() => ui.status(`Zeit ${secs()} s · ${found} von 8 Paaren`), 1000); }
      b.classList.add("open"); b.setAttribute("aria-label", SUB[cards[b.dataset.i]][1].replace("­", ""));
      open.push(b);
      if (open.length < 2) return;
      moves++; ui.score(moves);
      const [a, d] = open;
      if (cards[a.dataset.i] === cards[d.dataset.i]) {
        a.classList.add("done"); d.classList.add("done"); open = []; found++;
        if (found === SUB.length) {
          clearInterval(timer);
          const rec = ui.submit(moves);
          ui.status(`Alle Paare in ${moves} Zügen und ${secs()} Sekunden.`, rec ? "Neuer Rekord!" : "");
        }
      } else {
        lock = true;
        hideT = setTimeout(() => {
          [a, d].forEach(x => { x.classList.remove("open"); x.setAttribute("aria-label", "Verdeckte Karte"); });
          open = []; lock = false;
        }, 800);
      }
    });
    ui.onRestart(deal); deal();
    return () => { clearInterval(timer); clearTimeout(hideT); };
  }

  WNG.games.memory = mountMemory;
})();
