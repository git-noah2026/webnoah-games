// WebNoah-Games: ziegel. Wird von assets/js/shell.js gestartet.
(() => {
  "use strict";
  const { $, h, rnd, clamp, shuffle, store, pal, rr, karo, makeCanvas, segmented, MONO, BODY, SUB } = WNG;

    function mountZiegel(stage, ui) {
    const W = 420, H = 520, c = makeCanvas(stage, W, H);
    const PW = 84, PH = 12, PY = H - 40, BR = 7, COLS = 8, ROWS = 5, GAP = 6, TOP = 60, SIDE = 14, BH = 18;
    const BW = (W - 2 * SIDE - (COLS - 1) * GAP) / COLS;
    const ROWC = [1, 3, 2, 4, 0];
    let px, tx, ball, bricks, lives, level, score, state, raf, last = 0;
    const keys = { l: false, r: false };
    const speed = () => 290 + level * 35;
    function build() { bricks = []; for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) bricks.push({ x: SIDE + k * (BW + GAP), y: TOP + r * (BH + GAP), r, on: true }); }
    function stick() { ball = { x: px, y: PY - BR - 1, vx: 0, vy: 0, stuck: true }; }
    function newGame() { lives = 3; level = 1; score = 0; ui.score(0); build(); px = tx = W / 2; stick(); state = "ready"; }
    function launch() {
      if (state === "over" || !ball.stuck) return;
      const a = Math.random() * .6 - .3, s = speed();
      ball.vx = s * Math.sin(a); ball.vy = -s * Math.cos(a); ball.stuck = false; state = "run";
    }
    function move(dt) {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && ball.y + BR >= PY && ball.y + BR <= PY + PH + 8 && ball.x >= px - PW / 2 - BR && ball.x <= px + PW / 2 + BR) {
        const off = clamp((ball.x - px) / (PW / 2), -1, 1), a = off * 1.05, s = speed();
        ball.vx = s * Math.sin(a); ball.vy = -s * Math.cos(a); ball.y = PY - BR;
      }
      if (ball.y > H + BR) {
        lives--;
        if (lives <= 0) {
          state = "over";
          const rec = ui.submit(score) && score > 0;
          c.show("Keine Bälle mehr", `${score} Punkte · Level ${level}`, "Nochmal", () => { c.hide(); newGame(); }, rec ? "Neuer Rekord!" : "");
        } else { stick(); state = "ready"; }
        return true;
      }
      for (const b of bricks) {
        if (!b.on) continue;
        const nx = clamp(ball.x, b.x, b.x + BW), ny = clamp(ball.y, b.y, b.y + BH);
        const dx = ball.x - nx, dy = ball.y - ny;
        if (dx * dx + dy * dy > BR * BR) continue;
        b.on = false; score += 10 * level; ui.score(score);
        const ox = Math.min(ball.x + BR - b.x, b.x + BW - (ball.x - BR));
        const oy = Math.min(ball.y + BR - b.y, b.y + BH - (ball.y - BR));
        if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
        if (bricks.every(k => !k.on)) { level++; build(); stick(); state = "ready"; }
        return true;
      }
      return false;
    }
    function update(dt) {
      if (state === "over") return;
      if (keys.l) tx -= 560 * dt;
      if (keys.r) tx += 560 * dt;
      tx = clamp(tx, PW / 2, W - PW / 2);
      px += (tx - px) * Math.min(1, dt * 25);
      if (ball.stuck) { ball.x = px; return; }
      const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4));
      for (let i = 0; i < steps; i++) if (move(dt / steps)) break;
    }
    function draw() {
      const p = pal(), x = c.ctx;
      karo(x, W, H, 20, p);
      x.font = MONO; x.textBaseline = "middle"; x.fillStyle = p.muted;
      x.textAlign = "left"; x.fillText(`LEVEL ${level}`, SIDE, 28);
      x.textAlign = "right"; x.fillText("BÄLLE", W - SIDE - 3 * 16 - 4, 28);
      for (let i = 0; i < 3; i++) {
        x.fillStyle = i < lives ? p.red : p.grid;
        x.beginPath(); x.arc(W - SIDE - 6 - i * 16, 28, 5, 0, Math.PI * 2); x.fill();
      }
      for (const b of bricks) { if (!b.on) continue; x.fillStyle = p.c[ROWC[b.r]]; rr(x, b.x, b.y, BW, BH, 3); x.fill(); }
      x.fillStyle = p.fg; rr(x, px - PW / 2, PY, PW, PH, 6); x.fill();
      x.fillStyle = p.red; x.beginPath(); x.arc(ball.x, ball.y, BR, 0, Math.PI * 2); x.fill();
      if (ball.stuck && state === "ready" && c.ov.hidden) {
        x.fillStyle = p.muted; x.font = BODY; x.textAlign = "center";
        x.fillText("Klicken, tippen oder Leertaste zum Abschießen", W / 2, PY - 70);
      }
      x.textAlign = "left";
    }
    function frame(t) {
      const dt = last ? Math.min(.033, (t - last) / 1000) : 0; last = t;
      update(dt); draw(); raf = requestAnimationFrame(frame);
    }
    c.cv.addEventListener("pointermove", e => { tx = c.pt(e).x; });
    c.cv.addEventListener("pointerdown", e => { tx = c.pt(e).x; if (c.ov.hidden) launch(); });
    const isL = k => k === "ArrowLeft" || k === "a" || k === "A", isR = k => k === "ArrowRight" || k === "d" || k === "D";
    ui.onKey(e => {
      if (isL(e.key)) { keys.l = true; e.preventDefault(); }
      else if (isR(e.key)) { keys.r = true; e.preventDefault(); }
      else if (e.key === " ") { e.preventDefault(); if (c.ov.hidden) launch(); }
    });
    ui.onKeyUp(e => { if (isL(e.key)) keys.l = false; if (isR(e.key)) keys.r = false; });
    ui.onRestart(() => { c.hide(); newGame(); });
    newGame();
    c.show("Ziegelbrecher", "Maus, Finger oder Pfeiltasten steuern den Schläger. Drei Bälle, jedes Level wird schneller.", "Los geht’s", () => c.hide());
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  WNG.games.ziegel = mountZiegel;
})();
