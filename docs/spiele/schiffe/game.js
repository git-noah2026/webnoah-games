// WebNoah-Games: Schiffe versenken gegen den Computer. Wird von assets/js/shell.js gestartet.
// Regeln: 10 × 10, Schiffe berühren sich nicht (auch nicht schräg), ein Treffer erlaubt einen weiteren Schuss.
(() => {
  "use strict";
  const { h, rnd } = WNG;

  const N = 10;
  const FLEET = [["Träger", 5], ["Kreuzer", 4], ["Fregatte", 3], ["U-Boot", 3], ["Schnellboot", 2]];
  const idx = (x, y) => y * N + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const COLS = "ABCDEFGHIJ";

  function cellsOf(x, y, len, vert) {
    const out = [];
    for (let k = 0; k < len; k++) { const cx = x + (vert ? 0 : k), cy = y + (vert ? k : 0); if (!inside(cx, cy)) return null; out.push(idx(cx, cy)); }
    return out;
  }
  function fits(owner, cells) {
    if (!cells) return false;
    for (const c of cells) {
      const x = c % N, y = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (inside(x + dx, y + dy) && owner[idx(x + dx, y + dy)] >= 0) return false;
      }
    }
    return true;
  }
  function randomFleet() {
    for (let attempt = 0; attempt < 200; attempt++) {
      const owner = Array(N * N).fill(-1), ships = [];
      let ok = true;
      for (let s = 0; s < FLEET.length && ok; s++) {
        let placed = false;
        for (let t = 0; t < 300 && !placed; t++) {
          const vert = Math.random() < .5, cells = cellsOf(rnd(N), rnd(N), FLEET[s][1], vert);
          if (fits(owner, cells)) { cells.forEach(c => owner[c] = s); ships.push({ cells, hits: 0 }); placed = true; }
        }
        ok = placed;
      }
      if (ok) return { owner, ships };
    }
    throw new Error("Flotte ließ sich nicht platzieren");
  }
  const around = cells => {
    const out = new Set();
    for (const c of cells) { const x = c % N, y = (c / N) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy)) out.add(idx(x + dx, y + dy)); }
    cells.forEach(c => out.delete(c));
    return [...out];
  };

  function mountSchiffe(stage, ui) {
    const wrap = h("div", "bs");
    wrap.innerHTML = `
      <section class="bs-side" id="bs-own"><h3>Deine Flotte <small id="bs-own-left"></small></h3><div class="bs-grid own"></div></section>
      <section class="bs-side" id="bs-foe"><h3>Gegnerisches Meer <small id="bs-foe-left"></small></h3><div class="bs-grid foe"></div></section>
      <div class="bs-dock" id="bs-dock"></div>`;
    stage.append(wrap);
    const ownGrid = wrap.querySelector(".own"), foeGrid = wrap.querySelector(".foe"), dock = wrap.querySelector("#bs-dock");
    const mkCells = grid => Array.from({ length: N * N }, (_, i) => {
      const b = h("button", "bs-cell"); b.type = "button"; b.dataset.i = i;
      b.setAttribute("aria-label", `${COLS[i % N]}${((i / N) | 0) + 1}`);
      grid.append(b); return b;
    });
    const ownCells = mkCells(ownGrid), foeCells = mkCells(foeGrid);

    const rotBtn = h("button", "btn", "⟲ Drehen (R)"); rotBtn.type = "button";
    const rndBtn = h("button", "btn", "Zufällig aufstellen"); rndBtn.type = "button";
    const goBtn = h("button", "btn primary", "Schlacht beginnen"); goBtn.type = "button";
    ui.tools.append(rotBtn, rndBtn, goBtn);

    let phase, me, foe, myShots, foeShots, shots, vert, placing, hover = -1, cpuT, ai;

    function reset() {
      clearTimeout(cpuT);
      phase = "place"; vert = false; placing = 0; shots = 0;
      me = { owner: Array(N * N).fill(-1), ships: [] };
      foe = randomFleet();
      myShots = Array(N * N).fill(0);   // 0 unbekannt, 1 Wasser, 2 Treffer
      foeShots = Array(N * N).fill(0);
      ai = { queue: [], hits: [] };
      ui.score(0);
      [rotBtn, rndBtn, goBtn].forEach(b => b.hidden = false);
      wrap.classList.remove("battle");
      paint(); say();
    }
    function say(text) {
      if (text) return ui.status(text);
      if (phase === "place") ui.status(placing < FLEET.length
        ? `Platziere ${FLEET[placing][0]} (${FLEET[placing][1]} Felder) auf deinem Feld. Schiffe dürfen sich nicht berühren.`
        : "Flotte steht. Starte die Schlacht oder stell um.");
    }
    const preview = () => hover >= 0 && placing < FLEET.length ? cellsOf(hover % N, (hover / N) | 0, FLEET[placing][1], vert) : null;

    function paint() {
      const pv = phase === "place" ? preview() : null, pvOk = pv && fits(me.owner, pv);
      ownCells.forEach((b, i) => {
        const s = me.owner[i];
        b.className = "bs-cell" + (s >= 0 ? " ship" : "") + (foeShots[i] === 1 ? " miss" : "") + (foeShots[i] === 2 ? " hit" : "")
          + (s >= 0 && me.ships[s] && me.ships[s].hits === me.ships[s].cells.length ? " sunk" : "")
          + (pv && pv.includes(i) ? (pvOk ? " pv" : " pv bad") : "");
      });
      foeCells.forEach((b, i) => {
        const s = foe.owner[i], sunk = s >= 0 && foe.ships[s].hits === foe.ships[s].cells.length;
        const reveal = phase === "over" && s >= 0;
        b.className = "bs-cell" + (myShots[i] === 1 ? " miss" : "") + (myShots[i] === 2 ? " hit" : "") + (sunk ? " sunk ship" : "") + (reveal && !sunk ? " ship ghost" : "");
        b.disabled = phase !== "battle" || myShots[i] !== 0;
      });
      const left = fleet => fleet.ships.filter(s => s.hits < s.cells.length).length;
      wrap.querySelector("#bs-own-left").textContent = phase === "place" ? `${placing} von ${FLEET.length} gesetzt` : `${left(me)} Schiffe übrig`;
      wrap.querySelector("#bs-foe-left").textContent = phase === "place" ? "" : `${left(foe)} Schiffe übrig`;
      dock.innerHTML = FLEET.map(([n, l], i) => {
        const st = phase === "place" ? (i < placing ? "done" : i === placing ? "now" : "") : (foe.ships[i].hits === l ? "done" : "");
        return `<span class="bs-ship ${st}"><b>${n}</b><i style="--l:${l}"></i></span>`;
      }).join("");
      goBtn.disabled = placing < FLEET.length;
    }

    /* ---------- Aufstellen ---------- */
    ownGrid.addEventListener("pointerover", e => { const b = e.target.closest(".bs-cell"); if (b && phase === "place") { hover = +b.dataset.i; paint(); } });
    ownGrid.addEventListener("pointerleave", () => { hover = -1; if (phase === "place") paint(); });
    ownGrid.addEventListener("click", e => {
      const b = e.target.closest(".bs-cell"); if (!b || phase !== "place") return;
      const i = +b.dataset.i;
      if (me.owner[i] >= 0) { // Schiff wieder aufnehmen
        const s = me.owner[i];
        if (s !== me.ships.length - 1) return say("Nur das zuletzt gesetzte Schiff lässt sich wieder aufnehmen.");
        me.ships.pop().cells.forEach(c => me.owner[c] = -1); placing--; hover = i; paint(); say(); return;
      }
      if (placing >= FLEET.length) return;
      hover = i;
      const cells = preview();
      if (!fits(me.owner, cells)) return say("Da passt es nicht hin. Schiffe brauchen ein Feld Abstand und müssen ganz aufs Feld.");
      cells.forEach(c => me.owner[c] = placing);
      me.ships.push({ cells, hits: 0 });
      placing++; paint(); say();
    });
    rotBtn.onclick = () => { vert = !vert; paint(); };
    rndBtn.onclick = () => { me = randomFleet(); placing = FLEET.length; paint(); say(); };
    goBtn.onclick = () => {
      if (placing < FLEET.length) return;
      phase = "battle"; [rotBtn, rndBtn, goBtn].forEach(b => b.hidden = true);
      wrap.classList.add("battle"); paint();
      say("Du bist dran. Klick aufs gegnerische Meer. Ein Treffer gibt dir noch einen Schuss.");
    };

    /* ---------- Schießen ---------- */
    function fire(fleet, board, i) {
      const s = fleet.owner[i];
      if (s < 0) { board[i] = 1; return { hit: false }; }
      board[i] = 2; const ship = fleet.ships[s]; ship.hits++;
      if (ship.hits === ship.cells.length) { around(ship.cells).forEach(c => { if (!board[c]) board[c] = 1; }); return { hit: true, sunk: s }; }
      return { hit: true };
    }
    const allSunk = fleet => fleet.ships.every(s => s.hits === s.cells.length);

    foeGrid.addEventListener("click", e => {
      const b = e.target.closest(".bs-cell"); if (!b || phase !== "battle") return;
      const i = +b.dataset.i; if (myShots[i]) return;
      shots++; ui.score(shots);
      const r = fire(foe, myShots, i);
      paint();
      if (allSunk(foe)) return end(true);
      if (r.hit) return say(r.sunk != null ? `${FLEET[r.sunk][0]} versenkt! Schieß gleich nochmal.` : `Treffer auf ${b.getAttribute("aria-label")}! Schieß nochmal.`);
      phase = "cpu"; paint(); say("Wasser. Der Computer zielt …");
      cpuT = setTimeout(cpuTurn, 650);
    });

    function cpuPick() {
      // Zuerst begonnene Schiffe fertig versenken
      const open = ai.hits.filter(c => { const s = me.owner[c]; return me.ships[s].hits < me.ships[s].cells.length; });
      if (open.length) {
        let cand = [];
        if (open.length >= 2) {
          const xs = open.map(c => c % N), ys = open.map(c => (c / N) | 0);
          if (new Set(ys).size === 1) { const y = ys[0]; cand = [idx(Math.min(...xs) - 1, y), idx(Math.max(...xs) + 1, y)].filter((c, k) => inside(k ? Math.max(...xs) + 1 : Math.min(...xs) - 1, y)); }
          else if (new Set(xs).size === 1) { const x = xs[0]; cand = [[x, Math.min(...ys) - 1], [x, Math.max(...ys) + 1]].filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)); }
        }
        if (!cand.filter(c => !foeShots[c]).length) {
          cand = open.flatMap(c => { const x = c % N, y = (c / N) | 0; return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => inside(a, b)).map(([a, b]) => idx(a, b)); });
        }
        cand = cand.filter(c => !foeShots[c]);
        if (cand.length) return cand[rnd(cand.length)];
      }
      // Suche im Schachbrettmuster, kleinstes übriges Schiff bestimmt das Raster
      const minLen = Math.min(...me.ships.filter(s => s.hits < s.cells.length).map(s => s.cells.length));
      const free = [];
      for (let i = 0; i < N * N; i++) if (!foeShots[i] && ((i % N) + ((i / N) | 0)) % minLen === 0) free.push(i);
      const pool = free.length ? free : foeShots.map((v, i) => v ? -1 : i).filter(i => i >= 0);
      return pool[rnd(pool.length)];
    }
    function cpuTurn() {
      if (phase !== "cpu") return;
      const i = cpuPick(), r = fire(me, foeShots, i);
      if (r.hit) ai.hits.push(i);
      paint();
      if (allSunk(me)) return end(false);
      if (r.hit) { say(r.sunk != null ? `Der Computer hat deinen ${FLEET[r.sunk][0]} versenkt.` : `Der Computer trifft ${COLS[i % N]}${((i / N) | 0) + 1}.`); cpuT = setTimeout(cpuTurn, 650); return; }
      phase = "battle"; paint(); say(`Der Computer schießt ins Wasser (${COLS[i % N]}${((i / N) | 0) + 1}). Du bist dran.`);
    }
    function end(won) {
      phase = "over"; clearTimeout(cpuT); paint();
      if (won) { const rec = ui.submit(shots); say(`Gewonnen mit ${shots} Schüssen. „Neu starten“ für eine neue Runde.`); if (rec) ui.status(`Gewonnen mit ${shots} Schüssen.`, "Neuer Rekord!"); }
      else say("Deine Flotte ist versenkt. Rot umrandet siehst du, wo der Gegner lag.");
    }

    ui.onKey(e => { if (e.key === "r" || e.key === "R") { if (phase === "place") { vert = !vert; paint(); } } });
    ui.onRestart(reset);
    reset();
    return () => clearTimeout(cpuT);
  }

  WNG.games.schiffe = mountSchiffe;
})();
