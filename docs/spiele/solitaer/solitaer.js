// WebNoah-Games: Solitär (Klondike, eine Karte ziehen). Wird von assets/js/shell.js gestartet.
(() => {
  "use strict";
  const { h, shuffle } = WNG;

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"];
  const red = c => c.s === 1 || c.s === 2;

  function mountSolitaer(stage, ui) {
    const root = h("div", "sol");
    root.innerHTML = `
      <div class="sol-top">
        <div class="pile stock" data-p="stock" aria-label="Stapel ziehen"></div>
        <div class="pile waste" data-p="waste"></div>
        <div class="sol-gap"></div>
        ${[0, 1, 2, 3].map(i => `<div class="pile found" data-p="f${i}" data-suit="${SUITS[i]}"></div>`).join("")}
      </div>
      <div class="sol-tab">${[0, 1, 2, 3, 4, 5, 6].map(i => `<div class="pile tab" data-p="t${i}"></div>`).join("")}</div>`;
    stage.append(root);

    const undoBtn = h("button", "btn", "↶ Rückgängig"); undoBtn.type = "button";
    const autoBtn = h("button", "btn", "Alles ablegen"); autoBtn.type = "button"; autoBtn.hidden = true;
    ui.tools.append(undoBtn, autoBtn);

    let S, hist, moves, t0, timer, won, finishing, finishTimer;
    const secs = () => t0 ? Math.max(1, Math.round((Date.now() - t0) / 1000)) : 0;
    const pileOf = id => id === "stock" ? S.stock : id === "waste" ? S.waste : id[0] === "f" ? S.found[+id[1]] : S.tab[+id[1]];
    const pileEl = id => root.querySelector(`[data-p="${id}"]`);

    function deal() {
      clearInterval(timer); clearInterval(finishTimer);
      const deck = shuffle([0, 1, 2, 3].flatMap(s => Array.from({ length: 13 }, (_, i) => ({ s, r: i + 1, up: false }))));
      const tab = [];
      for (let i = 0; i < 7; i++) { tab.push(deck.splice(0, i + 1)); tab[i][i].up = true; }
      S = { stock: deck, waste: [], found: [[], [], [], []], tab };
      hist = []; moves = 0; t0 = null; won = false; finishing = false;
      ui.score(0);
      ui.status("Tippe eine Karte an, um sie automatisch abzulegen, oder zieh sie dorthin, wo sie hin soll.");
      render();
    }
    function clock() { if (!t0) { t0 = Date.now(); timer = setInterval(() => ui.score(secs()), 500); } }
    const snap = () => { hist.push(JSON.stringify(S)); if (hist.length > 300) hist.shift(); };
    function undo() {
      if (!hist.length || won || finishing) return;
      S = JSON.parse(hist.pop()); moves++; render(); say();
    }
    const say = () => { if (!won) ui.status(`${moves} Züge · ${S.stock.length} Karten im Stapel`); };

    function canTab(card, pile) {
      if (!pile.length) return card.r === 13;
      const t = pile[pile.length - 1];
      return t.up && red(t) !== red(card) && t.r === card.r + 1;
    }
    function canFound(card, f) {
      if (!f.length) return card.r === 1;
      const t = f[f.length - 1];
      return t.s === card.s && t.r + 1 === card.r;
    }
    function legal(fromId, idx, toId) {
      if (fromId === toId || toId === "stock" || toId === "waste") return false;
      const from = pileOf(fromId), cards = from.slice(idx);
      if (!cards.length || !cards[0].up) return false;
      if ((fromId === "waste" || fromId[0] === "f") && cards.length !== 1) return false;
      if (toId[0] === "f") return cards.length === 1 && canFound(cards[0], pileOf(toId));
      return canTab(cards[0], pileOf(toId));
    }
    function move(fromId, idx, toId) {
      if (!legal(fromId, idx, toId)) return false;
      snap();
      const from = pileOf(fromId), cards = from.splice(idx);
      pileOf(toId).push(...cards);
      if (fromId[0] === "t" && from.length && !from[from.length - 1].up) from[from.length - 1].up = true;
      moves++; clock(); render(); say(); check();
      return true;
    }
    function draw() {
      if (won || finishing) return;
      clock(); snap();
      if (S.stock.length) { const c = S.stock.pop(); c.up = true; S.waste.push(c); }
      else if (S.waste.length) { S.stock = S.waste.reverse().map(c => ({ ...c, up: false })); S.waste = []; }
      else { hist.pop(); return; }
      moves++; render(); say();
    }
    function target(fromId, idx) {
      const from = pileOf(fromId), card = from[idx];
      if (idx === from.length - 1) for (let f = 0; f < 4; f++) if (legal(fromId, idx, "f" + f)) return "f" + f;
      const order = [0, 1, 2, 3, 4, 5, 6].filter(t => "t" + t !== fromId).sort((a, b) => (S.tab[a].length ? 0 : 1) - (S.tab[b].length ? 0 : 1));
      for (const t of order) {
        // König nicht sinnlos von einem leeren Platz auf den nächsten schieben
        if (!S.tab[t].length && card.r === 13 && fromId[0] === "t" && idx === 0) continue;
        if (legal(fromId, idx, "t" + t)) return "t" + t;
      }
      return null;
    }
    function check() {
      if (S.found.every(f => f.length === 13)) return win();
      const allUp = !S.stock.length && !S.waste.length && S.tab.every(p => p.every(c => c.up));
      autoBtn.hidden = !allUp;
    }
    function autoFinish() {
      if (finishing || won) return;
      finishing = true; autoBtn.hidden = true;
      finishTimer = setInterval(() => {
        for (let t = 0; t < 7; t++) {
          const p = S.tab[t]; if (!p.length) continue;
          for (let f = 0; f < 4; f++) if (canFound(p[p.length - 1], S.found[f])) {
            finishing = false; move("t" + t, p.length - 1, "f" + f); finishing = !won; return;
          }
        }
        clearInterval(finishTimer); finishing = false;
      }, 90);
    }
    function win() {
      won = true; finishing = false; clearInterval(timer); clearInterval(finishTimer); autoBtn.hidden = true;
      const s = secs(); ui.score(s);
      const rec = ui.submit(s);
      ui.status(`Gelöst in ${s} Sekunden und ${moves} Zügen.`, rec ? "Neuer Rekord!" : "");
      root.classList.add("won");
    }

    /* ---------- Darstellung ---------- */
    function cardHtml(c, i, pid) {
      if (!c.up) return `<div class="pcard down" data-p="${pid}" data-i="${i}"></div>`;
      const r = RANKS[c.r], s = SUITS[c.s];
      return `<div class="pcard up${red(c) ? " red" : ""}" data-p="${pid}" data-i="${i}" aria-label="${r} ${s}">
        <span class="ci">${r}<i>${s}</i></span><span class="cs">${s}</span><span class="ci br">${r}<i>${s}</i></span></div>`;
    }
    function render() {
      root.classList.remove("won");
      const cw = pileEl("t0").clientWidth || 80, ch = cw * 1.4;
      root.style.setProperty("--cw", cw + "px");
      // Stapel
      const st = pileEl("stock");
      st.innerHTML = S.stock.length ? `<div class="pcard down" data-p="stock" data-i="0"><b class="count">${S.stock.length}</b></div>` : `<span class="recycle">↻</span>`;
      // Ablage: oberste drei Karten leicht gefächert
      const w = S.waste, wEl = pileEl("waste"), show = w.slice(-3);
      wEl.innerHTML = show.map((c, k) => cardHtml(c, w.length - show.length + k, "waste")).join("");
      wEl.querySelectorAll(".pcard").forEach((el, k) => { el.style.left = `${k * cw * .22}px`; if (k < show.length - 1) el.classList.add("under"); });
      // Ziel
      S.found.forEach((f, i) => { pileEl("f" + i).innerHTML = f.length ? cardHtml(f[f.length - 1], f.length - 1, "f" + i) : ""; });
      // Spalten
      S.tab.forEach((p, t) => {
        const el = pileEl("t" + t);
        let top = 0, html = "";
        const downStep = ch * .11, upStep = ch * (p.length > 14 ? .2 : .27);
        p.forEach((c, i) => { html += cardHtml(c, i, "t" + t).replace("<div ", `<div style="top:${top}px" `); top += c.up ? upStep : downStep; });
        el.innerHTML = html;
        el.style.height = `${(p.length ? top - (p[p.length - 1].up ? upStep : downStep) : 0) + ch}px`;
      });
      undoBtn.disabled = !hist.length || won;
    }

    /* ---------- Ziehen und Tippen ---------- */
    let press = null, drag = null;
    root.addEventListener("pointerdown", e => {
      if (won || finishing || e.button > 0) return;
      const pile = e.target.closest(".pile");
      if (pile && pile.dataset.p === "stock") { e.preventDefault(); draw(); return; }
      const el = e.target.closest(".pcard.up"); if (!el) return;
      const pid = el.dataset.p, idx = +el.dataset.i;
      if (pid === "waste" && idx !== S.waste.length - 1) return;
      e.preventDefault();
      press = { x: e.clientX, y: e.clientY, pid, idx, id: e.pointerId };
      try { root.setPointerCapture(e.pointerId); } catch { /* ohne Capture geht es auch */ }
    });
    root.addEventListener("pointermove", e => {
      if (!press || e.pointerId !== press.id) return;
      const dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (!drag && Math.hypot(dx, dy) < 7) return;
      if (!drag) {
        const els = [...pileEl(press.pid).querySelectorAll(".pcard")].filter(el => +el.dataset.i >= press.idx);
        const layer = h("div", "sol-drag");
        els.forEach(el => {
          const r = el.getBoundingClientRect(), c = el.cloneNode(true);
          c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0`;
          layer.append(c); el.style.visibility = "hidden";
        });
        document.body.append(layer);
        drag = { layer };
      }
      drag.layer.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    function release(e) {
      if (!press || e.pointerId !== press.id) return;
      const p = press; press = null;
      if (drag) {
        drag.layer.style.display = "none";
        const under = document.elementFromPoint(e.clientX, e.clientY);
        drag.layer.remove(); drag = null;
        const pile = under && under.closest(".sol .pile");
        if (!pile || !move(p.pid, p.idx, pile.dataset.p)) render();
        return;
      }
      if (e.type === "pointercancel") return;
      const to = target(p.pid, p.idx);
      if (!to || !move(p.pid, p.idx, to)) {
        const el = pileEl(p.pid).querySelector(`[data-i="${p.idx}"]`);
        if (el) { el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); }
      }
    }
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);

    undoBtn.onclick = undo;
    autoBtn.onclick = autoFinish;
    ui.onKey(e => {
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); draw(); }
      else if (k === "z" || k === "u" || (k === "z" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); undo(); }
    });
    const ro = new ResizeObserver(() => { if (S && !drag) render(); });
    ro.observe(root);
    ui.onRestart(deal);
    deal();
    return () => { clearInterval(timer); clearInterval(finishTimer); ro.disconnect(); if (drag) drag.layer.remove(); };
  }

  WNG.games.solitaer = mountSolitaer;
})();
