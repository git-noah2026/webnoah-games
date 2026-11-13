// WebNoah-Games: Mühle (traditionelles Brettspiel). Wird von assets/js/shell.js gestartet.
// Regeln: je 9 Steine setzen, dann entlang der Linien ziehen, mit 3 Steinen springen.
// Eine Mühle (drei in einer Linie) erlaubt, einen gegnerischen Stein zu nehmen, der in keiner Mühle steht
// (außer alle stehen in Mühlen). Wer weniger als 3 Steine hat oder nicht mehr ziehen kann, verliert.
(() => {
  "use strict";
  const { makeCanvas, pal, segmented } = WNG;

  const PTS = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3],
    [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
  const ADJ = [[1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13], [7, 11], [4, 6, 8], [7, 12], [0, 10, 21], [3, 9, 11, 18], [6, 10, 15],
    [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19], [12, 16], [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22]];
  const MILLS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
    [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]];
  const MILLS_AT = PTS.map((_, i) => MILLS.filter(m => m.includes(i)));
  const W = 540, H = 540, PAD = 60, STEP = (W - 2 * PAD) / 6;
  const xy = i => [PAD + PTS[i][0] * STEP, PAD + PTS[i][1] * STEP];

  /* ---------- Regeln (rein, ohne Darstellung) ---------- */
  const fresh = () => ({ b: Array(24).fill(0), hand: [0, 9, 9], turn: 1 });
  const clone = s => ({ b: s.b.slice(), hand: s.hand.slice(), turn: s.turn });
  const count = (s, p) => s.b.reduce((a, v) => a + (v === p), 0);
  const inMill = (b, i) => MILLS_AT[i].some(m => m.every(k => b[k] === b[i]));
  function removable(b, opp) {
    const pieces = b.map((v, i) => v === opp ? i : -1).filter(i => i >= 0);
    const free = pieces.filter(i => !inMill(b, i));
    return free.length ? free : pieces;
  }
  function moves(s) {
    const p = s.turn, o = 3 - p, out = [], b = s.b;
    const steps = [];
    if (s.hand[p] > 0) { for (let i = 0; i < 24; i++) if (!b[i]) steps.push([-1, i]); }
    else {
      const fly = count(s, p) === 3;
      for (let i = 0; i < 24; i++) if (b[i] === p) {
        const targets = fly ? [...Array(24).keys()].filter(j => !b[j]) : ADJ[i].filter(j => !b[j]);
        for (const j of targets) steps.push([i, j]);
      }
    }
    for (const [f, t] of steps) {
      const nb = b.slice(); if (f >= 0) nb[f] = 0; nb[t] = p;
      if (MILLS_AT[t].some(m => m.every(k => nb[k] === p))) for (const r of removable(nb, o)) out.push({ f, t, r });
      else out.push({ f, t, r: -1 });
    }
    return out;
  }
  function apply(s, m) {
    const n = clone(s), p = s.turn;
    if (m.f >= 0) n.b[m.f] = 0; else n.hand[p]--;
    n.b[m.t] = p;
    if (m.r >= 0) n.b[m.r] = 0;
    n.turn = 3 - p;
    return n;
  }
  const total = (s, p) => count(s, p) + s.hand[p];
  // Gewinner oder 0. Wer am Zug ist und keinen Zug hat, verliert.
  function winner(s) {
    for (const p of [1, 2]) if (total(s, p) < 3) return 3 - p;
    if (!moves(s).length) return 3 - s.turn;
    return 0;
  }

  /* ---------- Computer ---------- */
  function evaluate(s, me) {
    const o = 3 - me;
    let v = (total(s, me) - total(s, o)) * 12;
    for (const m of MILLS) {
      const a = m.filter(k => s.b[k] === me).length, b = m.filter(k => s.b[k] === o).length, e = 3 - a - b;
      if (a === 3) v += 4; if (b === 3) v -= 4;
      if (a === 2 && e === 1) v += 3; if (b === 2 && e === 1) v -= 3;
    }
    if (!s.hand[me] && !s.hand[o]) {
      const mob = p => s.b.reduce((acc, val, i) => acc + (val === p ? ADJ[i].filter(j => !s.b[j]).length : 0), 0);
      v += (mob(me) - mob(o)) * .5;
    }
    return v;
  }
  function search(s, depth, a, b, me) {
    const w = winner(s);
    if (w) return w === me ? 1000 + depth : -1000 - depth;
    if (depth === 0) return evaluate(s, me);
    const ms = moves(s);
    if (s.turn === me) {
      let v = -Infinity;
      for (const m of ms) { v = Math.max(v, search(apply(s, m), depth - 1, a, b, me)); a = Math.max(a, v); if (a >= b) break; }
      return v;
    }
    let v = Infinity;
    for (const m of ms) { v = Math.min(v, search(apply(s, m), depth - 1, a, b, me)); b = Math.min(b, v); if (a >= b) break; }
    return v;
  }
  function bestMove(s, level) {
    const ms = moves(s), me = s.turn;
    // Mühlen und Schläge zuerst prüfen, damit Alpha-Beta mehr abschneidet
    ms.sort((x, y) => (y.r >= 0) - (x.r >= 0));
    const depth = level === "stark" ? (ms.length > 40 ? 3 : 4) : 2;
    let best = ms[0], bv = -Infinity;
    for (const m of ms) {
      const v = search(apply(s, m), depth - 1, -Infinity, Infinity, me) + Math.random() * (level === "stark" ? .3 : 2.5);
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  function mountMuehle(stage, ui) {
    const c = makeCanvas(stage, W, H), x = c.ctx;
    let mode = "cpu", level = "stark";
    const opts = document.createElement("div"); opts.className = "race-setup"; ui.tools.append(opts);
    segmented(opts, [["cpu", "Gegen Computer"], ["duo", "Zu zweit"]], mode, v => { mode = v; lvl.hidden = v !== "cpu"; reset(); });
    const lvl = segmented(opts, [["normal", "Normal"], ["stark", "Stark"]], level, v => { level = v; reset(); });

    let S, picked, pendingMill, last, over, cpuT, raf, t = 0, lastT = 0, history, quiet = 0;
    const names = () => mode === "cpu" ? ["", "Du", "Computer"] : ["", "Blau", "Rot"];
    const isCpu = p => mode === "cpu" && p === 2;

    function reset() {
      clearTimeout(cpuT);
      S = fresh(); picked = -1; pendingMill = null; last = null; over = false; history = []; quiet = 0;
      ui.score(ui.get() || 0); c.hide(); say();
    }
    function say(prefix) {
      const n = names(), p = S.turn, who = n[p];
      let txt;
      if (pendingMill) txt = `Mühle! ${p === 1 && mode === "cpu" ? "Nimm" : `${who}, nimm`} einen leuchtenden Stein des Gegners.`;
      else if (isCpu(p)) txt = "Der Computer überlegt …";
      else if (S.hand[p] > 0) txt = `${who}${mode === "cpu" ? ", setz" : " setzt"} einen Stein (${S.hand[p]} übrig).`;
      else if (count(S, p) === 3) txt = `${who} ${mode === "cpu" ? "darfst" : "darf"} springen: Stein wählen, dann ein freies Feld.`;
      else txt = `${who} ${mode === "cpu" ? "ziehst" : "zieht"}: Stein wählen, dann ein Nachbarfeld.`;
      ui.status(prefix ? `${prefix} ${txt}` : txt);
    }
    function commit(m) {
      const p = S.turn, took = m.r >= 0;
      history.push(S);
      S = apply(S, m); last = m; picked = -1; pendingMill = null;
      const w = winner(S);
      if (w) return finish(w);
      // Remis: 60 Züge ohne geschlagenen Stein, nachdem alle Steine gesetzt sind
      quiet = took ? 0 : (S.hand[1] || S.hand[2] ? 0 : quiet + 1);
      if (quiet >= 60) return finish(0);
      const n = names();
      say(took ? `${n[p]} ${mode === "cpu" && p === 1 ? "hast" : "hat"} einen Stein genommen.` : "");
      if (isCpu(S.turn)) cpuT = setTimeout(cpuTurn, 450);
    }
    function cpuTurn() { if (!over && isCpu(S.turn)) commit(bestMove(S, level)); }
    function finish(w) {
      over = true; picked = -1;
      const n = names();
      if (!w) {
        c.show("Unentschieden", "60 Züge ohne geschlagenen Stein. Keiner kommt mehr durch.", "Neue Partie", reset);
        return ui.status("Unentschieden nach 60 Zügen ohne Schlag.");
      }
      if (mode === "cpu" && w === 1) { ui.set((ui.get() || 0) + 1); ui.score(ui.get()); }
      const why = total(S, 3 - w) < 3 ? "nur noch zwei Steine" : "keinen Zug mehr";
      c.show(mode === "cpu" ? (w === 1 ? "Gewonnen!" : "Der Computer gewinnt") : `${n[w]} gewinnt!`,
        `${n[3 - w]} ${mode === "cpu" && w === 2 ? "hast" : "hat"} ${why}.`, "Neue Partie", reset, mode === "cpu" && w === 1 ? "Sieg!" : "");
      ui.status(`${n[w]} ${mode === "cpu" && w === 1 ? "hast" : "hat"} gewonnen.`);
    }

    /* ---------- Eingabe ---------- */
    function legalFor(p) { return moves(S).filter(m => !pendingMill || (m.f === pendingMill.f && m.t === pendingMill.t)); }
    function clickPoint(i) {
      if (over || isCpu(S.turn)) return;
      const p = S.turn, ms = legalFor(p);
      if (pendingMill) {
        const m = ms.find(mm => mm.r === i);
        if (m) commit(m);
        return;
      }
      if (S.hand[p] > 0) {
        const opts2 = ms.filter(m => m.t === i);
        if (!opts2.length) return;
        if (opts2[0].r >= 0) { pendingMill = { f: -1, t: i }; say(); } else commit(opts2[0]);
        return;
      }
      if (S.b[i] === p) { picked = ms.some(m => m.f === i) ? i : -1; if (picked < 0) ui.status("Dieser Stein kann nicht ziehen."); return; }
      if (picked >= 0 && !S.b[i]) {
        const opts2 = ms.filter(m => m.f === picked && m.t === i);
        if (!opts2.length) return;
        if (opts2[0].r >= 0) { pendingMill = { f: picked, t: i }; say(); } else commit(opts2[0]);
      }
    }
    c.cv.addEventListener("pointerdown", e => {
      if (!c.ov.hidden) return;
      const pt = c.pt(e);
      let best = -1, bd = 30;
      PTS.forEach((_, i) => { const [px, py] = xy(i), d = Math.hypot(pt.x - px, pt.y - py); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) clickPoint(best);
    });
    const undoBtn = document.createElement("button"); undoBtn.className = "btn"; undoBtn.type = "button"; undoBtn.textContent = "↶ Rückgängig";
    undoBtn.onclick = () => {
      if (over || !history.length) return;
      clearTimeout(cpuT);
      // gegen den Computer zwei Halbzüge zurück, damit du wieder dran bist
      let steps = mode === "cpu" && history.length >= 2 && S.turn === 1 ? 2 : 1;
      while (steps-- && history.length) S = history.pop();
      picked = -1; pendingMill = null; last = null; say("Zurückgenommen.");
      if (isCpu(S.turn)) cpuT = setTimeout(cpuTurn, 450);
    };
    ui.tools.append(undoBtn);

    /* ---------- Zeichnen ---------- */
    function draw() {
      const P = pal(), col = [null, P.c[0], P.c[1]];
      x.fillStyle = P.paper; x.fillRect(0, 0, W, H);
      const g = x.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 380); g.addColorStop(0, "#1a2644"); g.addColorStop(1, "#0b1224");
      x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(14, 14, W - 28, H - 28, 26) : x.rect(14, 14, W - 28, H - 28); x.fill();
      x.strokeStyle = "rgba(226,181,82,.5)"; x.lineWidth = 1.5; x.stroke();
      // Linien
      x.strokeStyle = P.marker; x.lineWidth = 3; x.lineCap = "round";
      for (const k of [0, 1, 2]) { const a = PAD + k * STEP, s = (6 - 2 * k) * STEP; x.strokeRect(a, a, s, s); }
      x.beginPath();
      x.moveTo(W / 2, PAD); x.lineTo(W / 2, PAD + 2 * STEP); x.moveTo(W / 2, PAD + 4 * STEP); x.lineTo(W / 2, PAD + 6 * STEP);
      x.moveTo(PAD, H / 2); x.lineTo(PAD + 2 * STEP, H / 2); x.moveTo(PAD + 4 * STEP, H / 2); x.lineTo(PAD + 6 * STEP, H / 2);
      x.stroke();
      // Mögliche Ziele
      const ms = over || isCpu(S.turn) ? [] : legalFor(S.turn);
      const targets = new Set(), removes = new Set(), movable = new Set();
      if (pendingMill) ms.filter(m => m.f === pendingMill.f && m.t === pendingMill.t).forEach(m => removes.add(m.r));
      else if (S.hand[S.turn] > 0) ms.forEach(m => targets.add(m.t));
      else { ms.forEach(m => movable.add(m.f)); if (picked >= 0) ms.filter(m => m.f === picked).forEach(m => targets.add(m.t)); }
      // Punkte und Steine
      for (let i = 0; i < 24; i++) {
        const [px, py] = xy(i), v = S.b[i];
        x.fillStyle = "#0b1224"; x.beginPath(); x.arc(px, py, 7, 0, 6.283); x.fill();
        x.strokeStyle = P.marker; x.lineWidth = 2; x.stroke();
        if (targets.has(i)) { x.fillStyle = "rgba(226,181,82,.35)"; x.beginPath(); x.arc(px, py, 14 + Math.sin(t * 5) * 2, 0, 6.283); x.fill(); }
        if (!v) continue;
        const lift = i === picked ? 4 : 0;
        x.fillStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.arc(px + 2, py + 4, 19, 0, 6.283); x.fill();
        const sg = x.createRadialGradient(px - 6, py - 8 - lift, 2, px, py - lift, 20); sg.addColorStop(0, "#fff"); sg.addColorStop(.25, col[v]); sg.addColorStop(1, col[v]);
        x.fillStyle = sg; x.beginPath(); x.arc(px, py - lift, 19, 0, 6.283); x.fill();
        x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 2; x.beginPath(); x.arc(px, py - lift, 12, 0, 6.283); x.stroke();
        if (removes.has(i)) { x.strokeStyle = P.red; x.lineWidth = 3; x.beginPath(); x.arc(px, py, 24 + Math.sin(t * 6) * 2, 0, 6.283); x.stroke(); }
        else if (i === picked || (movable.has(i) && picked < 0)) { x.strokeStyle = i === picked ? P.fg : "rgba(255,255,255,.35)"; x.lineWidth = 2; x.beginPath(); x.arc(px, py - lift, 23, 0, 6.283); x.stroke(); }
        if (last && (last.t === i) && !over) { x.fillStyle = P.marker; x.beginPath(); x.arc(px, py - lift, 4, 0, 6.283); x.fill(); }
      }
      // Steine in der Hand
      const n = names();
      for (const p of [1, 2]) {
        const y0 = p === 1 ? H - 22 : 22;
        x.font = "600 11px 'IBM Plex Mono', monospace"; x.fillStyle = S.turn === p && !over ? P.marker : P.muted; x.textBaseline = "middle";
        x.textAlign = p === 1 ? "left" : "right";
        x.fillText(`${n[p].toUpperCase()} · ${count(S, p)} AUF DEM BRETT`, p === 1 ? 30 : W - 30, y0);
        for (let k = 0; k < S.hand[p]; k++) {
          const hx = p === 1 ? W - 34 - k * 14 : 34 + k * 14;
          x.fillStyle = col[p]; x.beginPath(); x.arc(hx, y0, 5.5, 0, 6.283); x.fill();
        }
      }
      x.textAlign = "left";
    }
    function frame(now) { t += lastT ? Math.min(.05, (now - lastT) / 1000) : 0; lastT = now; draw(); raf = requestAnimationFrame(frame); }

    ui.onRestart(reset);
    reset();
    c.show("Mühle", "Setz deine 9 Steine, dann zieh sie entlang der Linien. Drei in einer Reihe sind eine Mühle: Dann nimmst du einen gegnerischen Stein.", "Los geht’s", () => c.hide());
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(cpuT); };
  }

  WNG.games.muehle = mountMuehle;
  WNG._muehle = { fresh, moves, apply, winner, bestMove };
})();
