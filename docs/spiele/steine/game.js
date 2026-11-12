// WebNoah-Games: Steine schmeißen. Fallende Steinbrocken stapeln, volle Reihen räumen. Wird von assets/js/shell.js gestartet.
// Eigene Steinformen aus 3 und 5 Feldern, ein 11 Felder breites Feld und ein seltener Goldstein, der seine Reihe sprengt.
(() => {
  "use strict";
  const { makeCanvas, pal, rnd, rr } = WNG;

  const COLS = 11, ROWS = 18, C = 28, BX = 14, BY = 14, W = BX * 2 + COLS * C + 150, H = BY * 2 + ROWS * C;
  // Formen: Name, Zellen, Farbton
  const SHAPES = [
    ["Stab", [[0, 0], [1, 0], [2, 0]], 205],
    ["Haken", [[0, 0], [0, 1], [1, 1]], 160],
    ["Fahne", [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], 28],
    ["Wanne", [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]], 280],
    ["Hammer", [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]], 340],
    ["Kreuz", [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], 120],
    ["Winkel", [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], 50],
    ["Blitz", [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]], 250]
  ];
  const GOLD = ["Goldstein", [[0, 0]], -1];
  const LINE_PTS = [0, 100, 300, 600, 1000, 1500];

  const norm = cells => { const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])); return cells.map(([x, y]) => [x - mx, y - my]); };
  const rotate = cells => norm(cells.map(([x, y]) => [-y, x]));

  function mountSteine(stage, ui) {
    const c = makeCanvas(stage, W, H), x = c.ctx;
    const pad = document.createElement("div"); pad.className = "dpad st-pad";
    pad.innerHTML = `<button type="button" data-a="rot" aria-label="Drehen">⟳</button><button type="button" data-a="left" aria-label="Links">←</button>
      <button type="button" data-a="down" aria-label="Schneller">↓</button><button type="button" data-a="right" aria-label="Rechts">→</button>
      <button type="button" data-a="drop" class="wide" aria-label="Schmeißen">Schmeißen</button>`;
    stage.append(pad);

    let grid, piece, next, score, lines, level, state, dropT, acc, raf, last = 0, t = 0, clearing = null, combo = 0;
    const speed = () => Math.max(.07, .8 * Math.pow(.86, level - 1));

    function bag() {
      if (rnd(100) < 5) return { s: GOLD, cells: GOLD[1], hue: -1 };
      const s = SHAPES[rnd(SHAPES.length)]; return { s, cells: norm(s[1]), hue: s[2] };
    }
    function spawn() {
      piece = next || bag(); next = bag();
      const w = Math.max(...piece.cells.map(c => c[0])) + 1;
      piece.x = Math.floor((COLS - w) / 2); piece.y = 0;
      if (collides(piece.cells, piece.x, piece.y)) return over();
    }
    const collides = (cells, px, py) => cells.some(([cx, cy]) => {
      const gx = px + cx, gy = py + cy;
      return gx < 0 || gx >= COLS || gy >= ROWS || (gy >= 0 && grid[gy][gx]);
    });
    function reset() {
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      score = 0; lines = 0; level = 1; acc = 0; combo = 0; clearing = null; next = null;
      ui.score(0); spawn(); state = "ready";
    }
    function start() { if (state === "over") reset(); state = "run"; c.hide(); ui.status("Leertaste schmeißt den Stein, ↑ dreht, P pausiert."); }
    function over() {
      state = "over";
      const rec = ui.submit(score) && score > 0;
      c.show("Stapel voll", `${score} Punkte · ${lines} Reihen · Level ${level}`, "Nochmal", start, rec ? "Neuer Rekord!" : "");
      ui.status("");
    }
    function move(dx) { if (state === "run" && !clearing && !collides(piece.cells, piece.x + dx, piece.y)) piece.x += dx; }
    function rot() {
      if (state !== "run" || clearing || piece.hue < 0) return;
      const r = rotate(piece.cells);
      for (const k of [0, -1, 1, -2, 2]) if (!collides(r, piece.x + k, piece.y)) { piece.cells = r; piece.x += k; return; }
    }
    function soft() { if (state !== "run" || clearing) return; if (!collides(piece.cells, piece.x, piece.y + 1)) { piece.y++; score += 1; ui.score(score); acc = 0; } else lock(); }
    function drop() {
      if (state !== "run" || clearing) return;
      let n = 0; while (!collides(piece.cells, piece.x, piece.y + 1)) { piece.y++; n++; }
      score += n * 2; ui.score(score); lock();
    }
    function lock() {
      for (const [cx, cy] of piece.cells) { const gy = piece.y + cy; if (gy < 0) return over(); grid[gy][piece.x + cx] = { hue: piece.hue }; }
      let rows = [];
      for (let y = 0; y < ROWS; y++) if (grid[y].every(Boolean)) rows.push(y);
      // Goldstein sprengt seine ganze Reihe, auch wenn sie nicht voll ist
      if (piece.hue < 0) { const gy = piece.y; if (!rows.includes(gy)) rows.push(gy); }
      if (rows.length) {
        clearing = { rows, t: 0, gold: piece.hue < 0 };
        combo++;
      } else { combo = 0; spawn(); }
    }
    function finishClear() {
      const rows = clearing.rows.sort((a, b) => a - b);
      for (const y of rows) { grid.splice(y, 1); grid.unshift(Array(COLS).fill(null)); }
      const n = rows.length;
      lines += n;
      const pts = (LINE_PTS[Math.min(n, 5)] + (combo > 1 ? 50 * (combo - 1) : 0)) * level;
      score += pts; ui.score(score);
      ui.status(`${clearing.gold ? "Goldstein! " : ""}${n} ${n === 1 ? "Reihe" : "Reihen"} +${pts}${combo > 1 ? ` · Serie ×${combo}` : ""}`);
      const nl = 1 + Math.floor(lines / 8);
      if (nl > level) { level = nl; ui.status(`Level ${level}! Es wird schneller.`); }
      clearing = null; spawn();
    }

    /* ---------- Zeichnen ---------- */
    function stone(px, py, s, hue, alpha = 1, glow = 0) {
      x.globalAlpha = alpha;
      const g = x.createLinearGradient(px, py, px + s, py + s);
      if (hue < 0) { g.addColorStop(0, "#fff3c4"); g.addColorStop(.5, "#e2b552"); g.addColorStop(1, "#8a6420"); }
      else { g.addColorStop(0, `hsl(${hue} 45% 62%)`); g.addColorStop(1, `hsl(${hue} 40% 34%)`); }
      x.fillStyle = g; rr(x, px + 1.5, py + 1.5, s - 3, s - 3, 7); x.fill();
      // Kanten wie bei einem behauenen Stein
      x.strokeStyle = "rgba(255,255,255,.28)"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px + 6, py + 5); x.lineTo(px + s - 8, py + 5); x.stroke();
      x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.arc(px + s * .68, py + s * .62, s * .09, 0, 6.283); x.fill();
      if (glow) { x.strokeStyle = `rgba(255,240,190,${glow})`; x.lineWidth = 3; rr(x, px + 1.5, py + 1.5, s - 3, s - 3, 7); x.stroke(); }
      x.globalAlpha = 1;
    }
    function draw() {
      const p = pal();
      x.fillStyle = p.paper; x.fillRect(0, 0, W, H);
      // Schacht
      const g = x.createLinearGradient(0, BY, 0, BY + ROWS * C); g.addColorStop(0, "#0d1a33"); g.addColorStop(1, "#16213c");
      x.fillStyle = g; x.fillRect(BX, BY, COLS * C, ROWS * C);
      x.strokeStyle = "rgba(255,255,255,.035)"; x.lineWidth = 1;
      for (let i = 1; i < COLS; i++) { x.beginPath(); x.moveTo(BX + i * C + .5, BY); x.lineTo(BX + i * C + .5, BY + ROWS * C); x.stroke(); }
      x.strokeStyle = p.marker; x.lineWidth = 2; x.strokeRect(BX - 1, BY - 1, COLS * C + 2, ROWS * C + 2);
      // liegende Steine
      for (let y = 0; y < ROWS; y++) for (let xx = 0; xx < COLS; xx++) {
        const cell = grid[y][xx]; if (!cell) continue;
        const flashing = clearing && clearing.rows.includes(y);
        stone(BX + xx * C, BY + y * C, C, cell.hue, flashing ? Math.max(0, 1 - clearing.t * 2.6) : 1, flashing ? .9 : 0);
      }
      if (state !== "over" && piece && !clearing) {
        // Schatten: wo der Stein landet
        let gy = piece.y; while (!collides(piece.cells, piece.x, gy + 1)) gy++;
        x.strokeStyle = "rgba(226,181,82,.35)"; x.lineWidth = 1.5;
        for (const [cx, cy] of piece.cells) { rr(x, BX + (piece.x + cx) * C + 3, BY + (gy + cy) * C + 3, C - 6, C - 6, 6); x.stroke(); }
        for (const [cx, cy] of piece.cells) if (piece.y + cy >= 0) stone(BX + (piece.x + cx) * C, BY + (piece.y + cy) * C, C, piece.hue, 1, piece.hue < 0 ? .5 + .4 * Math.sin(t * 8) : 0);
      }
      // Seitenleiste
      const sx = BX + COLS * C + 22;
      x.font = "600 11px 'IBM Plex Mono', monospace"; x.fillStyle = p.muted; x.textBaseline = "top"; x.textAlign = "left";
      x.fillText("NÄCHSTER", sx, BY + 4);
      x.fillStyle = "#0d1a33"; rr(x, sx, BY + 22, 110, 96, 10); x.fill();
      if (next) {
        const mw = Math.max(...next.cells.map(c2 => c2[0])) + 1, mh = Math.max(...next.cells.map(c2 => c2[1])) + 1, s2 = 22;
        for (const [cx, cy] of next.cells) stone(sx + 55 - mw * s2 / 2 + cx * s2, BY + 70 - mh * s2 / 2 + cy * s2, s2, next.hue);
      }
      const stat = (label, value, y) => { x.fillStyle = p.muted; x.font = "600 11px 'IBM Plex Mono', monospace"; x.fillText(label, sx, y); x.fillStyle = p.fg; x.font = "800 22px Cinzel, Georgia, serif"; x.fillText(String(value), sx, y + 16); };
      stat("PUNKTE", score, BY + 140); stat("REIHEN", lines, BY + 196); stat("LEVEL", level, BY + 252);
      x.fillStyle = p.muted; x.font = "500 11px Inter, sans-serif";
      ["← → schieben", "↑ drehen", "↓ schneller", "Leertaste: schmeißen", "P: Pause"].forEach((l, i) => x.fillText(l, sx, BY + 330 + i * 17));
      if (next && next.hue < 0) { x.fillStyle = p.marker; x.font = "600 11px Inter, sans-serif"; x.fillText("Goldstein kommt!", sx, BY + 124); }
    }
    function frame(now) {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
      if (state === "run") {
        if (clearing) { clearing.t += dt; if (clearing.t > .38) finishClear(); }
        else { acc += dt; if (acc >= speed()) { acc = 0; if (!collides(piece.cells, piece.x, piece.y + 1)) piece.y++; else lock(); } }
      }
      draw(); raf = requestAnimationFrame(frame);
    }

    ui.onKey(e => {
      const k = e.key;
      if (state !== "run") { if (k === " " || k === "Enter") { e.preventDefault(); if (c.ov.hidden || state !== "pause") start(); } return; }
      if (k === "ArrowLeft" || k === "a") { e.preventDefault(); move(-1); }
      else if (k === "ArrowRight" || k === "d") { e.preventDefault(); move(1); }
      else if (k === "ArrowUp" || k === "w" || k === "x") { e.preventDefault(); rot(); }
      else if (k === "ArrowDown" || k === "s") { e.preventDefault(); soft(); }
      else if (k === " ") { e.preventDefault(); drop(); }
      else if (k === "p" || k === "P") { state = "pause"; c.show("Pause", "", "Weiter", start); }
    });
    pad.addEventListener("pointerdown", e => {
      const b = e.target.closest("button"); if (!b) return; e.preventDefault();
      if (state !== "run") return start();
      ({ rot, left: () => move(-1), right: () => move(1), down: soft, drop })[b.dataset.a]();
    });
    // Wischen auf dem Spielfeld: tippen dreht, seitlich schiebt, nach unten schmeißt
    let sw = null;
    c.cv.addEventListener("pointerdown", e => { sw = { x: e.clientX, y: e.clientY, moved: 0 }; });
    c.cv.addEventListener("pointermove", e => {
      if (!sw || state !== "run") return;
      const step = c.cv.getBoundingClientRect().width / W * C;
      while (e.clientX - sw.x > step) { move(1); sw.x += step; sw.moved++; }
      while (sw.x - e.clientX > step) { move(-1); sw.x -= step; sw.moved++; }
    });
    c.cv.addEventListener("pointerup", e => {
      if (!sw) return; const dy = e.clientY - sw.y, moved = sw.moved; sw = null;
      if (state !== "run") return;
      if (dy > 60) drop(); else if (!moved && Math.abs(dy) < 12) rot();
    });

    ui.onRestart(() => { reset(); start(); });
    reset();
    c.show("Steine schmeißen", "Fallende Brocken so schmeißen, dass Reihen voll werden. Der seltene Goldstein sprengt seine ganze Reihe.", "Los geht’s", start);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  WNG.games.steine = mountSteine;
})();
