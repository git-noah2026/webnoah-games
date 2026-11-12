// WebNoah-Games: minen. Wird von assets/js/shell.js gestartet.
(() => {
  "use strict";
  const { $, h, rnd, clamp, shuffle, store, pal, rr, karo, makeCanvas, segmented, MONO, BODY, SUB } = WNG;

    function mountMinen(stage, ui) {
    const SIZES = { klein: { w: 9, h: 9, m: 10 }, mittel: { w: 12, h: 12, m: 24 } };
    let size = "klein", W, H, M, mine, cnt, st, openN, flags, started, over, t0, timer, flagMode = false, lp = null, skipClick = false, lastLp = 0;
    segmented(ui.tools, [["klein", "Klein · 9 × 9"], ["mittel", "Mittel · 12 × 12"]], size, v => { size = v; ui.showBest(v); reset(); });
    const fbtn = h("button", "btn", "⚑ Flaggen-Modus"); fbtn.type = "button"; fbtn.setAttribute("aria-pressed", "false");
    fbtn.onclick = () => { flagMode = !flagMode; fbtn.setAttribute("aria-pressed", String(flagMode)); };
    ui.tools.append(fbtn);
    const grid = h("div", "mines"); stage.append(grid);
    let cells = [];
    function nb(i) {
      const x = i % W, y = (i / W) | 0, out = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
      }
      return out;
    }
    function left() { if (!over) ui.status(`Minen übrig: ${M - flags}`); }
    function reset() {
      ({ w: W, h: H, m: M } = SIZES[size]);
      mine = Array(W * H).fill(false); cnt = Array(W * H).fill(0); st = Array(W * H).fill(0);
      openN = 0; flags = 0; started = false; over = false; clearInterval(timer); ui.score(0);
      grid.style.setProperty("--w", W); grid.innerHTML = ""; cells = [];
      for (let i = 0; i < W * H; i++) { const b = h("button", "mc"); b.type = "button"; b.dataset.i = i; b.setAttribute("aria-label", "verdeckt"); grid.append(b); cells.push(b); }
      left();
    }
    function lay(safe) {
      const ban = new Set([safe, ...nb(safe)]);
      let k = 0;
      while (k < M) { const i = rnd(W * H); if (mine[i] || ban.has(i)) continue; mine[i] = true; k++; }
      for (let i = 0; i < W * H; i++) cnt[i] = nb(i).filter(j => mine[j]).length;
      started = true; t0 = Date.now();
      timer = setInterval(() => ui.score(Math.floor((Date.now() - t0) / 1000)), 250);
    }
    function paint(i) {
      const b = cells[i]; b.className = "mc"; delete b.dataset.n;
      if (st[i] === 1) {
        b.classList.add("open"); b.textContent = cnt[i] || "";
        if (cnt[i]) b.dataset.n = cnt[i];
        b.setAttribute("aria-label", cnt[i] ? `${cnt[i]} Minen daneben` : "leer");
      } else if (st[i] === 2) { b.classList.add("flag"); b.textContent = "⚑"; b.setAttribute("aria-label", "Flagge"); }
      else { b.textContent = ""; b.setAttribute("aria-label", "verdeckt"); }
    }
    function reveal(i) {
      if (st[i] !== 0) return;
      if (!started) lay(i);
      if (mine[i]) return lose(i);
      const stack = [i];
      while (stack.length) {
        const j = stack.pop(); if (st[j] !== 0) continue;
        st[j] = 1; openN++; paint(j);
        if (cnt[j] === 0) nb(j).forEach(k => { if (st[k] === 0 && !mine[k]) stack.push(k); });
      }
      if (openN === W * H - M) win();
    }
    function chord(i) {
      const n = nb(i);
      if (!cnt[i] || n.filter(j => st[j] === 2).length !== cnt[i]) return;
      for (const j of n) { if (st[j] === 0) { reveal(j); if (over) return; } }
    }
    function flag(i) {
      if (st[i] === 1 || over) return;
      st[i] = st[i] === 2 ? 0 : 2; flags += st[i] === 2 ? 1 : -1; paint(i); left();
    }
    function act(i, asFlag) {
      if (over) return;
      if (asFlag) return flag(i);
      if (st[i] === 1) return chord(i);
      if (st[i] === 2) return;
      reveal(i);
    }
    function lose(i) {
      over = true; clearInterval(timer);
      mine.forEach((m, j) => {
        if (m && st[j] !== 2) { cells[j].className = "mc open mine"; cells[j].textContent = "●"; cells[j].setAttribute("aria-label", "Mine"); }
        else if (!m && st[j] === 2) cells[j].classList.add("wrong");
      });
      cells[i].classList.add("hit");
      ui.status("Mine getroffen. „Neu starten“ legt ein neues Feld.");
    }
    function win() {
      over = true; clearInterval(timer);
      const s = Math.max(1, Math.round((Date.now() - t0) / 1000)); ui.score(s);
      mine.forEach((m, j) => { if (m && st[j] !== 2) { st[j] = 2; paint(j); } });
      const rec = ui.submit(s, size);
      ui.status(`Feld geräumt in ${s} Sekunden.`, rec ? "Neuer Rekord!" : "");
    }
    grid.addEventListener("contextmenu", e => {
      e.preventDefault();
      if (Date.now() - lastLp < 1000) return;
      clearTimeout(lp);
      const b = e.target.closest(".mc"); if (b) act(+b.dataset.i, true);
    });
    grid.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse") return;
      const b = e.target.closest(".mc"); if (!b) return;
      skipClick = false; clearTimeout(lp);
      lp = setTimeout(() => { skipClick = true; lastLp = Date.now(); act(+b.dataset.i, true); if (navigator.vibrate) navigator.vibrate(15); }, 420);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => grid.addEventListener(t, () => clearTimeout(lp)));
    grid.addEventListener("click", e => {
      const b = e.target.closest(".mc"); if (!b) return;
      if (skipClick) { skipClick = false; return; }
      act(+b.dataset.i, flagMode);
    });
    ui.onRestart(reset); reset();
    return () => { clearInterval(timer); clearTimeout(lp); };
  }

  WNG.games.minen = mountMinen;
})();
