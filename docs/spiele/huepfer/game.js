// WebNoah-Games: Hüpfer. Endlos-Läufer unterm Sternenhimmel. Wird von assets/js/shell.js gestartet.
// Eigene Figur (goldene Kugel mit Visier), Doppelsprung über Kristalle, ducken unter Satelliten, Sterne sammeln.
(() => {
  "use strict";
  const { makeCanvas, pal, rr } = WNG;

  const W = 760, H = 300, GROUND = 246, GRAV = 2300, JUMP = 760, R = 17;

  function mountHuepfer(stage, ui) {
    const c = makeCanvas(stage, W, H), x = c.ctx;
    let hero, obs, stars, coins, speed, dist, got, state, raf, last = 0, t = 0, spawnIn, coinIn, shake = 0, ducking = false, jumps = 0;

    function reset() {
      hero = { y: GROUND - R, vy: 0, on: true };
      obs = []; coins = []; speed = 330; dist = 0; got = 0; spawnIn = 1.2; coinIn = 2; jumps = 0; ducking = false; shake = 0;
      stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * (GROUND - 40), z: .2 + Math.random() * .8 }));
      ui.score(0);
    }
    const score = () => Math.floor(dist / 10) + got * 25;
    function start() { if (state === "over") reset(); state = "run"; c.hide(); ui.status("Leertaste oder Tippen: springen (zweimal für Doppelsprung). ↓ oder nach unten wischen: ducken."); }
    function jump() {
      if (state !== "run") return start();
      if (hero.on) { hero.vy = -JUMP; hero.on = false; jumps = 1; }
      else if (jumps === 1) { hero.vy = -JUMP * .82; jumps = 2; }
    }
    function crash() {
      state = "over"; shake = .35;
      const s = score(), rec = ui.submit(s) && s > 0;
      c.show("Autsch!", `${s} Punkte · ${Math.floor(dist / 10)} m · ${got} ${got === 1 ? "Stern" : "Sterne"}`, "Nochmal", start, rec ? "Neuer Rekord!" : "");
      ui.status("");
    }

    function spawn() {
      const lvl = Math.min(1, dist / 9000);
      if (dist > 1500 && Math.random() < .22 + lvl * .18) {
        // Satellit in Kopfhöhe: ducken oder hoch drüber
        const low = Math.random() < .55;
        obs.push({ kind: "sat", x: W + 40, y: low ? GROUND - 52 : GROUND - 96, w: 46, h: 22, spin: Math.random() * 6 });
      } else {
        const n = 1 + (Math.random() < .25 + lvl * .3 ? 1 : 0) + (Math.random() < lvl * .25 ? 1 : 0);
        const hgt = 30 + Math.random() * (18 + lvl * 16);
        obs.push({ kind: "crystal", x: W + 30, w: n * 22, h: hgt, n });
      }
      spawnIn = Math.max(.55, 1.35 - lvl * .6) + Math.random() * .7;
    }
    const heroBox = () => {
      const hh = ducking && hero.on ? R * 1.1 : R * 2;
      return { x: 96 - R + 5, y: hero.y + R - hh + 4, w: R * 2 - 10, h: hh - 6 };
    };
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    function step(dt) {
      if (state !== "run") { if (shake > 0) shake -= dt; return; }
      speed = Math.min(820, 330 + dist * .022);
      dist += speed * dt;
      ui.score(score());
      hero.vy += GRAV * dt * (ducking && !hero.on ? 1.8 : 1); hero.y += hero.vy * dt;
      if (hero.y >= GROUND - R) { hero.y = GROUND - R; hero.vy = 0; hero.on = true; jumps = 0; }
      for (const s of stars) { s.x -= speed * dt * s.z * .08; if (s.x < 0) s.x += W; }
      spawnIn -= dt; if (spawnIn <= 0) spawn();
      coinIn -= dt;
      if (coinIn <= 0) { const y = GROUND - 40 - Math.random() * 110; for (let i = 0; i < 3; i++) coins.push({ x: W + 20 + i * 34, y, got: false }); coinIn = 2.5 + Math.random() * 2.5; }
      const hb = heroBox();
      for (const o of obs) {
        o.x -= speed * dt;
        const box = o.kind === "sat" ? { x: o.x + 4, y: o.y + 3, w: o.w - 8, h: o.h - 6 } : { x: o.x + 5, y: GROUND - o.h + 6, w: o.w - 10, h: o.h - 6 };
        if (hit(hb, box)) return crash();
      }
      for (const cn of coins) {
        cn.x -= speed * dt;
        if (!cn.got && Math.hypot(cn.x - 96, cn.y - (hero.y)) < R + 10) { cn.got = true; got++; }
      }
      obs = obs.filter(o => o.x > -80); coins = coins.filter(cn => cn.x > -30 && !cn.got);
    }

    /* ---------- Zeichnen ---------- */
    function crystal(ox, h2, n, P) {
      for (let k = 0; k < n; k++) {
        const bx = ox + k * 22, hh = h2 * (k % 2 ? .82 : 1);
        const g = x.createLinearGradient(bx, GROUND - hh, bx + 22, GROUND); g.addColorStop(0, "#c9b6ff"); g.addColorStop(1, "#6d4fd6");
        x.fillStyle = g; x.beginPath(); x.moveTo(bx + 2, GROUND); x.lineTo(bx + 6, GROUND - hh * .7); x.lineTo(bx + 11, GROUND - hh); x.lineTo(bx + 17, GROUND - hh * .62); x.lineTo(bx + 20, GROUND); x.closePath(); x.fill();
        x.strokeStyle = "rgba(255,255,255,.45)"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(bx + 11, GROUND - hh); x.lineTo(bx + 10, GROUND - 4); x.stroke();
      }
    }
    function satellite(o, P) {
      x.save(); x.translate(o.x + o.w / 2, o.y + o.h / 2); x.rotate(Math.sin(t * 2 + o.spin) * .12);
      x.fillStyle = "#2a6fb0"; x.fillRect(-23, -6, 14, 12); x.fillRect(9, -6, 14, 12);
      x.strokeStyle = "rgba(160,220,255,.6)"; x.lineWidth = 1; for (const sx of [-19, -14, 13, 18]) { x.beginPath(); x.moveTo(sx, -6); x.lineTo(sx, 6); x.stroke(); }
      x.fillStyle = "#c8d0e0"; rr(x, -9, -9, 18, 18, 5); x.fill();
      x.fillStyle = P.red; x.beginPath(); x.arc(0, 0, 3 + Math.sin(t * 9) * .8, 0, 6.283); x.fill();
      x.restore();
    }
    function heroDraw(P) {
      const squash = ducking && hero.on ? .55 : hero.on ? 1 : 1.08, cx = 96, by = hero.y + R;
      const rx = R * (ducking && hero.on ? 1.25 : 1), ry = R * squash;
      // Füße
      const run = hero.on && state === "run" ? Math.sin(t * 22) * 4 : 0;
      x.fillStyle = "#b8862f";
      x.beginPath(); x.ellipse(cx - 7 + run, by - 2, 6, 3.5, 0, 0, 6.283); x.fill();
      x.beginPath(); x.ellipse(cx + 7 - run, by - 2, 6, 3.5, 0, 0, 6.283); x.fill();
      // Körper
      const g = x.createRadialGradient(cx - 6, by - ry - 8, 3, cx, by - ry, rx + 4); g.addColorStop(0, "#fff3c4"); g.addColorStop(.45, "#e2b552"); g.addColorStop(1, "#a8782a");
      x.fillStyle = g; x.beginPath(); x.ellipse(cx, by - ry - 3, rx, ry, 0, 0, 6.283); x.fill();
      // Visier
      x.fillStyle = "#0b2f3a"; rr(x, cx - 2, by - ry - 11, rx * .95, 10, 5); x.fill();
      x.fillStyle = "#2fe0cf"; x.beginPath(); x.arc(cx + rx * .55, by - ry - 6, 2.6, 0, 6.283); x.fill();
      // Antenne mit Leuchtpunkt
      x.strokeStyle = "#b8862f"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 4, by - ry * 2 - 1); x.lineTo(cx - 8, by - ry * 2 - 10); x.stroke();
      x.fillStyle = P.ink; x.beginPath(); x.arc(cx - 8, by - ry * 2 - 11, 3, 0, 6.283); x.fill();
      if (!hero.on && jumps === 2) { x.strokeStyle = "rgba(47,224,207,.5)"; x.lineWidth = 2; x.beginPath(); x.arc(cx, by - ry, rx + 8, .3, 2.8); x.stroke(); }
    }
    function draw() {
      const P = pal();
      x.save();
      if (shake > 0) x.translate((Math.random() - .5) * 8, (Math.random() - .5) * 6);
      const sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#050a18"); sky.addColorStop(1, "#14213d");
      x.fillStyle = sky; x.fillRect(-10, -10, W + 20, H + 20);
      for (const s of stars) { x.globalAlpha = .3 + s.z * .5; x.fillStyle = P.fg; x.fillRect(s.x, s.y, s.z * 2, s.z * 2); }
      x.globalAlpha = 1;
      // Mond und Hügel
      x.fillStyle = "rgba(226,181,82,.18)"; x.beginPath(); x.arc(640, 64, 30, 0, 6.283); x.fill();
      x.fillStyle = "#0e1a32"; x.beginPath(); x.moveTo(0, GROUND);
      for (let i = 0; i <= W; i += 20) x.lineTo(i, GROUND - 40 - Math.sin((i + dist * .15) * .012) * 22);
      x.lineTo(W, GROUND); x.fill();
      // Boden
      x.fillStyle = "#1b2846"; x.fillRect(0, GROUND, W, H - GROUND);
      x.strokeStyle = P.marker; x.lineWidth = 2; x.beginPath(); x.moveTo(0, GROUND + 1); x.lineTo(W, GROUND + 1); x.stroke();
      x.fillStyle = "rgba(226,181,82,.25)";
      for (let i = 0; i < 26; i++) { const gx = ((i * 61 - dist) % (W + 40) + W + 40) % (W + 40) - 20; x.fillRect(gx, GROUND + 10 + (i % 3) * 12, 10 + (i % 4) * 4, 2); }
      // Sterne zum Sammeln
      for (const cn of coins) {
        x.fillStyle = P.marker; x.save(); x.translate(cn.x, cn.y); x.rotate(t * 2);
        x.beginPath(); for (let k = 0; k < 10; k++) { const rad = k % 2 ? 4.5 : 10, a = k * Math.PI / 5 - Math.PI / 2; x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } x.closePath(); x.fill(); x.restore();
      }
      for (const o of obs) o.kind === "sat" ? satellite(o, P) : crystal(o.x, o.h, o.n, P);
      heroDraw(P);
      // Anzeige
      x.font = "600 13px 'IBM Plex Mono', monospace"; x.textAlign = "right"; x.textBaseline = "top"; x.fillStyle = P.fg;
      x.fillText(`${String(score()).padStart(5, "0")}`, W - 16, 14);
      x.fillStyle = P.muted; x.fillText(`${Math.floor(dist / 10)} m · ★ ${got}`, W - 16, 32);
      x.textAlign = "left";
      x.restore();
    }
    function frame(now) {
      const dt = last ? Math.min(.033, (now - last) / 1000) : 0; last = now; t += dt;
      step(dt); draw(); raf = requestAnimationFrame(frame);
    }

    ui.onKey(e => {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); if (!e.repeat) jump(); }
      else if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); ducking = true; }
    });
    ui.onKeyUp(e => { if (e.key === "ArrowDown" || e.key === "s") ducking = false; });
    let sy = null;
    c.cv.addEventListener("pointerdown", e => { if (!c.ov.hidden) return; sy = e.clientY; });
    c.cv.addEventListener("pointermove", e => { if (sy != null && e.clientY - sy > 30) ducking = true; });
    c.cv.addEventListener("pointerup", () => { if (sy == null) return; if (!ducking) jump(); ducking = false; sy = null; });
    c.cv.addEventListener("pointercancel", () => { ducking = false; sy = null; });

    ui.onRestart(() => { reset(); start(); });
    reset(); state = "ready";
    c.show("Hüpfer", "Spring über Kristalle, duck dich unter Satelliten, sammle Sterne. Je weiter, desto schneller.", "Los geht’s", start);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  WNG.games.huepfer = mountHuepfer;
})();
