// WebNoah-Games: Kometenrennen, ein Würfel-Rennspiel für 2 bis 4. Wird von assets/js/shell.js gestartet.
// Regeln: Jede Farbe hat zwei Raketen auf ihrem Startfeld. Eine Runde hat 40 Felder.
// ★ Stern: drei Felder weiter. ◎ Wurmloch: zum anderen Wurmloch springen. ☄ Komet: vier Felder zurück.
// Wer auf einer fremden Rakete landet, schickt sie zurück auf ihr Startfeld. Eigene Raketen teilen sich kein Feld.
// Eine 6 gibt einen Extrawurf. Ziel: beide Raketen einmal ganz herum (40 Felder) bringen.
(() => {
  "use strict";
  const { makeCanvas, pal, segmented, rnd } = WNG;

  const LAP = 40, TOKENS = 2;
  const STARS = [5, 15, 25, 35], WORMS = [8, 28], COMETS = [13, 33];
  const NAMES = ["Blau", "Rot", "Grün", "Lila"];
  const W = 560, H = 560;

  // Feldkoordinaten: Quadrat mit 10 Feldern pro Seite, im Uhrzeigersinn ab links oben
  const fieldPos = i => {
    const side = Math.floor(i / 10), k = i % 10, a = 64, b = 496, s = (b - a) / 10;
    if (side === 0) return [a + k * s, a];
    if (side === 1) return [b, a + k * s];
    if (side === 2) return [b - k * s, b];
    return [a, b - k * s];
  };

  function mountRennen(stage, ui) {
    const c = makeCanvas(stage, W, H), x = c.ctx;
    let count = 2, mode = "cpu";
    const setup = document.createElement("div"); setup.className = "race-setup";
    ui.tools.append(setup);
    segmented(setup, [["2", "2 Spieler"], ["3", "3 Spieler"], ["4", "4 Spieler"]], "2", v => { count = +v; reset(); });
    segmented(setup, [["cpu", "Gegen Computer"], ["local", "Alle am Gerät"]], mode, v => { mode = v; reset(); });
    const rollBtn = document.createElement("button"); rollBtn.className = "btn primary"; rollBtn.type = "button"; rollBtn.textContent = "Würfeln (Leertaste)";
    ui.tools.append(rollBtn);

    let players, turn, die, rolling, phase, moves, anim, t = 0, raf, last = 0, cpuT, log;

    const startOf = p => p * 10;
    const posOf = (p, prog) => (startOf(p) + prog) % LAP;
    const isBot = p => mode === "cpu" && p > 0;

    function reset() {
      clearTimeout(cpuT);
      players = Array.from({ length: count }, (_, p) => ({ tokens: Array(TOKENS).fill(0), done: Array(TOKENS).fill(false) }));
      turn = 0; die = 0; rolling = 0; phase = "roll"; moves = []; anim = null; log = "";
      ui.score(ui.get() || 0);
      c.hide(); say(); next();
    }
    function say(extra) {
      const who = isBot(turn) ? `${NAMES[turn]} (Computer)` : (mode === "cpu" ? "Du" : NAMES[turn]);
      const what = phase === "roll" ? (isBot(turn) ? "würfelt …" : (mode === "cpu" ? "bist dran: würfeln!" : "ist dran: würfeln!"))
        : phase === "pick" ? `${who === "Du" ? "hast" : "hat"} eine ${die}. Welche Rakete? Antippen oder 1/2 drücken.` : "";
      ui.status(`${extra ? extra + " " : ""}${who} ${what}`.trim());
      rollBtn.disabled = phase !== "roll" || isBot(turn);
    }

    /* ---------- Spielregeln ---------- */
    function occupant(field, exceptP, exceptT) {
      for (let p = 0; p < players.length; p++) for (let k = 0; k < TOKENS; k++) {
        if (players[p].done[k] || (p === exceptP && k === exceptT)) continue;
        if (posOf(p, players[p].tokens[k]) === field) return { p, k };
      }
      return null;
    }
    // Ergebnis eines Zugs berechnen, ohne ihn auszuführen
    function plan(p, k, d) {
      if (players[p].done[k]) return null;
      let prog = players[p].tokens[k] + d, note = "";
      if (prog >= LAP) return { prog: LAP, finish: true, note: "erreicht das Ziel" };
      let field = posOf(p, prog);
      if (STARS.includes(field)) { prog += 3; note = "Stern! +3"; if (prog >= LAP) return { prog: LAP, finish: true, note: "Stern ins Ziel" }; field = posOf(p, prog); }
      else if (COMETS.includes(field)) { prog = Math.max(0, prog - 4); note = "Komet! −4"; field = posOf(p, prog); }
      else if (WORMS.includes(field)) {
        const other = WORMS[0] === field ? WORMS[1] : WORMS[0];
        const np = (other - startOf(p) + LAP) % LAP;
        if (np > prog || np < prog) { note = np > prog ? "Wurmloch vorwärts!" : "Wurmloch zurück!"; prog = np; field = other; }
      }
      const occ = occupant(field, p, k);
      if (occ && occ.p === p) return null; // eigene Rakete im Weg
      return { prog, finish: false, hit: occ, note };
    }
    function legalMoves(p, d) { return [0, 1].map(k => ({ k, r: plan(p, k, d) })).filter(m => m.r); }

    function roll() {
      if (phase !== "roll" || rolling) return;
      // Ergebnis per Timer, die Animation ist nur Optik. So läuft das Spiel auch in einem Hintergrund-Tab weiter.
      rolling = .55; phase = "rolling"; rollBtn.disabled = true;
      cpuT = setTimeout(() => { rolling = 0; die = 1 + rnd(6); afterRoll(); }, 550);
    }
    function afterRoll() {
      moves = legalMoves(turn, die);
      if (!moves.length) { endTurn(`${die} gewürfelt, aber kein Zug möglich.`); return; }
      if (moves.length === 1 || isBot(turn)) { const m = isBot(turn) ? botChoice(moves) : moves[0]; cpuT = setTimeout(() => apply(m), isBot(turn) ? 450 : 250); phase = "moving"; return; }
      phase = "pick"; say();
    }
    function botChoice(ms) {
      const score = m => {
        const r = m.r, cur = players[turn].tokens[m.k];
        let s = r.prog - cur;
        if (r.finish) s += 40;
        if (r.hit) s += 25 + players[r.hit.p].tokens[r.hit.k];
        if (r.note.startsWith("Komet")) s -= 6;
        // gefährdet? Gegner bis 6 Felder dahinter
        if (!r.finish) {
          const f = posOf(turn, r.prog);
          for (let p = 0; p < players.length; p++) if (p !== turn) for (let k = 0; k < TOKENS; k++) {
            if (players[p].done[k]) continue;
            const gap = (f - posOf(p, players[p].tokens[k]) + LAP) % LAP;
            if (gap >= 1 && gap <= 6) s -= 4;
          }
        }
        return s + Math.random();
      };
      return ms.reduce((a, b) => score(b) > score(a) ? b : a);
    }
    function apply(m) {
      const p = turn, from = players[p].tokens[m.k], r = m.r;
      anim = { p, k: m.k, from, to: r.prog, t: 0 };
      players[p].tokens[m.k] = r.prog;
      let msg = r.note ? `${r.note}` : "";
      if (r.finish) players[p].done[m.k] = true;
      if (r.hit) { players[r.hit.p].tokens[r.hit.k] = 0; msg += `${msg ? " " : ""}${NAMES[r.hit.p]} muss zurück zum Start!`; }
      phase = "moving";
      cpuT = setTimeout(() => {
        anim = null;
        if (players[p].done.every(Boolean)) return finish(p);
        if (die === 6) { phase = "roll"; say(`${msg} Eine 6: nochmal!`.trim()); next(); }
        else endTurn(msg);
      }, 520);
    }
    function endTurn(msg) {
      turn = (turn + 1) % players.length; phase = "roll"; say(msg); next();
    }
    function next() { if (phase === "roll" && isBot(turn)) cpuT = setTimeout(roll, 650); }
    function finish(p) {
      phase = "over"; rollBtn.disabled = true;
      const human = mode === "cpu" ? p === 0 : true;
      if (mode === "cpu" && p === 0) { ui.set((ui.get() || 0) + 1); ui.score(ui.get()); }
      c.show(mode === "cpu" ? (p === 0 ? "Gewonnen!" : `${NAMES[p]} gewinnt`) : `${NAMES[p]} gewinnt!`,
        mode === "cpu" ? (p === 0 ? "Beide Raketen im Ziel. Der Sieg zählt für die Bestenliste." : "Der Computer war schneller. Revanche?") : "Beide Raketen im Ziel.",
        "Neues Rennen", reset, human && mode === "cpu" ? "Sieg!" : "");
      ui.status(`${NAMES[p]} hat das Rennen gewonnen.`);
    }

    /* ---------- Zeichnen ---------- */
    const tokenXY = (p, k, prog, done) => {
      if (done) { const cx = 280 + (p % 2 ? 1 : -1) * 34 + (k ? 14 : -14), cy = 300 + (p < 2 ? -36 : 36) + 70; return [cx, cy]; }
      const [fx, fy] = fieldPos(posOf(p, prog));
      return [fx, fy];
    };
    function draw() {
      const P = pal(), cols = [P.c[0], P.c[1], P.c[2], P.c[4]];
      x.fillStyle = P.paper; x.fillRect(0, 0, W, H);
      // Spielfläche
      const g = x.createRadialGradient(280, 280, 40, 280, 280, 330); g.addColorStop(0, "#16213c"); g.addColorStop(1, "#0a1122");
      x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(20, 20, 520, 520, 28) : x.rect(20, 20, 520, 520); x.fill();
      x.strokeStyle = "rgba(226,181,82,.55)"; x.lineWidth = 1.5; x.stroke();
      // Bahnlinie
      x.strokeStyle = "rgba(255,255,255,.08)"; x.lineWidth = 26; x.lineJoin = "round";
      x.beginPath(); for (let i = 0; i <= LAP; i++) { const [fx, fy] = fieldPos(i % LAP); i ? x.lineTo(fx, fy) : x.moveTo(fx, fy); } x.stroke();
      // Wurmloch-Verbindung
      const [w1x, w1y] = fieldPos(WORMS[0]), [w2x, w2y] = fieldPos(WORMS[1]);
      x.strokeStyle = "rgba(167,139,250,.35)"; x.lineWidth = 2; x.setLineDash([4, 8]); x.lineDashOffset = -t * 20;
      x.beginPath(); x.moveTo(w1x, w1y); x.quadraticCurveTo(280, 280, w2x, w2y); x.stroke(); x.setLineDash([]);
      // Felder
      x.textAlign = "center"; x.textBaseline = "middle";
      for (let i = 0; i < LAP; i++) {
        const [fx, fy] = fieldPos(i), owner = i % 10 === 0 ? i / 10 : -1;
        x.beginPath(); x.arc(fx, fy, 15, 0, 6.283);
        x.fillStyle = owner >= 0 && owner < players.length ? cols[owner] : "#1b2846"; x.globalAlpha = owner >= 0 && owner < players.length ? .35 : 1; x.fill(); x.globalAlpha = 1;
        x.strokeStyle = owner >= 0 && owner < players.length ? cols[owner] : "rgba(255,255,255,.12)"; x.lineWidth = 1.5; x.stroke();
        let icon = "", ic = P.fg;
        if (STARS.includes(i)) { icon = "★"; ic = P.marker; }
        else if (WORMS.includes(i)) { icon = "◎"; ic = P.c[4]; }
        else if (COMETS.includes(i)) { icon = "☄"; ic = P.red; }
        if (icon) { x.font = "16px 'Segoe UI Symbol', 'Noto Sans Symbols 2', sans-serif"; x.fillStyle = ic; x.fillText(icon, fx, fy + 1); }
      }
      // Ziel in der Mitte
      x.font = "800 15px Cinzel, Georgia, serif"; x.fillStyle = P.marker; x.fillText("ZIEL", 280, 370);
      // Würfel
      const shown = rolling > 0 ? 1 + Math.floor((t * 20) % 6) : die;
      drawDie(280, 220, 70, shown, P, phase === "pick" || rolling > 0 ? cols[turn] : null);
      x.font = "600 12px 'IBM Plex Mono', monospace"; x.fillStyle = P.muted;
      x.fillText(phase === "over" ? "RENNEN VORBEI" : `${NAMES[turn].toUpperCase()} IST DRAN`, 280, 280);
      // Raketen
      for (let p = 0; p < players.length; p++) for (let k = 0; k < TOKENS; k++) {
        let [tx, ty] = tokenXY(p, k, players[p].tokens[k], players[p].done[k]);
        if (anim && anim.p === p && anim.k === k) {
          const e = Math.min(1, anim.t / .45), steps = anim.to - anim.from;
          const prog = anim.from + steps * e;
          if (!(players[p].done[k] && e >= 1)) {
            const a = fieldPos(posOf(p, Math.floor(prog) % LAP)), b = fieldPos(posOf(p, Math.ceil(prog) % LAP)), f = prog % 1;
            tx = a[0] + (b[0] - a[0]) * f; ty = a[1] + (b[1] - a[1]) * f - Math.sin(e * Math.PI) * 14;
          }
        }
        // zwei Raketen derselben Farbe auf dem Startfeld nebeneinander
        if (!players[p].done[k] && players[p].tokens[k] === 0 && players[p].tokens[1 - k] === 0 && !players[p].done[1 - k]) { const off = k ? 7 : -7; tx += off; ty += off; }
        const pickable = phase === "pick" && p === turn && moves.some(m => m.k === k);
        if (pickable) { x.strokeStyle = P.marker; x.lineWidth = 2; x.beginPath(); x.arc(tx, ty, 15 + Math.sin(t * 6) * 2, 0, 6.283); x.stroke(); }
        x.fillStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.arc(tx + 1.5, ty + 2.5, 10, 0, 6.283); x.fill();
        x.fillStyle = cols[p]; x.beginPath(); x.arc(tx, ty, 10, 0, 6.283); x.fill();
        x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.5; x.stroke();
        x.fillStyle = P.on; x.font = "700 11px Inter, sans-serif"; x.fillText(String(k + 1), tx, ty + .5);
      }
      // Legende
      x.font = "600 11px 'IBM Plex Mono', monospace"; x.fillStyle = P.muted; x.textAlign = "left";
      x.fillText("★ +3   ◎ WURMLOCH   ☄ −4", 120, 440);
      x.textAlign = "center";
    }
    function drawDie(cx, cy, s, n, P, glow) {
      x.save(); x.translate(cx, cy); x.rotate(rolling > 0 ? Math.sin(t * 30) * .3 : 0);
      if (glow) { x.shadowColor = glow; x.shadowBlur = 24; }
      x.fillStyle = "#f4f1e8"; x.beginPath(); x.roundRect ? x.roundRect(-s / 2, -s / 2, s, s, 12) : x.rect(-s / 2, -s / 2, s, s); x.fill();
      x.shadowBlur = 0;
      if (n) {
        const d = s * .26, pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
        x.fillStyle = n === 6 ? "#b8862f" : "#121833";
        for (const [a, b] of pips) { x.beginPath(); x.arc(a * d, b * d, s * .075, 0, 6.283); x.fill(); }
      } else { x.fillStyle = "#121833"; x.font = "800 26px Cinzel, Georgia, serif"; x.fillText("?", 0, 2); }
      x.restore();
    }

    function frame(now) {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
      if (rolling > 0) rolling = Math.max(.01, rolling - dt);
      if (anim) anim.t += dt;
      draw(); raf = requestAnimationFrame(frame);
    }

    /* ---------- Eingabe ---------- */
    function pick(k) { if (phase !== "pick") return; const m = moves.find(mm => mm.k === k); if (m) apply(m); }
    c.cv.addEventListener("pointerdown", e => {
      if (!c.ov.hidden) return;
      const pt = c.pt(e);
      if (phase === "roll" && !isBot(turn) && Math.abs(pt.x - 280) < 45 && Math.abs(pt.y - 220) < 45) return roll();
      if (phase !== "pick") return;
      for (const m of moves) {
        const [tx, ty] = tokenXY(turn, m.k, players[turn].tokens[m.k], false);
        if (Math.hypot(pt.x - tx, pt.y - ty) < 22) return pick(m.k);
      }
    });
    rollBtn.onclick = roll;
    ui.onKey(e => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (phase === "roll" && !isBot(turn)) roll(); }
      else if (e.key === "1" || e.key === "2") pick(+e.key - 1);
    });

    ui.onRestart(reset);
    reset();
    c.show("Kometenrennen", "Würfeln, Raketen ziehen, beide einmal rundherum bringen. ★ +3 Felder, ◎ Wurmloch, ☄ Komet −4. Wer auf einer fremden Rakete landet, schickt sie heim. Eine 6 bringt einen Extrawurf.", "Los geht’s", () => c.hide());
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(cpuT); };
  }

  WNG.games.rennen = mountRennen;
})();
