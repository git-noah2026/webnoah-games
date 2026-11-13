// WebNoah-Games: Minigolf mit sechs eigenen Bahnen. Wird von assets/js/shell.js gestartet.
// Zielen: vom Ball weg ziehen und loslassen (wie eine Schleuder). Tastatur: ← → zielen, ↑ ↓ Stärke, Leertaste schlagen.
(() => {
  "use strict";
  const { makeCanvas, pal, clamp } = WNG;

  const W = 480, H = 600, R = 7, CUP = 11, MAX_POWER = 760, MAX_STROKES = 8;
  const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];

  // Bahnen: outline = Umriss (Polygon), blocks = Hindernis-Polygone, sand/water = Rechtecke [x, y, w, h]
  const HOLES = [
    { name: "Auftakt", par: 2, start: [240, 500], cup: [240, 120], outline: rect(80, 60, 400, 560) },
    { name: "Knick", par: 3, start: [140, 510], cup: [360, 130],
      outline: [[70, 560], [210, 560], [210, 240], [420, 240], [420, 60], [70, 60]] },
    { name: "Mittelinsel", par: 3, start: [240, 520], cup: [240, 110], outline: rect(60, 60, 420, 560),
      blocks: [[[180, 250], [300, 250], [300, 350], [180, 350]]], bumpers: [[120, 190, 16], [360, 190, 16]] },
    { name: "Sandkasten", par: 3, start: [240, 525], cup: [240, 105], outline: rect(70, 60, 410, 565),
      sand: [[110, 230, 260, 120]], blocks: [[[70, 400], [200, 400], [200, 414], [70, 414]], [[280, 400], [410, 400], [410, 414], [280, 414]]] },
    { name: "Teich", par: 3, start: [110, 520], cup: [370, 110], outline: rect(60, 60, 420, 560),
      water: [[60, 250, 250, 70], [190, 390, 230, 60]] },
    { name: "Pendel", par: 3, start: [240, 530], cup: [240, 100], outline: rect(70, 60, 410, 570),
      mover: { y: 300, h: 16, w: 130, min: 70, max: 410, speed: 1.1 },
      blocks: [[[70, 180], [170, 180], [170, 194], [70, 194]], [[310, 180], [410, 180], [410, 194], [310, 194]]] }
  ];
  const segsOf = poly => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
  const inRect = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
  const verdict = d => d <= -2 ? "Eagle!" : d === -1 ? "Birdie!" : d === 0 ? "Par" : d === 1 ? "Bogey" : `${d} über Par`;

  function mountMinigolf(stage, ui) {
    const c = makeCanvas(stage, W, H), x = c.ctx;
    const card = h2();
    function h2() { const el = document.createElement("div"); el.className = "golf-card"; stage.append(el); return el; }

    let holeIdx, strokes, cur, ball, lastRest, aim = null, kbAim = { a: -Math.PI / 2, p: .5, on: false }, state, raf, last = 0, t = 0, sinkAnim = 0;
    let segs = [];

    function loadHole(i) {
      holeIdx = i; cur = HOLES[i];
      ball = { x: cur.start[0], y: cur.start[1], vx: 0, vy: 0 };
      lastRest = { x: ball.x, y: ball.y };
      strokes[i] = strokes[i] || 0;
      state = "aim"; sinkAnim = 0;
      buildSegs(); renderCard();
      ui.status(`Bahn ${i + 1}: ${cur.name}, Par ${cur.par}. Vom Ball weg ziehen und loslassen.`);
    }
    function buildSegs() {
      segs = segsOf(cur.outline).concat(...(cur.blocks || []).map(segsOf));
      if (cur.mover) { const m = cur.mover, mx = moverX(); segs = segs.concat(segsOf(rect(mx - m.w / 2, m.y, mx + m.w / 2, m.y + m.h))); }
    }
    const moverX = () => { const m = cur.mover; return m.min + m.w / 2 + (Math.sin(t * m.speed) * .5 + .5) * (m.max - m.min - m.w); };
    const total = () => strokes.reduce((a, b) => a + (b || 0), 0);

    function newRound(resume) {
      strokes = Array(HOLES.length).fill(0);
      let start = 0;
      if (resume) { strokes = resume.strokes.slice(); start = resume.hole; }
      ui.score(total()); c.hide(); loadHole(start);
    }
    function renderCard() {
      const parSum = HOLES.reduce((a, b) => a + b.par, 0);
      card.innerHTML = `<table><thead><tr><th>Bahn</th>${HOLES.map((_, i) => `<th class="${i === holeIdx ? "cur" : ""}">${i + 1}</th>`).join("")}<th>Σ</th></tr></thead>
        <tbody><tr><td>Par</td>${HOLES.map(hh => `<td>${hh.par}</td>`).join("")}<td>${parSum}</td></tr>
        <tr><td>Du</td>${strokes.map((s, i) => `<td class="${i === holeIdx ? "cur" : ""}${s && i < holeIdx ? (s < HOLES[i].par ? " under" : s > HOLES[i].par ? " over" : "") : ""}">${s || (i < holeIdx ? 0 : "·")}</td>`).join("")}<td><b>${total()}</b></td></tr></tbody></table>`;
    }

    function shoot(vx, vy) {
      if (state !== "aim") return;
      strokes[holeIdx]++; ui.score(total()); renderCard();
      lastRest = { x: ball.x, y: ball.y };
      ball.vx = vx; ball.vy = vy; state = "roll";
    }

    /* ---------- Physik ---------- */
    function collide() {
      for (const [a, b] of segs) {
        const ex = b[0] - a[0], ey = b[1] - a[1], len2 = ex * ex + ey * ey;
        const tt = clamp(((ball.x - a[0]) * ex + (ball.y - a[1]) * ey) / len2, 0, 1);
        const px = a[0] + ex * tt, py = a[1] + ey * tt, dx = ball.x - px, dy = ball.y - py, d = Math.hypot(dx, dy);
        if (d < R && d > 0) {
          const nx = dx / d, ny = dy / d, dot = ball.vx * nx + ball.vy * ny;
          ball.x = px + nx * R; ball.y = py + ny * R;
          if (dot < 0) { ball.vx -= 1.8 * dot * nx; ball.vy -= 1.8 * dot * ny; }
        }
      }
      for (const [bx, by, br] of cur.bumpers || []) {
        const dx = ball.x - bx, dy = ball.y - by, d = Math.hypot(dx, dy);
        if (d < R + br) {
          const nx = dx / d, ny = dy / d, dot = ball.vx * nx + ball.vy * ny;
          ball.x = bx + nx * (R + br); ball.y = by + ny * (R + br);
          if (dot < 0) { ball.vx -= 2.1 * dot * nx; ball.vy -= 2.1 * dot * ny; }
        }
      }
    }
    function step(dt) {
      t += dt;
      if (cur.mover) buildSegs();
      if (state === "sink") { sinkAnim += dt; if (sinkAnim > .7) holeDone(); return; }
      if (state !== "roll") return;
      const sp0 = Math.hypot(ball.vx, ball.vy);
      const n = Math.max(1, Math.ceil(sp0 * dt / 3));
      for (let i = 0; i < n; i++) {
        const sdt = dt / n;
        ball.x += ball.vx * sdt; ball.y += ball.vy * sdt;
        collide();
        // Loch: langsam genug fällt der Ball hinein, zu schnell hüpft er drüber
        const dx = cur.cup[0] - ball.x, dy = cur.cup[1] - ball.y, d = Math.hypot(dx, dy), sp = Math.hypot(ball.vx, ball.vy);
        if (d < CUP - 2 && sp < 330) { state = "sink"; ball.x = cur.cup[0]; ball.y = cur.cup[1]; ball.vx = ball.vy = 0; return; }
        if (d < CUP + 6 && sp < 420) { ball.vx += dx * 6 * sdt; ball.vy += dy * 6 * sdt; }
        if ((cur.water || []).some(r => inRect(ball.x, ball.y, r))) {
          strokes[holeIdx]++; ui.score(total()); renderCard();
          ball.x = lastRest.x; ball.y = lastRest.y; ball.vx = ball.vy = 0; state = "aim";
          ui.status("Platsch! Ein Strafschlag, der Ball liegt wieder an der alten Stelle.");
          return;
        }
      }
      const sand = (cur.sand || []).some(r => inRect(ball.x, ball.y, r));
      const k = Math.pow(sand ? .04 : .42, dt);
      ball.vx *= k; ball.vy *= k;
      if (Math.hypot(ball.vx, ball.vy) < 7) {
        ball.vx = ball.vy = 0; state = "aim"; lastRest = { x: ball.x, y: ball.y };
        if (strokes[holeIdx] >= MAX_STROKES) { strokes[holeIdx] = MAX_STROKES + 1; ui.status(`Nach ${MAX_STROKES} Schlägen wird der Ball aufgehoben (zählt ${MAX_STROKES + 1}).`); holeDone(); }
      }
    }
    function holeDone() {
      state = "between";
      const s = strokes[holeIdx], d = s - cur.par;
      renderCard();
      if (holeIdx === HOLES.length - 1) {
        state = "over"; ui.clearSave();
        const tot = total(), parSum = HOLES.reduce((a, b) => a + b.par, 0);
        const rec = ui.submit(tot);
        c.show(`${tot} Schläge`, `Par ${parSum}. ${tot - parSum === 0 ? "Genau auf Par!" : tot < parSum ? `${parSum - tot} unter Par!` : `${tot - parSum} über Par.`}`, "Neue Runde", () => newRound(), rec ? "Neuer Rekord!" : "");
        ui.status("Runde fertig.");
        return;
      }
      ui.save({ hole: holeIdx + 1, strokes });
      c.show(s === 1 ? "Hole in One!" : verdict(d), `Bahn ${holeIdx + 1} in ${s} ${s === 1 ? "Schlag" : "Schlägen"}.`, `Weiter zu Bahn ${holeIdx + 2}`, () => { c.hide(); loadHole(holeIdx + 1); });
    }

    /* ---------- Zeichnen ---------- */
    function polyPath(poly) { x.beginPath(); poly.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); }
    function draw() {
      const p = pal();
      x.fillStyle = p.paper; x.fillRect(0, 0, W, H);
      // Sterne im Hintergrund
      x.fillStyle = p.fg;
      for (let i = 0; i < 40; i++) { x.globalAlpha = .15 + .15 * Math.sin(t * 1.5 + i); x.fillRect((i * 97) % W, (i * 61) % H, 1.5, 1.5); }
      x.globalAlpha = 1;
      // Rasen
      polyPath(cur.outline);
      const g = x.createLinearGradient(0, 60, 0, 560); g.addColorStop(0, "#0f4a43"); g.addColorStop(1, "#0b3833");
      x.fillStyle = g; x.fill();
      x.save(); x.clip();
      x.strokeStyle = "rgba(255,255,255,.035)"; x.lineWidth = 18;
      for (let yy = 0; yy < H; yy += 36) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
      x.restore();
      // Sand und Wasser
      for (const r of cur.sand || []) {
        x.fillStyle = "#b8924a"; x.beginPath(); x.roundRect ? x.roundRect(r[0], r[1], r[2], r[3], 18) : x.rect(r[0], r[1], r[2], r[3]); x.fill();
        x.fillStyle = "rgba(255,240,200,.18)";
        for (let i = 0; i < 70; i++) x.fillRect(r[0] + (i * 37) % r[2], r[1] + (i * 53) % r[3], 2, 2);
      }
      for (const r of cur.water || []) {
        x.fillStyle = "#11618a"; x.fillRect(r[0], r[1], r[2], r[3]);
        x.strokeStyle = "rgba(160,220,255,.35)"; x.lineWidth = 1.5;
        for (let yy = r[1] + 12; yy < r[1] + r[3]; yy += 16) {
          x.beginPath();
          for (let xx = r[0]; xx <= r[0] + r[2]; xx += 6) x.lineTo(xx, yy + Math.sin(xx * .08 + t * 2.5) * 2.5);
          x.stroke();
        }
      }
      // Banden
      x.lineJoin = "round"; x.strokeStyle = p.marker; x.lineWidth = 5;
      polyPath(cur.outline); x.stroke();
      for (const b of cur.blocks || []) { polyPath(b); x.fillStyle = "#1b2a49"; x.fill(); x.stroke(); }
      for (const [bx, by, br] of cur.bumpers || []) {
        x.fillStyle = p.c[1]; x.beginPath(); x.arc(bx, by, br, 0, 6.283); x.fill();
        x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 2; x.stroke(); x.strokeStyle = p.marker; x.lineWidth = 5;
      }
      if (cur.mover) {
        const m = cur.mover, mx = moverX();
        x.fillStyle = p.c[4]; x.beginPath();
        x.roundRect ? x.roundRect(mx - m.w / 2, m.y, m.w, m.h, 6) : x.rect(mx - m.w / 2, m.y, m.w, m.h); x.fill();
      }
      // Loch mit Fahne
      const [cx, cy] = cur.cup;
      x.fillStyle = "#020409"; x.beginPath(); x.arc(cx, cy, CUP, 0, 6.283); x.fill();
      x.strokeStyle = p.marker; x.lineWidth = 2; x.stroke();
      x.strokeStyle = p.fg; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy - 46); x.stroke();
      x.fillStyle = p.c[1]; x.beginPath(); x.moveTo(cx, cy - 46);
      x.lineTo(cx + 24 + Math.sin(t * 4) * 2, cy - 39); x.lineTo(cx, cy - 32); x.fill();
      // Abschlag
      x.strokeStyle = "rgba(255,255,255,.25)"; x.lineWidth = 2; x.beginPath(); x.arc(cur.start[0], cur.start[1], 12, 0, 6.283); x.stroke();
      // Zielhilfe
      const a = aimVector();
      if (a && state === "aim") {
        const pw = a.p, len = 30 + pw * 150;
        x.strokeStyle = p.marker; x.lineWidth = 3; x.setLineDash([2, 8]); x.lineCap = "round";
        x.beginPath(); x.moveTo(ball.x, ball.y); x.lineTo(ball.x + Math.cos(a.a) * len, ball.y + Math.sin(a.a) * len); x.stroke();
        x.setLineDash([]);
        // Stärkebalken
        x.fillStyle = "rgba(6,11,26,.7)"; x.fillRect(16, H - 30, 120, 12);
        x.fillStyle = pw > .8 ? p.red : p.marker; x.fillRect(16, H - 30, 120 * pw, 12);
      }
      // Ball
      const shrink = state === "sink" ? Math.max(0, 1 - sinkAnim / .5) : 1;
      if (shrink > 0) {
        x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.arc(ball.x + 2, ball.y + 3, R * shrink, 0, 6.283); x.fill();
        x.fillStyle = "#f5f7fb"; x.beginPath(); x.arc(ball.x, ball.y, R * shrink, 0, 6.283); x.fill();
      }
      // Kopfzeile auf der Bahn
      x.font = "600 13px 'IBM Plex Mono', monospace"; x.fillStyle = p.muted; x.textBaseline = "middle";
      x.textAlign = "left"; x.fillText(`BAHN ${holeIdx + 1}/${HOLES.length} · ${cur.name.toUpperCase()}`, 16, 30);
      x.textAlign = "right"; x.fillText(`PAR ${cur.par} · SCHLAG ${strokes[holeIdx]}`, W - 16, 30);
      x.textAlign = "left";
    }

    /* ---------- Eingabe ---------- */
    function aimVector() {
      if (aim && aim.cur) {
        const dx = aim.sx - aim.cur.x, dy = aim.sy - aim.cur.y, d = Math.hypot(dx, dy);
        if (d < 6) return null;
        return { a: Math.atan2(dy, dx), p: clamp(d / 170, 0, 1) };
      }
      return kbAim.on ? { a: kbAim.a, p: kbAim.p } : null;
    }
    c.cv.addEventListener("pointerdown", e => {
      if (state !== "aim" || !c.ov.hidden) return;
      const pt = c.pt(e); aim = { sx: pt.x, sy: pt.y, cur: pt }; kbAim.on = false;
      try { c.cv.setPointerCapture(e.pointerId); } catch { /* ohne Capture geht es auch */ }
    });
    c.cv.addEventListener("pointermove", e => { if (aim) aim.cur = c.pt(e); });
    const letGo = e => {
      if (!aim) return;
      const v = aimVector(); aim = null;
      if (v && e.type === "pointerup") shoot(Math.cos(v.a) * v.p * MAX_POWER, Math.sin(v.a) * v.p * MAX_POWER);
    };
    c.cv.addEventListener("pointerup", letGo);
    c.cv.addEventListener("pointercancel", letGo);
    ui.onKey(e => {
      if (state !== "aim" || !c.ov.hidden) return;
      const k = e.key;
      if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); kbAim.on = true; kbAim.a += (k === "ArrowLeft" ? -1 : 1) * .06; }
      else if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); kbAim.on = true; kbAim.p = clamp(kbAim.p + (k === "ArrowUp" ? .05 : -.05), .05, 1); }
      else if (k === " " || k === "Enter") { e.preventDefault(); if (kbAim.on) { shoot(Math.cos(kbAim.a) * kbAim.p * MAX_POWER, Math.sin(kbAim.a) * kbAim.p * MAX_POWER); } else kbAim.on = true; }
    });

    function frame(now) {
      const dt = last ? Math.min(.033, (now - last) / 1000) : 0; last = now;
      step(dt); draw(); raf = requestAnimationFrame(frame);
    }

    ui.onRestart(() => { ui.clearSave(); newRound(); });
    newRound();
    const saved = ui.load();
    if (saved && saved.hole > 0 && saved.hole < HOLES.length) {
      c.show("Weiterspielen?", `Deine Runde steht bei Bahn ${saved.hole + 1} mit ${saved.strokes.reduce((a, b) => a + (b || 0), 0)} Schlägen.`,
        `Weiter bei Bahn ${saved.hole + 1}`, () => newRound(saved), "", ["Neue Runde", () => { ui.clearSave(); newRound(); }]);
    } else {
      c.show("Minigolf", "Sechs Bahnen. Vom Ball weg ziehen, Stärke wählen, loslassen. Wasser kostet einen Strafschlag.", "Los geht’s", () => c.hide());
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  WNG.games.minigolf = mountMinigolf;
})();
