// WebNoah-Games: Heast chü amoi. Würfel-Rausschmeißspiel für 2 bis 4 auf einem runden Brett. Wird von assets/js/shell.js gestartet.
// Regeln: vier Figuren pro Farbe. Mit einer 6 aus dem Haus aufs Startfeld. Einmal ums Brett (40 Felder), dann in die vier Zielfelder.
// Wer auf einer fremden Figur landet, schickt sie ins Haus. Eine 6 gibt einen Extrawurf.
// Ist keine Figur draußen, gibt es drei Versuche für eine 6. Im Ziel wird nicht übersprungen und genau eingezogen.
(() => {
  "use strict";
  const { makeCanvas, pal, segmented, rnd } = WNG;

  const LOOP = 40, PIECES = 4, LAST = LOOP + PIECES - 1; // Fortschritt 0..39 Runde, 40..43 Ziel
  const W = 600, H = 600, CX = 300, CY = 300, RING = 228;
  const NAMES = ["Blau", "Rot", "Grün", "Gelb"];
  const SAY_HIT = ["Heast, chü amoi!", "Na servas, ab ins Haus!", "Des woa knapp. Fia di.", "Oida, wieso i?", "Schleich di ham!"];
  const SAY_SIX = ["Sechser! Nomoi!", "Leiwand, nomoi würfeln.", "A Sechser, gö?"];

  const ang = i => -Math.PI / 2 + (i / LOOP) * Math.PI * 2;
  const fieldXY = i => [CX + Math.cos(ang(i)) * RING, CY + Math.sin(ang(i)) * RING];

  function mountHeast(stage, ui) {
    const c = makeCanvas(stage, W, H), x = c.ctx;
    let count = 4, mode = "cpu";
    const opts = document.createElement("div"); opts.className = "race-setup"; ui.tools.append(opts);
    segmented(opts, [["2", "2 Spieler"], ["3", "3 Spieler"], ["4", "4 Spieler"]], "4", v => { count = +v; reset(); });
    segmented(opts, [["cpu", "Gegen Computer"], ["local", "Alle am Gerät"]], mode, v => { mode = v; reset(); });
    const rollBtn = document.createElement("button"); rollBtn.className = "btn primary"; rollBtn.type = "button"; rollBtn.textContent = "Würfeln (Leertaste)";
    ui.tools.append(rollBtn);

    // seats: welche Farben spielen (bei 2 Spielern gegenüber)
    let seats, P, turn, die, tries, phase, moves, rolling = 0, cpuT, raf, last = 0, t = 0, bubble = null, anim = null;
    const startField = p => p * 10;
    const isBot = p => mode === "cpu" && p !== seats[0];
    const fieldOf = (p, prog) => (startField(p) + prog) % LOOP;

    function reset() {
      clearTimeout(cpuT);
      seats = count === 2 ? [0, 2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3];
      P = {}; seats.forEach(p => { P[p] = Array(PIECES).fill(-1); });
      turn = seats[0]; die = 0; tries = 0; phase = "roll"; moves = []; anim = null; bubble = null;
      ui.score(ui.get() || 0); c.hide(); say(); next();
    }
    const who = p => mode === "cpu" ? (p === seats[0] ? "Du" : `${NAMES[p]} (Computer)`) : NAMES[p];
    function say(pre) {
      const p = turn, du = mode === "cpu" && p === seats[0];
      let txt = "";
      if (phase === "roll") txt = isBot(p) ? `${who(p)} würfelt …` : du ? `Du bist dran. Würfeln!${tries ? ` (Versuch ${tries + 1} von 3)` : ""}` : `${who(p)} ist dran.`;
      else if (phase === "pick") txt = `${who(p)} ${du ? "hast" : "hat"} eine ${die}. Leuchtende Figur antippen.`;
      ui.status(pre ? `${pre} ${txt}` : txt);
      rollBtn.disabled = phase !== "roll" || isBot(p);
    }
    const onBoard = p => P[p].some(v => v >= 0 && v < LOOP);
    const allHomeOrDone = p => P[p].every(v => v < 0 || v >= LOOP);

    function occupant(field) {
      for (const p of seats) for (let k = 0; k < PIECES; k++) { const v = P[p][k]; if (v >= 0 && v < LOOP && fieldOf(p, v) === field) return { p, k }; }
      return null;
    }
    function legal(p, d) {
      const out = [];
      for (let k = 0; k < PIECES; k++) {
        const v = P[p][k];
        if (v < 0) {
          if (d !== 6) continue;
          const occ = occupant(startField(p));
          if (occ && occ.p === p) continue;
          out.push({ k, to: 0, hit: occ });
          continue;
        }
        const to = v + d;
        if (to > LAST) continue;
        if (to >= LOOP) {
          // im Ziel nicht über eigene Figuren springen
          let blocked = false;
          for (let s = Math.max(v + 1, LOOP); s <= to; s++) if (P[p].some((w, kk) => kk !== k && w === s)) blocked = true;
          if (!blocked) out.push({ k, to, hit: null });
          continue;
        }
        const occ = occupant(fieldOf(p, to));
        if (occ && occ.p === p) continue;
        out.push({ k, to, hit: occ });
      }
      // Hausregel: Startfeld räumen, wenn noch Figuren im Haus warten
      const startOcc = P[p].findIndex(v => v === 0);
      if (startOcc >= 0 && P[p].some(v => v < 0)) {
        const clear = out.filter(m => m.k === startOcc);
        if (clear.length) return clear;
      }
      // Mit einer 6 muss eine Figur raus, wenn das geht
      const out6 = out.filter(m => P[p][m.k] < 0);
      return d === 6 && out6.length ? out6 : out;
    }
    function roll() {
      if (phase !== "roll" || rolling) return;
      phase = "rolling"; rolling = .5; rollBtn.disabled = true;
      cpuT = setTimeout(() => { rolling = 0; die = 1 + rnd(6); afterRoll(); }, 500);
    }
    function afterRoll() {
      moves = legal(turn, die);
      if (!moves.length) {
        if (allHomeOrDone(turn) && die !== 6 && tries < 2) { tries++; phase = "roll"; say(`${die}. Nix.`); return next(); }
        tries = 0; return endTurn(`${die}. Kein Zug möglich.`);
      }
      tries = 0;
      if (isBot(turn) || moves.length === 1) { phase = "moving"; cpuT = setTimeout(() => apply(isBot(turn) ? botPick() : moves[0]), isBot(turn) ? 420 : 220); return; }
      phase = "pick"; say();
    }
    function botPick() {
      const sc = m => {
        const v = P[turn][m.k];
        let s = m.to - Math.max(0, v);
        if (m.hit) s += 30 + P[m.hit.p][m.hit.k];
        if (v < 0) s += 18;
        if (m.to >= LOOP) s += 25;
        if (m.to < LOOP) for (const q of seats) if (q !== turn) for (const w of P[q]) {
          if (w < 0 || w >= LOOP) continue;
          const gap = (fieldOf(turn, m.to) - fieldOf(q, w) + LOOP) % LOOP;
          if (gap >= 1 && gap <= 6) s -= 7;
        }
        return s + Math.random();
      };
      return moves.reduce((a, b) => sc(b) > sc(a) ? b : a);
    }
    function apply(m) {
      const p = turn, from = P[p][m.k];
      anim = { p, k: m.k, from, to: m.to, t: 0 };
      P[p][m.k] = m.to;
      let msg = "";
      if (m.hit) { P[m.hit.p][m.hit.k] = -1; bubble = { text: SAY_HIT[rnd(SAY_HIT.length)], p: m.hit.p, until: performance.now() + 1800 }; msg = `${NAMES[m.hit.p]} fliegt raus!`; }
      phase = "moving";
      cpuT = setTimeout(() => {
        anim = null;
        if (P[p].every(v => v >= LOOP)) return finish(p);
        if (die === 6) { phase = "roll"; say(`${msg} ${SAY_SIX[rnd(SAY_SIX.length)]}`.trim()); next(); }
        else endTurn(msg);
      }, 420);
    }
    function endTurn(msg) {
      const i = seats.indexOf(turn);
      turn = seats[(i + 1) % seats.length]; phase = "roll"; tries = 0; say(msg); next();
    }
    function next() { if (phase === "roll" && isBot(turn)) cpuT = setTimeout(roll, 600); }
    function finish(p) {
      phase = "over"; rollBtn.disabled = true;
      const youWin = mode === "cpu" && p === seats[0];
      if (youWin) { ui.set((ui.get() || 0) + 1); ui.score(ui.get()); }
      c.show(mode === "cpu" ? (youWin ? "Gewonnen!" : `${NAMES[p]} gewinnt`) : `${NAMES[p]} gewinnt!`,
        youWin ? "Alle vier im Ziel. Leiwand!" : mode === "cpu" ? "Na geh. Revanche?" : "Alle vier im Ziel.", "Neue Runde", reset, youWin ? "Sieg!" : "");
      ui.status(`${NAMES[p]} hat gewonnen.`);
    }

    /* ---------- Positionen ---------- */
    function homeXY(p, k) {
      const a = ang(startField(p)) - .42, r = RING + 50;
      const bx = CX + Math.cos(a) * r, by = CY + Math.sin(a) * r;
      return [bx + (k % 2 ? 13 : -13), by + (k < 2 ? -13 : 13)];
    }
    function goalXY(p, slot) {
      const a = ang(startField(p) - .5), r = RING - 46 - slot * 34;
      return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
    }
    const pieceXY = (p, k, v) => v < 0 ? homeXY(p, k) : v >= LOOP ? goalXY(p, v - LOOP) : fieldXY(fieldOf(p, v));

    /* ---------- Zeichnen ---------- */
    function draw(now) {
      const PL = pal(), col = [PL.c[0], PL.c[1], PL.c[2], PL.c[3]];
      x.fillStyle = PL.paper; x.fillRect(0, 0, W, H);
      const g = x.createRadialGradient(CX, CY, 20, CX, CY, 300); g.addColorStop(0, "#1b2a4b"); g.addColorStop(1, "#0a1122");
      x.fillStyle = g; x.beginPath(); x.arc(CX, CY, 290, 0, 6.283); x.fill();
      x.strokeStyle = "rgba(226,181,82,.5)"; x.lineWidth = 1.5; x.stroke();
      // Bahn
      x.strokeStyle = "rgba(255,255,255,.07)"; x.lineWidth = 30; x.beginPath(); x.arc(CX, CY, RING, 0, 6.283); x.stroke();
      for (let i = 0; i < LOOP; i++) {
        const [fx, fy] = fieldXY(i), owner = i % 10 === 0 ? i / 10 : -1, active = owner >= 0 && seats.includes(owner);
        x.beginPath(); x.arc(fx, fy, active ? 15 : 11.5, 0, 6.283);
        x.fillStyle = active ? col[owner] : "#1b2846"; x.globalAlpha = active ? .45 : 1; x.fill(); x.globalAlpha = 1;
        x.strokeStyle = active ? col[owner] : "rgba(226,181,82,.45)"; x.lineWidth = 1.5; x.stroke();
      }
      // Häuser und Ziele
      for (const p of seats) {
        const a = ang(startField(p)) - .42, r = RING + 50;
        x.fillStyle = col[p]; x.globalAlpha = .12; x.beginPath(); x.arc(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 34, 0, 6.283); x.fill(); x.globalAlpha = 1;
        x.strokeStyle = col[p]; x.globalAlpha = .6; x.lineWidth = 1.5; x.stroke(); x.globalAlpha = 1;
        for (let s = 0; s < PIECES; s++) {
          const [gx, gy] = goalXY(p, s);
          x.beginPath(); x.arc(gx, gy, 12, 0, 6.283); x.fillStyle = "#0e1830"; x.fill(); x.strokeStyle = col[p]; x.lineWidth = 2; x.stroke();
        }
        for (let k = 0; k < PIECES; k++) { const [hx, hy] = homeXY(p, k); x.beginPath(); x.arc(hx, hy, 9, 0, 6.283); x.fillStyle = "#0e1830"; x.fill(); }
      }
      // Würfel in der Mitte
      const shown = rolling > 0 ? 1 + Math.floor((t * 22) % 6) : die;
      drawDie(CX, CY - 8, 66, shown, phase === "pick" || rolling > 0 ? col[turn] : null);
      x.font = "600 11px 'IBM Plex Mono', monospace"; x.fillStyle = PL.muted; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(phase === "over" ? "RUNDE VORBEI" : `${NAMES[turn].toUpperCase()} IST DRAN`, CX, CY + 46);
      // Figuren
      for (const p of seats) for (let k = 0; k < PIECES; k++) {
        let v = P[p][k], [px, py] = pieceXY(p, k, v);
        if (anim && anim.p === p && anim.k === k && anim.from >= 0 && anim.to < LOOP) {
          const e = Math.min(1, anim.t / .35), prog = anim.from + (anim.to - anim.from) * e;
          const fi = Math.floor(prog), fr = prog - fi, a1 = fieldXY(fieldOf(p, fi)), a2 = fieldXY(fieldOf(p, Math.min(fi + 1, anim.to)));
          px = a1[0] + (a2[0] - a1[0]) * fr; py = a1[1] + (a2[1] - a1[1]) * fr - Math.sin(e * Math.PI) * 12;
        }
        const pick = phase === "pick" && p === turn && moves.some(m => m.k === k);
        if (pick) { x.strokeStyle = PL.marker; x.lineWidth = 2.5; x.beginPath(); x.arc(px, py, 15 + Math.sin(t * 7) * 2, 0, 6.283); x.stroke(); }
        x.fillStyle = "rgba(0,0,0,.45)"; x.beginPath(); x.arc(px + 1.5, py + 3, 10, 0, 6.283); x.fill();
        const sg = x.createRadialGradient(px - 3, py - 4, 1, px, py, 11); sg.addColorStop(0, "#fff"); sg.addColorStop(.3, col[p]); sg.addColorStop(1, col[p]);
        x.fillStyle = sg; x.beginPath(); x.arc(px, py, 10, 0, 6.283); x.fill();
        x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 1.2; x.stroke();
      }
      // Sprechblase
      if (bubble && now < bubble.until) {
        const [bx, by] = homeXY(bubble.p, 0);
        x.font = "700 14px Inter, sans-serif"; const tw = x.measureText(bubble.text).width + 22;
        const lx = Math.max(10, Math.min(W - tw - 10, bx - tw / 2)), ly = Math.max(10, by - 64);
        x.fillStyle = "#f4f1e8"; x.beginPath(); x.roundRect ? x.roundRect(lx, ly, tw, 32, 10) : x.rect(lx, ly, tw, 32); x.fill();
        x.fillStyle = "#121833"; x.textAlign = "left"; x.fillText(bubble.text, lx + 11, ly + 17);
      }
      x.textAlign = "left";
    }
    function drawDie(cx, cy, s, n, glow) {
      x.save(); x.translate(cx, cy); x.rotate(rolling > 0 ? Math.sin(t * 30) * .3 : 0);
      if (glow) { x.shadowColor = glow; x.shadowBlur = 24; }
      x.fillStyle = "#f4f1e8"; x.beginPath(); x.roundRect ? x.roundRect(-s / 2, -s / 2, s, s, 12) : x.rect(-s / 2, -s / 2, s, s); x.fill(); x.shadowBlur = 0;
      if (n) {
        const d = s * .26, pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
        x.fillStyle = n === 6 ? "#b8862f" : "#121833";
        for (const [a, b] of pips) { x.beginPath(); x.arc(a * d, b * d, s * .075, 0, 6.283); x.fill(); }
      } else { x.fillStyle = "#121833"; x.font = "800 24px Cinzel, Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("?", 0, 2); }
      x.restore();
    }
    function frame(now) {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
      if (rolling > 0) rolling = Math.max(.01, rolling - dt);
      if (anim) anim.t += dt;
      draw(now); raf = requestAnimationFrame(frame);
    }

    function pick(k) { if (phase !== "pick") return; const m = moves.find(mm => mm.k === k); if (m) apply(m); }
    c.cv.addEventListener("pointerdown", e => {
      if (!c.ov.hidden) return;
      const pt = c.pt(e);
      if (phase === "roll" && !isBot(turn) && Math.hypot(pt.x - CX, pt.y - CY + 8) < 44) return roll();
      if (phase !== "pick") return;
      for (const m of moves) { const [px, py] = pieceXY(turn, m.k, P[turn][m.k]); if (Math.hypot(pt.x - px, pt.y - py) < 20) return pick(m.k); }
    });
    rollBtn.onclick = roll;
    ui.onKey(e => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (phase === "roll" && !isBot(turn)) roll(); }
      else if (/^[1-4]$/.test(e.key)) pick(+e.key - 1);
    });

    ui.onRestart(reset);
    reset();
    c.show("Heast chü amoi", "Mit einer 6 raus aus dem Haus, einmal ums Brett und ab ins Ziel. Wer auf dir landet, schickt dich heim. Also: chü amoi.", "Los geht’s", () => c.hide());
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(cpuT); };
  }

  WNG.games.heast = mountHeast;
})();
