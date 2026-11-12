// WebNoah-Games: Reichenspiel. Ein eigenes Wirtschafts-Brettspiel: Firmen gründen, ausbauen, Marktnachrichten überstehen.
// Wird von assets/js/shell.js gestartet.
// Regeln: 28 Felder, Start bei der Kassa (+200 beim Vorbeiziehen). Freie Firma: kaufen oder liegen lassen.
// Fremde Firma: Umsatzbeteiligung zahlen, doppelt wenn die ganze Branche einer Person gehört, mehr mit Ausbau.
// Ausbauen geht nur mit kompletter Branche. Wer pleite ist, scheidet aus. Nach 20 Runden gewinnt das größte Vermögen.
(() => {
  "use strict";
  const { makeCanvas, pal, segmented, rnd, h } = WNG;

  const BR = [
    { name: "Imbiss", hue: 28, price: 60 }, { name: "Medien", hue: 200, price: 100 }, { name: "Sport", hue: 150, price: 140 },
    { name: "Genuss", hue: 340, price: 180 }, { name: "Technik", hue: 265, price: 220 }, { name: "Zukunft", hue: 45, price: 260 },
    { name: "Tourismus", hue: 185, price: 320 }
  ];
  const F = (name, g, step = 0) => ({ type: "firm", name, g, price: BR[g].price + step * 20 });
  const BOARD = [
    { type: "start", name: "Kassa" }, F("Würstelstand", 0), F("Eissalon", 0, 1), F("Kaffeehaus", 0, 2), { type: "event", name: "Marktnachricht" },
    F("Kopiershop", 1), F("Buchhandlung", 1, 1), { type: "rest", name: "Urlaub am Stausee" }, F("Druckerei", 1, 2), F("Radwerkstatt", 2),
    F("Skiverleih", 2, 1), { type: "event", name: "Marktnachricht" }, F("Sportgeschäft", 2, 2), F("Bäckerei", 3),
    { type: "tax", name: "Finanzamt" }, F("Konditorei", 3, 1), F("Wirtshaus", 3, 2), F("Handyladen", 4), { type: "event", name: "Marktnachricht" },
    F("Spielestudio", 4, 1), F("Webagentur", 4, 2), { type: "pot", name: "Glückstopf" }, F("Solarfirma", 5), F("E-Bike-Bau", 5, 1),
    F("Raumfahrt-Start-up", 5, 2), { type: "event", name: "Marktnachricht" }, F("Reisebüro", 6), F("Hotel am Hauptplatz", 6, 1)
  ];
  const N = BOARD.length, START_CASH = 1500, PASS = 200, MAX_ROUNDS = 20, MAX_LVL = 3;
  const RENT_MULT = [1, 4, 9, 15];
  const EVENTS = [
    ["Förderung vom Land für deine Idee.", 150], ["Kundschaft liebt dein neues Logo.", 100], ["Messepreis für das beste Start-up.", 120],
    ["Crowdfunding geglückt!", 200], ["Steuerberater schickt die Rechnung.", -80], ["Stromausfall im Büro.", -60],
    ["Laptop ist in die Thaya gefallen.", -100], ["Lieferwagen muss in die Werkstatt.", -70], ["Spontanes Firmenfest.", -50],
    ["Rückenwind! Drei Felder vor.", "move3"], ["Umweg über Zwettl. Zwei Felder zurück.", "back2"],
    ["Jubiläum! Alle anderen zahlen dir je 30.", "collect30"], ["Spendenaktion: Du zahlst allen anderen je 20.", "give20"],
    ["Brandschutz-Kontrolle: 25 pro Ausbaustufe.", "inspect"]
  ];
  const COLORS = ["#38bdf8", "#ff6b5e", "#4ade80", "#e2b552"];
  const NAMES = ["Blau", "Rot", "Grün", "Gold"];
  const money = v => `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("de-AT")} T`;

  function mountReich(stage, ui) {
    const W = 640, H = 640, CELL = 80;
    const c = makeCanvas(stage, W, H), x = c.ctx;
    let count = 3, mode = "cpu";
    const opts = h("div", "race-setup"); ui.tools.append(opts);
    segmented(opts, [["2", "2 Spieler"], ["3", "3 Spieler"], ["4", "4 Spieler"]], "3", v => { count = +v; reset(); });
    segmented(opts, [["cpu", "Gegen Computer"], ["local", "Alle am Gerät"]], mode, v => { mode = v; reset(); });

    const panel = h("div", "rs-panel");
    panel.innerHTML = `<div class="rs-actions" id="rs-actions"></div><div class="rs-players" id="rs-players"></div><ol class="rs-log" id="rs-log"></ol>`;
    stage.append(panel);
    const actionsEl = panel.querySelector("#rs-actions"), playersEl = panel.querySelector("#rs-players"), logEl = panel.querySelector("#rs-log");

    let pl, own, lvl, turn, round, phase, dice, rolling = 0, cpuT, raf, last = 0, t = 0, hopping = null, logLines;
    const isBot = i => mode === "cpu" && i > 0;
    const alive = () => pl.filter(p => !p.out);
    const firmsOf = i => BOARD.map((f, k) => k).filter(k => own[k] === i);
    const groupOwned = (g, i) => BOARD.every((f, k) => f.type !== "firm" || f.g !== g || own[k] === i);
    const rentOf = k => {
      const f = BOARD[k], base = Math.round(f.price * .14);
      return lvl[k] ? base * RENT_MULT[lvl[k]] : base * (groupOwned(f.g, own[k]) ? 2 : 1);
    };
    const upCost = k => Math.round(BOARD[k].price * .6);
    const worth = i => pl[i].cash + firmsOf(i).reduce((a, k) => a + BOARD[k].price + lvl[k] * upCost(k), 0);

    function reset() {
      clearTimeout(cpuT);
      pl = Array.from({ length: count }, (_, i) => ({ pos: 0, cash: START_CASH, out: false }));
      own = Array(N).fill(-1); lvl = Array(N).fill(0);
      turn = 0; round = 1; phase = "roll"; dice = [0, 0]; logLines = []; hopping = null;
      ui.score(ui.get() || 0); c.hide();
      log(`Neues Spiel mit ${count} Personen. Jede startet mit ${money(START_CASH)}.`);
      refresh(); next();
    }
    const nameOf = i => mode === "cpu" ? (i === 0 ? "Du" : `${NAMES[i]} (Computer)`) : NAMES[i];
    function log(text) { logLines.unshift(text); logLines = logLines.slice(0, 7); logEl.innerHTML = logLines.map(l => `<li>${l}</li>`).join(""); }

    /* ---------- Ablauf ---------- */
    function roll() {
      if (phase !== "roll" || rolling) return;
      phase = "rolling"; rolling = .55; refresh();
      cpuT = setTimeout(() => {
        rolling = 0; dice = [1 + rnd(6), 1 + rnd(6)];
        moveBy(dice[0] + dice[1], () => land());
      }, 550);
    }
    function moveBy(n, done) {
      const p = pl[turn];
      let steps = Math.abs(n), dir = Math.sign(n);
      const hop = () => {
        if (!steps) { hopping = null; return done(); }
        const before = p.pos;
        p.pos = (p.pos + dir + N) % N; steps--;
        if (dir > 0 && p.pos === 0 && before === N - 1) { p.cash += PASS; log(`${nameOf(turn)} ${turn === 0 && mode === "cpu" ? "kommst" : "kommt"} an der Kassa vorbei: +${money(PASS)}.`); }
        hopping = { i: turn, t: 0 };
        refresh();
        cpuT = setTimeout(hop, 120);
      };
      hop();
    }
    function land() {
      const i = turn, p = pl[i], k = p.pos, f = BOARD[k];
      phase = "act";
      let botDone = false;
      if (f.type === "firm") {
        if (own[k] < 0) {
          if (isBot(i)) { botDone = true; cpuT = setTimeout(() => { if (p.cash - f.price >= 220) buy(); else log(`${nameOf(i)} lässt ${f.name} liegen.`); botUpgrade(); endTurn(); }, 500); }
          else phase = "buy";
        } else if (own[k] !== i && !pl[own[k]].out) {
          const r = rentOf(k);
          pay(i, r, own[k]);
          log(`${nameOf(i)} ${i === 0 && mode === "cpu" ? "zahlst" : "zahlt"} ${money(r)} an ${nameOf(own[k])} für ${f.name}.`);
        }
      } else if (f.type === "event") {
        const [text, eff] = EVENTS[rnd(EVENTS.length)];
        log(`Marktnachricht: ${text}`);
        if (typeof eff === "number") { if (eff >= 0) p.cash += eff; else pay(i, -eff, -1); }
        else if (eff === "move3") { refresh(); return moveBy(3, land); }
        else if (eff === "back2") { refresh(); return moveBy(-2, land); }
        else if (eff === "collect30") alive().forEach((q, j) => { const qi = pl.indexOf(q); if (qi !== i) { pay(qi, 30, i); } });
        else if (eff === "give20") alive().forEach(q => { const qi = pl.indexOf(q); if (qi !== i) pay(i, 20, qi); });
        else if (eff === "inspect") { const n = firmsOf(i).reduce((a, kk) => a + lvl[kk], 0); if (n) pay(i, n * 25, -1); }
      } else if (f.type === "tax") {
        const tax = Math.max(50, Math.round(p.cash * .1));
        pay(i, tax, -1); log(`Finanzamt: ${nameOf(i)} ${i === 0 && mode === "cpu" ? "zahlst" : "zahlt"} ${money(tax)}.`);
      } else if (f.type === "pot") {
        const win = 50 + rnd(5) * 50; p.cash += win; log(`Glückstopf: ${nameOf(i)} ${i === 0 && mode === "cpu" ? "ziehst" : "zieht"} ${money(win)}!`);
      } else if (f.type === "rest") log(`${nameOf(i)} ${i === 0 && mode === "cpu" ? "machst" : "macht"} Urlaub am Stausee.`);
      // Genau ein Weg beendet den Zug: pleite, Computer (falls noch nicht geplant) oder der Mensch per Knopf
      if (p.out) { clearTimeout(cpuT); phase = "act"; cpuT = setTimeout(endTurn, 600); }
      else if (isBot(i) && !botDone) cpuT = setTimeout(() => { botUpgrade(); endTurn(); }, 600);
      refresh();
    }
    function buy() {
      const i = turn, k = pl[i].pos, f = BOARD[k];
      if (own[k] >= 0 || pl[i].cash < f.price) return;
      pl[i].cash -= f.price; own[k] = i;
      log(`${nameOf(i)} ${i === 0 && mode === "cpu" ? "gründest" : "gründet"} ${f.name} für ${money(f.price)}.${groupOwned(f.g, i) ? ` Die Branche ${BR[f.g].name} ist komplett!` : ""}`);
      if (phase === "buy") phase = "act";
      refresh();
    }
    function upgradable(i) { return firmsOf(i).filter(k => groupOwned(BOARD[k].g, i) && lvl[k] < MAX_LVL && pl[i].cash >= upCost(k)); }
    function upgrade(k) {
      const i = turn;
      if (!upgradable(i).includes(k)) return;
      pl[i].cash -= upCost(k); lvl[k]++;
      log(`${nameOf(i)} ${i === 0 && mode === "cpu" ? "baust" : "baut"} ${BOARD[k].name} auf Stufe ${lvl[k]} aus.`);
      refresh();
    }
    function botUpgrade() {
      for (let guard = 0; guard < 6; guard++) {
        const ups = upgradable(turn).filter(k => pl[turn].cash - upCost(k) >= 300).sort((a, b) => lvl[a] - lvl[b] || upCost(a) - upCost(b));
        if (!ups.length) return; upgrade(ups[0]);
      }
    }
    // Zahlen, notfalls mit Notverkauf. to = -1 heißt an die Bank.
    function pay(i, amount, to) {
      const p = pl[i];
      p.cash -= amount;
      if (to >= 0) pl[to].cash += amount;
      if (p.cash >= 0) return;
      // Notverkauf: erst Ausbau zurückgeben, dann Firmen, jeweils zum halben Preis
      const mine = () => firmsOf(i).sort((a, b) => BOARD[a].price - BOARD[b].price);
      for (const k of mine()) while (lvl[k] && p.cash < 0) { lvl[k]--; p.cash += Math.round(upCost(k) / 2); }
      for (const k of mine()) { if (p.cash >= 0) break; own[k] = -1; p.cash += Math.round(BOARD[k].price / 2); log(`${nameOf(i)} ${i === 0 && mode === "cpu" ? "musst" : "muss"} ${BOARD[k].name} verkaufen.`); }
      if (p.cash < 0) {
        p.out = true; firmsOf(i).forEach(k => { own[k] = -1; lvl[k] = 0; });
        log(`${nameOf(i)} ${i === 0 && mode === "cpu" ? "bist" : "ist"} pleite und scheidet aus.`);
      }
    }
    function endTurn() {
      if (phase === "over") return;
      if (alive().length <= 1) return finish();
      let n = turn;
      do { n = (n + 1) % pl.length; if (n === 0) round++; } while (pl[n].out);
      if (round > MAX_ROUNDS) return finish();
      turn = n; phase = "roll"; dice = dice; refresh(); next();
    }
    function next() { if (phase === "roll" && isBot(turn)) cpuT = setTimeout(roll, 700); }
    function finish() {
      phase = "over"; clearTimeout(cpuT);
      const ranking = pl.map((p, i) => ({ i, w: p.out ? -1 : worth(i) })).sort((a, b) => b.w - a.w);
      const win = ranking[0].i, youWin = mode === "cpu" && win === 0;
      if (youWin) { ui.set((ui.get() || 0) + 1); ui.score(ui.get()); }
      refresh();
      c.show(youWin ? "Du bist am reichsten!" : `${nameOf(win)} gewinnt`, ranking.map((r, n) => `${n + 1}. ${nameOf(r.i)}: ${r.w < 0 ? "pleite" : money(r.w)}`).join(" · "),
        "Neues Spiel", reset, youWin ? "Sieg!" : "");
      ui.status(`Spiel vorbei nach ${Math.min(round, MAX_ROUNDS)} Runden.`);
    }

    /* ---------- Bedienfeld ---------- */
    function refresh() {
      const i = turn, me = !isBot(i) && phase !== "over";
      const p = pl[i], f = BOARD[p.pos];
      let html = "";
      if (phase === "over") html = `<p class="rs-hint">Spiel vorbei.</p>`;
      else if (!me) html = `<p class="rs-hint">${nameOf(i)} ist dran …</p>`;
      else if (phase === "roll") html = `<button class="btn primary" type="button" data-a="roll">Würfeln (Leertaste)</button>`;
      else if (phase === "rolling") html = `<p class="rs-hint">Würfelt …</p>`;
      else if (phase === "buy") html = `<p class="rs-hint"><b>${f.name}</b> (${BR[f.g].name}) ist frei: ${money(f.price)}, bringt ${money(Math.round(f.price * .14))} pro Besuch.</p>
        <button class="btn primary" type="button" data-a="buy" ${p.cash < f.price ? "disabled" : ""}>Gründen für ${money(f.price)}</button>
        <button class="btn" type="button" data-a="skip">Liegen lassen</button>`;
      else if (phase === "act") {
        const ups = upgradable(i);
        html = (ups.length ? `<p class="rs-hint">Ausbauen (Branche komplett):</p><div class="rs-ups">${ups.map(k => `<button class="btn small-btn" type="button" data-up="${k}">${BOARD[k].name} → Stufe ${lvl[k] + 1} · ${money(upCost(k))}</button>`).join("")}</div>` : "")
          + `<button class="btn primary" type="button" data-a="end">Zug beenden (Leertaste)</button>`;
      }
      actionsEl.innerHTML = html;
      playersEl.innerHTML = pl.map((q, j) => `<div class="rs-p ${j === turn && phase !== "over" ? "now" : ""} ${q.out ? "out" : ""}" style="--pc:${COLORS[j]}">
          <b>${nameOf(j)}</b><span class="cash">${q.out ? "pleite" : money(q.cash)}</span>
          <small>${firmsOf(j).length} Firmen · Vermögen ${q.out ? "–" : money(worth(j))}</small></div>`).join("");
      ui.status(phase === "over" ? "" : `Runde ${Math.min(round, MAX_ROUNDS)} von ${MAX_ROUNDS} · ${nameOf(i)} ${i === 0 && mode === "cpu" ? "bist" : "ist"} dran.`);
    }
    actionsEl.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.up) return upgrade(+b.dataset.up);
      const a = b.dataset.a;
      if (a === "roll") roll();
      else if (a === "buy") { buy(); }
      else if (a === "skip") { log(`${nameOf(turn)} ${turn === 0 && mode === "cpu" ? "lässt" : "lässt"} ${BOARD[pl[turn].pos].name} liegen.`); phase = "act"; refresh(); }
      else if (a === "end") endTurn();
    });
    ui.onKey(e => {
      if (e.key !== " " && e.key !== "Enter") return;
      if (isBot(turn) || phase === "over") return;
      e.preventDefault();
      if (phase === "roll") roll(); else if (phase === "act") endTurn();
    });

    /* ---------- Brett ---------- */
    const cellXY = k => k <= 7 ? [7 - k, 7] : k <= 14 ? [0, 7 - (k - 7)] : k <= 21 ? [k - 14, 0] : [7, k - 21];
    function draw() {
      const P = pal();
      x.fillStyle = P.paper; x.fillRect(0, 0, W, H);
      // Mitte
      const g = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 300); g.addColorStop(0, "#1a2747"); g.addColorStop(1, "#0b1224");
      x.fillStyle = g; x.fillRect(CELL, CELL, W - 2 * CELL, H - 2 * CELL);
      x.textAlign = "center"; x.textBaseline = "middle";
      x.font = "800 34px Cinzel, Georgia, serif"; x.fillStyle = P.marker; x.fillText("Reichenspiel", W / 2, H / 2 - 92);
      x.font = "600 12px 'IBM Plex Mono', monospace"; x.fillStyle = P.muted;
      x.fillText(phase === "over" ? "SPIEL VORBEI" : `RUNDE ${Math.min(round, MAX_ROUNDS)} / ${MAX_ROUNDS}`, W / 2, H / 2 - 60);
      // Würfel
      const shown = rolling > 0 ? [1 + Math.floor(t * 21) % 6, 1 + Math.floor(t * 17 + 3) % 6] : dice;
      drawDie(W / 2 - 42, H / 2 + 6, 58, shown[0]); drawDie(W / 2 + 42, H / 2 + 6, 58, shown[1]);
      x.font = "600 12px Inter, sans-serif"; x.fillStyle = P.fg;
      x.fillText(phase === "over" ? "" : `${nameOf(turn)} ${turn === 0 && mode === "cpu" ? "bist" : "ist"} dran`, W / 2, H / 2 + 62);
      // Felder
      for (let k = 0; k < N; k++) {
        const [cx, cy] = cellXY(k), px = cx * CELL, py = cy * CELL, f = BOARD[k];
        x.fillStyle = "#121c33"; x.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        if (f.type === "firm") {
          x.fillStyle = `hsl(${BR[f.g].hue} 55% 48%)`; x.fillRect(px + 1, py + 1, CELL - 2, 12);
          if (own[k] >= 0) { x.strokeStyle = COLORS[own[k]]; x.lineWidth = 3; x.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6); }
          for (let s = 0; s < lvl[k]; s++) { x.fillStyle = P.marker; x.beginPath(); x.arc(px + 12 + s * 11, py + 20, 3.5, 0, 6.283); x.fill(); }
        }
        x.fillStyle = f.type === "firm" ? P.fg : P.marker;
        x.font = `${f.type === "firm" ? 600 : 700} ${f.type === "firm" ? 10 : 11}px Inter, sans-serif`;
        wrap(f.name, px + CELL / 2, py + CELL / 2 + 2, CELL - 10, 12);
        if (f.type === "firm") { x.font = "600 10px 'IBM Plex Mono', monospace"; x.fillStyle = P.muted; x.fillText(own[k] >= 0 ? `↻${rentOf(k)}` : `${f.price}`, px + CELL / 2, py + CELL - 10); }
        else { const icon = { start: "◆", event: "✉", tax: "§", pot: "★", rest: "☼" }[f.type]; x.font = "16px 'Segoe UI Symbol', sans-serif"; x.fillStyle = P.marker; x.fillText(icon, px + CELL / 2, py + 18); }
      }
      x.strokeStyle = "rgba(226,181,82,.5)"; x.lineWidth = 1.5; x.strokeRect(1, 1, W - 2, H - 2); x.strokeRect(CELL, CELL, W - 2 * CELL, H - 2 * CELL);
      // Spielfiguren
      pl.forEach((p, i) => {
        if (p.out) return;
        const [cx, cy] = cellXY(p.pos), ox = (i % 2) * 22 - 11, oy = (i < 2 ? -1 : 1) * 12;
        const lift = hopping && hopping.i === i ? 6 : 0;
        const tx = cx * CELL + CELL / 2 + ox, ty = cy * CELL + CELL / 2 + oy + 8 - lift;
        x.fillStyle = "rgba(0,0,0,.5)"; x.beginPath(); x.arc(tx + 1.5, ty + 3 + lift, 9, 0, 6.283); x.fill();
        x.fillStyle = COLORS[i]; x.beginPath(); x.arc(tx, ty, 9, 0, 6.283); x.fill();
        x.strokeStyle = i === turn ? "#fff" : "rgba(0,0,0,.4)"; x.lineWidth = 2; x.stroke();
      });
      x.textAlign = "left";
    }
    function wrap(text, cx, cy, maxW, lh) {
      const words = text.split(/(?<=-)|\s/); const lines = []; let line = "";
      for (const w of words) { const test = line ? (line.endsWith("-") ? line + w : line + " " + w) : w; if (x.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
      lines.push(line);
      lines.forEach((l, n) => x.fillText(l, cx, cy + (n - (lines.length - 1) / 2) * lh));
    }
    function drawDie(cx, cy, s, n) {
      x.save(); x.translate(cx, cy); x.rotate(rolling > 0 ? Math.sin(t * 30 + cx) * .3 : 0);
      x.fillStyle = "#f4f1e8"; x.beginPath(); x.roundRect ? x.roundRect(-s / 2, -s / 2, s, s, 10) : x.rect(-s / 2, -s / 2, s, s); x.fill();
      if (n) {
        const d = s * .26, pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
        x.fillStyle = "#121833"; for (const [a, b] of pips) { x.beginPath(); x.arc(a * d, b * d, s * .075, 0, 6.283); x.fill(); }
      }
      x.restore();
    }
    function frame(now) {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; t += dt;
      if (rolling > 0) rolling = Math.max(.01, rolling - dt);
      draw(); raf = requestAnimationFrame(frame);
    }

    ui.onRestart(reset);
    reset();
    c.show("Reichenspiel", "Würfle ums Brett, gründe Firmen, bau ganze Branchen aus und kassier mit. Nach 20 Runden gewinnt das größte Vermögen.", "Los geht’s", () => c.hide());
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(cpuT); };
  }

  WNG.games.reich = mountReich;
})();
