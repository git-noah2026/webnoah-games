// WebNoah-Games: vier. Wird von assets/js/shell.js gestartet.
(() => {
  "use strict";
  const { $, h, rnd, clamp, shuffle, store, pal, rr, karo, makeCanvas, segmented, MONO, BODY, SUB } = WNG;

    const c4Next = (b, c) => { for (let r = 5; r >= 0; r--) if (!b[r][c]) return r; return -1; };
  const c4Valid = b => [3, 2, 4, 1, 5, 0, 6].filter(c => !b[0][c]);
  const C4D = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function c4Win(b) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
      const p = b[r][c]; if (!p) continue;
      for (const [dr, dc] of C4D) {
        const cells = [];
        for (let k = 0; k < 4; k++) {
          const y = r + dr * k, x = c + dc * k;
          if (y < 0 || y >= 6 || x < 0 || x >= 7 || b[y][x] !== p) break;
          cells.push(y * 7 + x);
        }
        if (cells.length === 4) return { p, cells };
      }
    }
    return null;
  }
  function c4Score(b) {
    let s = 0;
    for (let r = 0; r < 6; r++) { if (b[r][3] === 2) s += 3; else if (b[r][3] === 1) s -= 3; }
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of C4D) {
      const er = r + dr * 3, ec = c + dc * 3;
      if (er < 0 || er >= 6 || ec < 0 || ec >= 7) continue;
      let me = 0, op = 0;
      for (let k = 0; k < 4; k++) { const v = b[r + dr * k][c + dc * k]; if (v === 2) me++; else if (v === 1) op++; }
      if (me && op) continue;
      if (me === 3) s += 5; else if (me === 2) s += 2;
      if (op === 3) s -= 7; else if (op === 2) s -= 2;
    }
    return s;
  }
  function c4Mini(b, d, a, be, max) {
    const w = c4Win(b); if (w) return w.p === 2 ? 100000 + d : -100000 - d;
    const cols = c4Valid(b); if (!cols.length) return 0;
    if (d === 0) return c4Score(b);
    let v = max ? -Infinity : Infinity;
    for (const c of cols) {
      const r = c4Next(b, c); b[r][c] = max ? 2 : 1;
      const s = c4Mini(b, d - 1, a, be, !max); b[r][c] = 0;
      if (max) { v = Math.max(v, s); a = Math.max(a, v); } else { v = Math.min(v, s); be = Math.min(be, v); }
      if (a >= be) break;
    }
    return v;
  }
  function c4Best(b) {
    let best = null, bv = -Infinity;
    for (const c of c4Valid(b)) {
      const r = c4Next(b, c); b[r][c] = 2;
      const v = c4Mini(b, 4, -Infinity, Infinity, false) + Math.random() * .5; b[r][c] = 0;
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }
  function mountVier(stage, ui) {
    const R = 6, C = 7;
    let b, turn, over, busy = false, mode = "cpu", tally = { a: 0, b: 0 }, cpuT;
    segmented(ui.tools, [["cpu", "Gegen Computer"], ["duo", "Zu zweit"]], mode, v => { mode = v; tally = { a: 0, b: 0 }; newGame(); });
    const board = h("div", "c4"); board.setAttribute("aria-label", "Spielbrett mit 7 Spalten");
    const cells = [];
    for (let i = 0; i < R * C; i++) { const s = h("div", "slot"); s.dataset.c = i % C; board.append(s); cells.push(s); }
    const legend = h("div", "legend");
    stage.append(board, legend);
    const names = () => mode === "cpu" ? ["Du", "Computer"] : ["Blau", "Rot"];
    function render() { cells.forEach((s, i) => { const v = b[(i / C) | 0][i % C]; s.className = "slot" + (v === 1 ? " p1" : v === 2 ? " p2" : ""); }); }
    function hover(c) { cells.forEach((s, i) => s.classList.toggle("hot", i % C === c && !over && !busy)); }
    function say() {
      const [n1, n2] = names();
      legend.innerHTML = `<span style="--dc:var(--c1)">${n1}</span><span style="--dc:var(--c2)">${n2}</span>`;
      ui.score(`${tally.a}:${tally.b}`);
      if (over) return;
      if (mode === "cpu") ui.status(turn === 1 ? "Du bist dran. Klicke eine Spalte oder drücke 1 bis 7." : "Der Computer überlegt …");
      else ui.status(`${turn === 1 ? "Blau" : "Rot"} ist dran.`);
    }
    function end(w) {
      over = true; hover(-1);
      if (w) {
        w.cells.forEach(i => cells[i].classList.add("win"));
        if (w.p === 1) tally.a++; else tally.b++;
        if (mode === "cpu" && w.p === 1) ui.set((ui.get() || 0) + 1);
      }
      say();
      const [n1, n2] = names();
      if (!w) ui.status("Unentschieden. Das Brett ist voll.");
      else if (mode === "cpu") ui.status(w.p === 1 ? "Vier in einer Reihe." : "Der Computer hat gewonnen.", w.p === 1 ? "Gewonnen!" : "");
      else ui.status(`${w.p === 1 ? n1 : n2} gewinnt!`);
    }
    function drop(c) {
      const r = c4Next(b, c); if (r < 0) return;
      b[r][c] = turn; render(); cells[r * C + c].classList.add("drop");
      const w = c4Win(b);
      if (w) return end(w);
      if (!c4Valid(b).length) return end(null);
      turn = 3 - turn; say();
      if (mode === "cpu" && turn === 2) {
        busy = true; hover(-1);
        cpuT = setTimeout(() => { busy = false; if (!over) drop(c4Best(b)); }, 380);
      }
    }
    function play(c) { if (over || busy || (mode === "cpu" && turn === 2)) return; drop(c); }
    board.addEventListener("click", e => { const s = e.target.closest(".slot"); if (s) play(+s.dataset.c); });
    board.addEventListener("pointerover", e => { const s = e.target.closest(".slot"); if (s && e.pointerType === "mouse") hover(+s.dataset.c); });
    board.addEventListener("pointerleave", () => hover(-1));
    ui.onKey(e => { if (/^[1-7]$/.test(e.key)) { e.preventDefault(); play(+e.key - 1); } });
    function newGame() {
      clearTimeout(cpuT); busy = false;
      b = Array.from({ length: R }, () => Array(C).fill(0));
      turn = 1; over = false; render(); say();
    }
    ui.onRestart(newGame); newGame();
    return () => clearTimeout(cpuT);
  }

  WNG.games.vier = mountVier;
})();
