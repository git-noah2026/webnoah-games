// WebNoah-Games: Sudoku zum Selberspielen. Wird von assets/js/shell.js gestartet.
// Jedes Rätsel wird neu erzeugt und hat genau eine Lösung.
(() => {
  "use strict";
  const { h, segmented, rnd, shuffle } = WNG;

  const LEVELS = { leicht: 40, mittel: 32, schwer: 26 }; // Anzahl vorgegebener Zahlen (Zielwert)
  const row = i => (i / 9) | 0, col = i => i % 9, box = i => ((row(i) / 3) | 0) * 3 + ((col(i) / 3) | 0);
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const s = new Set();
    for (let j = 0; j < 81; j++) if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) s.add(j);
    return [...s];
  });

  // Lösungen zählen (bis limit) mit Bitmasken und "wenigste Kandidaten zuerst"
  function countSolutions(grid, limit = 2) {
    const g = grid.slice(), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
    for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << g[i]; rows[row(i)] |= b; cols[col(i)] |= b; boxes[box(i)] |= b; }
    let count = 0;
    (function solve() {
      if (count >= limit) return;
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const mask = ~(rows[row(i)] | cols[col(i)] | boxes[box(i)]) & 0x3fe;
        let n = 0; for (let m = mask; m; m &= m - 1) n++;
        if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n <= 1) break; }
      }
      if (best < 0) { count++; return; }
      for (let d = 1; d <= 9; d++) {
        if (!(bestMask & (1 << d))) continue;
        const b = 1 << d, r = row(best), c = col(best), x = box(best);
        g[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
        solve();
        g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b;
        if (count >= limit) return;
      }
    })();
    return count;
  }
  function fullGrid() {
    const g = Array(81).fill(0);
    (function fill(i) {
      if (i === 81) return true;
      for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (PEERS[i].some(p => g[p] === d)) continue;
        g[i] = d; if (fill(i + 1)) return true;
      }
      g[i] = 0; return false;
    })(0);
    return g;
  }
  function makePuzzle(level) {
    const solution = fullGrid(), puzzle = solution.slice();
    let givens = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (givens <= LEVELS[level]) break;
      const keep = puzzle[i]; puzzle[i] = 0;
      if (countSolutions(puzzle) !== 1) puzzle[i] = keep; else givens--;
    }
    return { puzzle, solution };
  }

  function mountSudoku(stage, ui) {
    let level = "leicht", S = null, sel = -1, notesMode = false, t0 = 0, elapsed = 0, timer = 0, won = false;
    segmented(ui.tools, [["leicht", "Leicht"], ["mittel", "Mittel"], ["schwer", "Schwer"]], level, v => { level = v; ui.showBest(v); newGame(); });

    const wrap = h("div", "sdk");
    wrap.innerHTML = `<div class="sdk-grid" role="grid" aria-label="Sudoku"></div>
      <div class="sdk-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button type="button" data-d="${d}">${d}<small></small></button>`).join("")}
        <button type="button" data-act="erase" class="wide">Löschen</button>
        <button type="button" data-act="notes" class="wide" aria-pressed="false">✎ Notizen</button>
        <button type="button" data-act="hint" class="wide">Tipp</button></div>`;
    stage.append(wrap);
    const gridEl = wrap.querySelector(".sdk-grid"), pad = wrap.querySelector(".sdk-pad");
    const cells = Array.from({ length: 81 }, (_, i) => {
      const b = h("button", "sdk-cell"); b.type = "button"; b.dataset.i = i;
      if (col(i) % 3 === 2 && col(i) < 8) b.classList.add("br");
      if (row(i) % 3 === 2 && row(i) < 8) b.classList.add("bb");
      gridEl.append(b); return b;
    });

    const secs = () => Math.round(elapsed + (t0 ? (Date.now() - t0) / 1000 : 0));
    function startClock() { if (!t0 && !won) { t0 = Date.now(); clearInterval(timer); timer = setInterval(() => ui.score(secs()), 500); } }
    function stopClock() { elapsed = secs(); t0 = 0; clearInterval(timer); }
    function persist() { if (S && !won) ui.save({ level, puzzle: S.puzzle, solution: S.solution, vals: S.vals, notes: S.notes.map(n => [...n]), hints: S.hints, secs: secs() }); }

    function newGame(saved) {
      stopClock(); won = false; sel = -1; wrap.classList.remove("won");
      if (saved) {
        level = saved.level;
        S = { puzzle: saved.puzzle, solution: saved.solution, vals: saved.vals, notes: saved.notes.map(n => new Set(n)), hints: saved.hints || 0 };
        elapsed = saved.secs || 0;
      } else {
        ui.status("Erzeuge ein neues Rätsel …");
        const { puzzle, solution } = makePuzzle(level);
        S = { puzzle, solution, vals: puzzle.slice(), notes: Array.from({ length: 81 }, () => new Set()), hints: 0 };
        elapsed = 0;
      }
      ui.score(secs()); render();
      ui.status(`${level[0].toUpperCase() + level.slice(1)}: ${S.puzzle.filter(Boolean).length} Zahlen vorgegeben. Feld wählen, Zahl tippen.`);
    }
    function conflicts() {
      const bad = new Set();
      for (let i = 0; i < 81; i++) if (S.vals[i]) for (const p of PEERS[i]) if (S.vals[p] === S.vals[i]) bad.add(i);
      return bad;
    }
    function render() {
      const bad = conflicts(), sv = sel >= 0 ? S.vals[sel] : 0;
      const counts = Array(10).fill(0); S.vals.forEach(v => counts[v]++);
      cells.forEach((b, i) => {
        const v = S.vals[i], given = !!S.puzzle[i];
        b.className = "sdk-cell" + (col(i) % 3 === 2 && col(i) < 8 ? " br" : "") + (row(i) % 3 === 2 && row(i) < 8 ? " bb" : "")
          + (given ? " given" : v ? " user" : "") + (bad.has(i) && !given ? " bad" : "")
          + (i === sel ? " sel" : sel >= 0 && (row(i) === row(sel) || col(i) === col(sel) || box(i) === box(sel)) ? " peer" : "")
          + (sv && v === sv ? " same" : "");
        if (v) b.textContent = v;
        else b.innerHTML = S.notes[i].size ? `<span class="notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i>${S.notes[i].has(d) ? d : ""}</i>`).join("")}</span>` : "";
        b.setAttribute("aria-label", `Zeile ${row(i) + 1}, Spalte ${col(i) + 1}${v ? `: ${v}` : ", leer"}`);
      });
      pad.querySelectorAll("[data-d]").forEach(b => { const d = +b.dataset.d, left = 9 - counts[d]; b.querySelector("small").textContent = left > 0 ? left : "✓"; b.classList.toggle("done", left <= 0); });
      pad.querySelector("[data-act=notes]").setAttribute("aria-pressed", String(notesMode));
    }
    function input(d) {
      if (won || sel < 0 || S.puzzle[sel]) return;
      startClock();
      if (notesMode && d) {
        if (S.vals[sel]) return;
        S.notes[sel].has(d) ? S.notes[sel].delete(d) : S.notes[sel].add(d);
      } else {
        S.vals[sel] = S.vals[sel] === d ? 0 : d;
        if (d && S.vals[sel]) { S.notes[sel].clear(); for (const p of PEERS[sel]) S.notes[p].delete(d); }
      }
      render(); persist(); check();
    }
    function hint() {
      if (won) return;
      const open = [...Array(81).keys()].filter(i => S.vals[i] !== S.solution[i]);
      if (!open.length) return;
      const i = sel >= 0 && S.vals[sel] !== S.solution[sel] ? sel : open[rnd(open.length)];
      startClock();
      S.vals[i] = S.solution[i]; S.notes[i].clear(); S.hints++; elapsed += 30; sel = i;
      ui.status(`Tipp für Zeile ${row(i) + 1}, Spalte ${col(i) + 1}. Jeder Tipp kostet 30 Sekunden.`);
      render(); persist(); check();
    }
    function check() {
      if (S.vals.some((v, i) => v !== S.solution[i])) return;
      won = true; stopClock(); ui.clearSave(); wrap.classList.add("won");
      const s = secs(); ui.score(s);
      const rec = ui.submit(s, level);
      ui.status(`Gelöst in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} Minuten${S.hints ? ` mit ${S.hints} ${S.hints === 1 ? "Tipp" : "Tipps"}` : ""}.`, rec ? "Neuer Rekord!" : "");
    }

    gridEl.addEventListener("click", e => { const b = e.target.closest(".sdk-cell"); if (!b) return; sel = +b.dataset.i; render(); });
    pad.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.d) input(+b.dataset.d);
      else if (b.dataset.act === "erase") { if (sel >= 0 && !S.puzzle[sel]) { S.vals[sel] = 0; S.notes[sel].clear(); render(); persist(); } }
      else if (b.dataset.act === "notes") { notesMode = !notesMode; render(); }
      else if (b.dataset.act === "hint") hint();
    });
    ui.onKey(e => {
      const k = e.key;
      if (/^[1-9]$/.test(k)) { e.preventDefault(); input(+k); }
      else if (k === "Backspace" || k === "Delete" || k === "0") { e.preventDefault(); if (sel >= 0 && !S.puzzle[sel]) { S.vals[sel] = 0; S.notes[sel].clear(); render(); persist(); } }
      else if (k === "n" || k === "N") { notesMode = !notesMode; render(); }
      else if (k.startsWith("Arrow")) {
        e.preventDefault();
        if (sel < 0) sel = 40;
        else {
          const r = row(sel), c = col(sel);
          sel = k === "ArrowUp" ? ((r + 8) % 9) * 9 + c : k === "ArrowDown" ? ((r + 1) % 9) * 9 + c : k === "ArrowLeft" ? r * 9 + (c + 8) % 9 : r * 9 + (c + 1) % 9;
        }
        render();
      }
    });
    document.addEventListener("visibilitychange", onVis);
    function onVis() { if (document.hidden && t0) { stopClock(); persist(); } }

    ui.onRestart(() => { ui.clearSave(); newGame(); });
    const saved = ui.load();
    if (saved && saved.puzzle && saved.level) { level = saved.level; ui.showBest(level); ui.tools.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", String(b.textContent.toLowerCase() === level))); newGame(saved); ui.status("Dein letztes Rätsel ist wieder da. „Neu starten“ für ein neues."); }
    else setTimeout(() => newGame(), 0);
    return () => { clearInterval(timer); persist(); document.removeEventListener("visibilitychange", onVis); };
  }

  WNG.games.sudoku9 = mountSudoku;
})();
