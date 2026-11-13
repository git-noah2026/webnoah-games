// WebNoah-Games: schlange. Wird von assets/js/shell.js gestartet.
(() => {
  "use strict";
  const { $, h, rnd, clamp, shuffle, store, pal, rr, karo, makeCanvas, segmented, MONO, BODY, SUB } = WNG;

    function mountSchlange(stage, ui) {
    const N = 20, S = 20, W = N * S;
    const c = makeCanvas(stage, W, W);
    let snake, dir, queue, food, score, state = "ready", timer = null, speed;
    const place = () => { do { food = { x: rnd(N), y: rnd(N) }; } while (snake.some(p => p.x === food.x && p.y === food.y)); };
    function reset() {
      snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
      dir = { x: 1, y: 0 }; queue = []; score = 0; speed = 140;
      place(); ui.score(0); draw();
    }
    function start() {
      if (state === "run") return;
      if (state === "over") reset();
      state = "run"; c.hide(); ui.status("Leertaste pausiert.");
      clearTimeout(timer); timer = setTimeout(tick, speed);
    }
    function pause() { if (state !== "run") return; state = "pause"; clearTimeout(timer); c.show("Pause", "", "Weiter", start); }
    function tick() { step(); if (state === "run") timer = setTimeout(tick, speed); }
    function step() {
      const nd = queue.shift(); if (nd) dir = nd;
      const hd = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      const eat = hd.x === food.x && hd.y === food.y;
      const body = eat ? snake : snake.slice(0, -1);
      if (hd.x < 0 || hd.y < 0 || hd.x >= N || hd.y >= N || body.some(p => p.x === hd.x && p.y === hd.y)) return over();
      snake.unshift(hd);
      if (eat) {
        score++; ui.score(score); speed = Math.max(70, speed - 3);
        if (snake.length === N * N) return over();
        place();
      } else snake.pop();
      draw();
    }
    function over() {
      state = "over"; clearTimeout(timer); draw();
      const rec = ui.submit(score) && score > 0;
      ui.status("");
      c.show("Spiel vorbei", `${score} ${score === 1 ? "Punkt" : "Punkte"}`, "Nochmal", start, rec ? "Neuer Rekord!" : "");
    }
    function turn(d) {
      if (state !== "run") start();
      const last = queue.length ? queue[queue.length - 1] : dir;
      if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return;
      if (queue.length < 3) queue.push(d);
    }
    function draw() {
      const p = pal(), x = c.ctx;
      karo(x, W, W, S, p);
      x.fillStyle = p.red; x.beginPath(); x.arc(food.x * S + S / 2, food.y * S + S / 2, S * .34, 0, Math.PI * 2); x.fill();
      for (let i = snake.length - 1; i >= 0; i--) {
        const s = snake[i];
        x.fillStyle = i === 0 ? p.fg : p.ink;
        rr(x, s.x * S + 1.5, s.y * S + 1.5, S - 3, S - 3, i === 0 ? 6 : 3); x.fill();
      }
    }
    const DIRS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    ui.onKey(e => {
      const k = e.key.toLowerCase();
      if (DIRS[k]) { e.preventDefault(); turn({ x: DIRS[k][0], y: DIRS[k][1] }); }
      else if (k === " ") { e.preventDefault(); state === "run" ? pause() : start(); }
    });
    let sw = null;
    c.cv.addEventListener("pointerdown", e => { sw = { x: e.clientX, y: e.clientY }; });
    c.cv.addEventListener("pointerup", e => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { if (state !== "run") start(); return; }
      if (Math.abs(dx) > Math.abs(dy)) turn({ x: Math.sign(dx), y: 0 }); else turn({ x: 0, y: Math.sign(dy) });
    });
    const pad = h("div", "dpad");
    [["up", "↑", 0, -1, "hoch"], ["left", "←", -1, 0, "links"], ["down", "↓", 0, 1, "runter"], ["right", "→", 1, 0, "rechts"]].forEach(([n, l, dx, dy, a]) => {
      const b = h("button", "", l); b.type = "button"; b.dataset.d = n; b.setAttribute("aria-label", a);
      b.addEventListener("pointerdown", e => { e.preventDefault(); turn({ x: dx, y: dy }); });
      pad.append(b);
    });
    stage.append(pad);
    function fresh() {
      clearTimeout(timer); state = "ready"; reset();
      c.show("Schlange", "Sammle die roten Punkte. Wand und eigener Schwanz beenden das Spiel.", "Los geht’s", start);
      ui.status("");
    }
    ui.onRestart(fresh); fresh();
    return () => clearTimeout(timer);
  }

  WNG.games.schlange = mountSchlange;
})();
