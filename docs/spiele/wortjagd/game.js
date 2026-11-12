// WebNoah-Games: Wortjagd. Zehn Wörter zu einem Thema im Buchstabengitter finden. Wird von assets/js/shell.js gestartet.
// Wörter liegen waagrecht, senkrecht und schräg, auch rückwärts. Markieren: ziehen oder Anfang und Ende antippen.
(() => {
  "use strict";
  const { makeCanvas, pal, h, rnd, shuffle } = WNG;

  const THEMES = {
    "Schule": ["TAFEL", "PAUSE", "ZEUGNIS", "KREIDE", "HEFT", "LINEAL", "REFERAT", "STUNDENPLAN", "KLASSE", "SCHULBUS", "TEST", "MAPPE", "RADIERER", "FERIEN"],
    "Weltall": ["KOMET", "PLANET", "RAKETE", "MOND", "GALAXIE", "ASTRONAUT", "STERN", "ORBIT", "SATELLIT", "NEBEL", "KRATER", "SONNE", "METEOR", "TELESKOP"],
    "Tiere": ["FUCHS", "IGEL", "ADLER", "DELFIN", "PINGUIN", "ZEBRA", "OTTER", "LUCHS", "BIBER", "KROKODIL", "EULE", "GIRAFFE", "HAMSTER", "WAL"],
    "Sport": ["TOR", "ELFMETER", "SPRINT", "TURNEN", "RUDERN", "STAFFEL", "HANDBALL", "SKIFAHREN", "BOGEN", "TRAINER", "MEDAILLE", "LAUF", "SCHWIMMEN", "KLETTERN"],
    "Küche": ["NUDELN", "PFANNE", "GABEL", "ZWIEBEL", "SUPPE", "GURKE", "BACKOFEN", "SALZ", "TELLER", "TOPF", "BROT", "KUCHEN", "STRUDEL", "PAPRIKA"],
    "Wetter": ["REGEN", "GEWITTER", "NEBEL", "HAGEL", "WOLKE", "BLITZ", "SCHNEE", "STURM", "SONNE", "FROST", "WIND", "HITZE", "TAU", "REGENBOGEN"]
  };
  const N = 12, WORDS = 10, W = 540, PAD = 18, CELL = (W - 2 * PAD) / N;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];
  const FILL = "EEEEENNNNIIIIRRRSSSAAATTTDDHHUULLCGMOBWFKZPV";

  function build(theme) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const grid = Array(N * N).fill(""), placed = [];
      const pool = shuffle(THEMES[theme].filter(w => w.length <= N)).sort((a, b) => b.length - a.length);
      for (const word of pool) {
        if (placed.length >= WORDS) break;
        for (let tries = 0; tries < 300; tries++) {
          const [dx, dy] = DIRS[rnd(DIRS.length)], x = rnd(N), y = rnd(N);
          const ex = x + dx * (word.length - 1), ey = y + dy * (word.length - 1);
          if (ex < 0 || ey < 0 || ex >= N || ey >= N) continue;
          const cells = [...word].map((_, k) => (y + dy * k) * N + x + dx * k);
          if (cells.some((c, k) => grid[c] && grid[c] !== word[k])) continue;
          cells.forEach((c, k) => grid[c] = word[k]);
          placed.push({ word, cells, found: false });
          break;
        }
      }
      if (placed.length < WORDS) continue;
      for (let i = 0; i < N * N; i++) if (!grid[i]) grid[i] = FILL[rnd(FILL.length)];
      return { grid, words: placed.sort((a, b) => a.word.localeCompare(b.word, "de")) };
    }
    throw new Error("Gitter ließ sich nicht bauen");
  }
  const label = w => w;

  function mountWortjagd(stage, ui) {
    const c = makeCanvas(stage, W, W), x = c.ctx;
    const list = h("div", "wj-list"); stage.append(list);
    let P, theme, t0, timer, done, drag = null, anchor = -1, hue = 0, raf, t = 0, last = 0, flash = null;
    const COLORS = ["#38bdf8", "#ff6b5e", "#4ade80", "#e2b552", "#a78bfa", "#2fb3a6", "#f472b6", "#fb923c", "#60a5fa", "#c084fc"];

    function reset() {
      clearInterval(timer);
      theme = Object.keys(THEMES)[rnd(Object.keys(THEMES).length)];
      P = build(theme); t0 = 0; done = false; drag = null; anchor = -1; hue = 0;
      ui.score(0); paintList();
      ui.status(`Thema: ${theme}. Finde alle ${WORDS} Wörter. Ziehen oder Anfang und Ende antippen.`);
    }
    function paintList() {
      list.innerHTML = `<p class="wj-theme">Thema <b>${theme}</b> · ${P.words.filter(w => w.found).length} von ${WORDS}</p><ul>${P.words.map(w =>
        `<li class="${w.found ? "found" : ""}" style="--wc:${w.color || "var(--line)"}">${label(w.word)}</li>`).join("")}</ul>`;
    }
    const secs = () => t0 ? Math.max(1, Math.round((Date.now() - t0) / 1000)) : 0;
    function startClock() { if (!t0) { t0 = Date.now(); timer = setInterval(() => ui.score(secs()), 500); } }

    const cellAt = pt => {
      const cx = Math.floor((pt.x - PAD) / CELL), cy = Math.floor((pt.y - PAD) / CELL);
      return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx;
    };
    // Linie vom Start zur Zelle, auf eine der acht Richtungen eingerastet
    function line(a, b) {
      const ax = a % N, ay = (a / N) | 0, bx = b % N, by = (b / N) | 0;
      let dx = bx - ax, dy = by - ay;
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      if (!len) return [a];
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const sx = Math.round(Math.cos(ang)), sy = Math.round(Math.sin(ang));
      const out = [];
      for (let k = 0; k <= len; k++) {
        const cx = ax + sx * k, cy = ay + sy * k;
        if (cx < 0 || cy < 0 || cx >= N || cy >= N) break;
        out.push(cy * N + cx);
      }
      return out;
    }
    function tryCells(cells) {
      if (cells.length < 2 || done) return;
      const key = cells.join(","), rev = cells.slice().reverse().join(",");
      const hit = P.words.find(w => !w.found && (w.cells.join(",") === key || w.cells.join(",") === rev));
      if (!hit) { flash = { cells, until: performance.now() + 350, ok: false }; return; }
      hit.found = true; hit.color = COLORS[hue++ % COLORS.length];
      flash = { cells, until: performance.now() + 500, ok: true };
      paintList();
      const left = P.words.filter(w => !w.found).length;
      if (!left) return win();
      ui.status(`${label(hit.word)} gefunden! Noch ${left}.`);
    }
    function win() {
      done = true; clearInterval(timer);
      const s = secs(); ui.score(s);
      const rec = ui.submit(s);
      ui.status(`Alle Wörter zum Thema ${theme} in ${s} Sekunden.`, rec ? "Neuer Rekord!" : "");
      c.show("Alle gefunden!", `${WORDS} Wörter in ${s} Sekunden.`, "Neues Gitter", () => { c.hide(); reset(); }, rec ? "Neuer Rekord!" : "");
    }

    c.cv.addEventListener("pointerdown", e => {
      if (done || !c.ov.hidden) return;
      const i = cellAt(c.pt(e)); if (i < 0) return;
      startClock();
      try { c.cv.setPointerCapture(e.pointerId); } catch { /* ohne Capture geht es auch */ }
      drag = { start: anchor >= 0 ? anchor : i, cur: i, moved: false, fromAnchor: anchor >= 0 };
    });
    c.cv.addEventListener("pointermove", e => {
      if (!drag) return;
      const i = cellAt(c.pt(e)); if (i < 0 || i === drag.cur) return;
      drag.cur = i; drag.moved = true;
    });
    c.cv.addEventListener("pointerup", () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved && !d.fromAnchor) { anchor = d.start; return; }   // erster Tipp: Anfang merken
      anchor = -1;
      tryCells(line(d.start, d.cur));
    });
    c.cv.addEventListener("pointercancel", () => { drag = null; });

    function capsule(cells, color, alpha) {
      const a = cells[0], b = cells[cells.length - 1];
      const ax = PAD + (a % N + .5) * CELL, ay = PAD + (((a / N) | 0) + .5) * CELL, bx = PAD + (b % N + .5) * CELL, by = PAD + (((b / N) | 0) + .5) * CELL;
      x.globalAlpha = alpha; x.strokeStyle = color; x.lineCap = "round"; x.lineWidth = CELL * .78;
      x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.globalAlpha = 1;
    }
    function draw(now) {
      const p = pal();
      x.fillStyle = p.sheet; x.fillRect(0, 0, W, W);
      for (const w of P.words) if (w.found) capsule(w.cells, w.color, .38);
      if (flash && now < flash.until) capsule(flash.cells, flash.ok ? p.marker : p.red, .55 * ((flash.until - now) / 400));
      const active = drag ? line(drag.start, drag.cur) : anchor >= 0 ? [anchor] : null;
      if (active) capsule(active, p.ink, .45);
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = `700 ${Math.round(CELL * .52)}px 'IBM Plex Mono', Consolas, monospace`;
      const foundCells = new Set(P.words.filter(w => w.found).flatMap(w => w.cells));
      for (let i = 0; i < N * N; i++) {
        x.fillStyle = foundCells.has(i) ? p.fg : "#c8d0e0";
        x.fillText(label(P.grid[i]), PAD + (i % N + .5) * CELL, PAD + (((i / N) | 0) + .5) * CELL + 1);
      }
    }
    function frame(now) { t += last ? (now - last) / 1000 : 0; last = now; draw(now); raf = requestAnimationFrame(frame); }

    ui.onRestart(() => { c.hide(); reset(); });
    reset();
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearInterval(timer); };
  }

  WNG.games.wortjagd = mountWortjagd;
})();
