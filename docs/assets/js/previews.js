// Animierte Vorschauen für die Spielkarten.
(() => {
  "use strict";
  const { clamp, rr, karo, disp, SUB } = WNG;

    const SNAKE_PATH = (() => {
    const p = [];
    for (let r = 0; r < 10; r++) {
      if (r % 2 === 0) for (let c = 1; c <= 11; c++) p.push([c, r]);
      else for (let c = 11; c >= 1; c--) p.push([c, r]);
    }
    for (let r = 9; r >= 0; r--) p.push([0, r]);
    return p;
  })();
  function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const MINE_PREVIEW = (() => {
    const W = 11, H = 7, r = seeded(11), mine = Array(W * H).fill(false);
    const centre = 3 * W + 5; let k = 0;
    while (k < 12) { const i = Math.floor(r() * W * H); const dx = Math.abs(i % W - 5), dy = Math.abs(((i / W) | 0) - 3); if (mine[i] || (dx <= 1 && dy <= 1)) continue; mine[i] = true; k++; }
    const cnt = mine.map((_, i) => { let n = 0; const x = i % W, y = (i / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < H && mine[ny * W + nx]) n++; } return n; });
    const order = mine.map((m, i) => i).filter(i => !mine[i]).sort((a, b) => {
      const d = i => Math.hypot(i % W - 5, ((i / W) | 0) - 3) + (i * 0.37 % 1) * .6; return d(a) - d(b);
    });
    return { W, H, mine, cnt, order, centre };
  })();
  const C4_SEQ = [3, 3, 2, 4, 4, 2, 5, 1, 3, 2, 4, 6, 0, 5, 3, 1, 2, 4, 5, 6];

  const PREVIEW = {
    schlange(x, w, hh, t, p) {
      const C = 12, R = 10, S = Math.floor(Math.min((w - 24) / C, (hh - 24) / R)), ox = Math.round((w - C * S) / 2), oy = Math.round((hh - R * S) / 2);
      karo(x, w, hh, S, p);
      const L = SNAKE_PATH.length, pos = Math.floor(t * 7) % L;
      const fi = (Math.floor(pos / 23) * 23 + 22) % L, f = SNAKE_PATH[fi];
      x.fillStyle = p.red; x.beginPath(); x.arc(ox + f[0] * S + S / 2, oy + f[1] * S + S / 2, S * .34, 0, Math.PI * 2); x.fill();
      for (let i = 9; i >= 0; i--) {
        const q = SNAKE_PATH[(pos - i + L) % L];
        x.fillStyle = i === 0 ? p.fg : p.ink;
        rr(x, ox + q[0] * S + 1.5, oy + q[1] * S + 1.5, S - 3, S - 3, i === 0 ? 5 : 3); x.fill();
      }
    },
    memory(x, w, hh, t, p) {
      karo(x, w, hh, 14, p);
      const cols = 4, rows = 2, gap = 10, cw = Math.min((w - 40 - gap * (cols - 1)) / cols, ((hh - 32 - gap) / rows) * .75), ch = cw / .75;
      const ox = (w - (cw * cols + gap * (cols - 1))) / 2, oy = (hh - (ch * rows + gap)) / 2;
      for (let i = 0; i < cols * rows; i++) {
        const a = (t * .45 + i * .381966) % 2.2;
        const o = a < .5 ? 0 : a < .65 ? (a - .5) / .15 : a < 1.6 ? 1 : a < 1.75 ? 1 - (a - 1.6) / .15 : 0;
        const face = o > .5, sx = Math.abs(Math.cos(o * Math.PI));
        const cx = ox + (i % cols) * (cw + gap) + cw / 2, cy = oy + Math.floor(i / cols) * (ch + gap);
        const ww = Math.max(1, cw * sx);
        if (face) {
          x.fillStyle = p.sheet; rr(x, cx - ww / 2, cy, ww, ch, 4); x.fill();
          x.strokeStyle = p.c[i]; x.lineWidth = 2; x.stroke();
          if (sx > .3) { x.fillStyle = p.c[i]; x.font = disp(Math.round(cw * .3)); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(SUB[i][0], cx, cy + ch / 2); }
        } else {
          x.fillStyle = p.grid; rr(x, cx - ww / 2, cy, ww, ch, 4); x.fill();
          x.strokeStyle = p.marker; x.lineWidth = 1.2; x.stroke();
          if (sx > .3) { x.fillStyle = p.marker; x.font = `800 ${Math.round(cw * .28)}px Cinzel, Georgia, serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("W", cx, cy + ch / 2 + 1); }
        }
      }
    },
    vier(x, w, hh, t, p) {
      karo(x, w, hh, 14, p);
      const s = Math.min((w - 40) / 7, (hh - 28) / 6), bw = s * 7 + 10, bh = s * 6 + 10, bx = (w - bw) / 2, by = (hh - bh) / 2 + 2;
      x.fillStyle = p.grid; rr(x, bx, by, bw, bh, 8); x.fill();
      x.strokeStyle = p.line; x.lineWidth = 1; x.stroke();
      const total = C4_SEQ.length, step = t * 2.2, n = Math.floor(step) % (total + 5), frac = step % 1;
      const hgt = Array(7).fill(0), disc = {};
      for (let k = 0; k < Math.min(n + 1, total); k++) { const c = C4_SEQ[k]; disc[(5 - hgt[c]) * 7 + c] = { k, p: k % 2 }; hgt[c]++; }
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        const cx = bx + 5 + c * s + s / 2, cy = by + 5 + r * s + s / 2;
        x.fillStyle = p.paper; x.beginPath(); x.arc(cx, cy, s * .38, 0, Math.PI * 2); x.fill();
      }
      for (const key in disc) {
        const d = disc[key], r = (key / 7) | 0, c = key % 7;
        if (d.k > n) continue;
        let cy = by + 5 + r * s + s / 2;
        if (d.k === n) { if (n >= total) continue; const e = Math.min(1, frac * 1.6); cy = by - s + (cy - by + s) * e * e; }
        x.fillStyle = d.p ? p.c[1] : p.c[0];
        x.beginPath(); x.arc(bx + 5 + c * s + s / 2, cy, s * .38, 0, Math.PI * 2); x.fill();
      }
    },
    minen(x, w, hh, t, p) {
      const m = MINE_PREVIEW, s = Math.min((w - 32) / m.W, (hh - 28) / m.H), ox = (w - s * m.W) / 2, oy = (hh - s * m.H) / 2;
      x.fillStyle = p.sheet; x.fillRect(0, 0, w, hh);
      const span = m.order.length, k = Math.floor((t * 9) % (span + 22));
      const open = new Set(m.order.slice(0, Math.min(k, span)));
      x.textAlign = "center"; x.textBaseline = "middle"; x.font = `600 ${Math.round(s * .55)}px 'IBM Plex Mono', monospace`;
      for (let i = 0; i < m.W * m.H; i++) {
        const cx = ox + (i % m.W) * s, cy = oy + ((i / m.W) | 0) * s;
        if (open.has(i)) {
          x.fillStyle = p.paper; x.fillRect(cx + 1, cy + 1, s - 2, s - 2);
          if (m.cnt[i]) { x.fillStyle = p.c[[0, 0, 2, 1, 4, 3, 5, 7, 7][m.cnt[i]]]; x.fillText(m.cnt[i], cx + s / 2, cy + s / 2 + 1); }
        } else {
          x.fillStyle = p.grid; rr(x, cx + 1.5, cy + 1.5, s - 3, s - 3, 3); x.fill();
          x.strokeStyle = p.line; x.lineWidth = 1; x.stroke();
          if (m.mine[i] && k > span) { x.fillStyle = p.marker; x.fillText("⚑", cx + s / 2, cy + s / 2 + 1); }
        }
      }
    },
    ziegel(x, w, hh, t, p) {
      karo(x, w, hh, 14, p);
      const tri = v => { const f = v % 2; return f < 1 ? f : 2 - f; };
      const cols = 8, rows = 4, side = 18, gap = 5, bw = (w - side * 2 - gap * (cols - 1)) / cols, bht = Math.max(7, hh * .055), top = hh * .14;
      const gone = (t * .07) % 1;
      const rowc = [1, 3, 2, 4];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const j = r * cols + c; if (((j * 7919) % 32) / 32 < gone) continue;
        x.fillStyle = p.c[rowc[r]]; rr(x, side + c * (bw + gap), top + r * (bht + gap), bw, bht, 2); x.fill();
      }
      const br = Math.max(4, hh * .03), py = hh - 22;
      const bx = br + tri(t * .41) * (w - 2 * br), byTop = top + rows * (bht + gap) + br;
      const by = byTop + tri(t * .63) * (py - br - byTop);
      const pw = w * .2, ppx = clamp(bx, pw / 2 + 6, w - pw / 2 - 6);
      x.fillStyle = p.fg; rr(x, ppx - pw / 2, py, pw, 8, 4); x.fill();
      x.fillStyle = p.red; x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill();
    },
    reaktion(x, w, hh, t, p) {
      x.fillStyle = p.sheet; x.fillRect(0, 0, w, hh);
      const cyc = Math.floor(t / 4.5), a = t % 4.5;
      const [bg, fg, big] = a < 1.8 ? [p.red, p.on, "Warten …"] : a < 2.5 ? [p.good, p.on, "Jetzt!"] : [p.grid, p.marker, `${183 + (cyc * 37) % 110} ms`];
      x.fillStyle = bg; rr(x, 18, 18, w - 36, hh - 36, 10); x.fill();
      x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `800 ${Math.round(Math.min(w * .1, hh * .17))}px Cinzel, Georgia, serif`;
      x.fillText(big, w / 2, hh / 2);
    },
    sudoku(x, w, hh, t, p) {
      x.fillStyle = p.sheet; x.fillRect(0, 0, w, hh);
      const s = Math.floor(Math.min((w - 30) / 9, (hh - 24) / 9)), ox = Math.round((w - s * 9) / 2), oy = Math.round((hh - s * 9) / 2);
      const val = i => { const r = (i / 9) | 0, c = i % 9; return ((r * 3 + ((r / 3) | 0) + c) % 9) + 1; };
      const given = i => ((i * 37 + 11) % 7) < 3;
      const k = Math.floor(t * 7) % (81 + 20);
      let n = 0, cur = -1;
      x.textAlign = "center"; x.textBaseline = "middle"; x.font = `600 ${Math.round(s * .58)}px 'IBM Plex Mono', monospace`;
      for (let i = 0; i < 81; i++) {
        const cx = ox + (i % 9) * s, cy = oy + ((i / 9) | 0) * s;
        if (given(i)) { x.fillStyle = p.fg; x.fillText(val(i), cx + s / 2, cy + s / 2 + 1); continue; }
        if (n < k) { x.fillStyle = p.marker; x.fillText(val(i), cx + s / 2, cy + s / 2 + 1); }
        else if (n === k) cur = i;
        n++;
      }
      if (cur >= 0) { x.fillStyle = "rgba(56,189,248,.25)"; x.fillRect(ox + (cur % 9) * s + 1, oy + ((cur / 9) | 0) * s + 1, s - 2, s - 2); }
      for (let i = 0; i <= 9; i++) {
        x.strokeStyle = i % 3 ? p.grid : p.muted; x.lineWidth = i % 3 ? 1 : 1.6;
        x.beginPath(); x.moveTo(ox + i * s, oy); x.lineTo(ox + i * s, oy + 9 * s); x.moveTo(ox, oy + i * s); x.lineTo(ox + 9 * s, oy + i * s); x.stroke();
      }
    },
    adlige(x, w, hh, t, p) {
      x.fillStyle = p.sheet; x.fillRect(0, 0, w, hh);
      const s = Math.floor(Math.min((w - 30) / 8, (hh - 20) / 8)), ox = Math.round((w - s * 8) / 2), oy = Math.round((hh - s * 8) / 2);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { x.fillStyle = (r + c) % 2 ? p.grid : p.sheet2; x.fillRect(ox + c * s, oy + r * s, s, s); }
      x.strokeStyle = p.marker; x.lineWidth = 1.2; x.strokeRect(ox - .5, oy - .5, s * 8 + 1, s * 8 + 1);
      const MOVES = [["♞", 0, [6, 7], [5, 5]], ["♙", 1, [4, 6], [4, 4]], ["♟", 0, [4, 1], [4, 3]], ["♗", 1, [5, 7], [2, 4]], ["♛", 0, [3, 0], [7, 4]], ["♘", 1, [1, 7], [2, 5]]];
      const STATIC = [["♜", 0, 0, 0], ["♚", 0, 4, 0], ["♜", 0, 7, 0], ["♟", 0, 0, 1], ["♟", 0, 2, 1], ["♟", 0, 6, 1], ["♖", 1, 0, 7], ["♔", 1, 4, 7], ["♖", 1, 7, 7], ["♙", 1, 1, 6], ["♙", 1, 3, 6], ["♙", 1, 6, 6]];
      const cyc = (t * .5) % (MOVES.length + 2), step = Math.floor(cyc), fr = Math.min(1, (cyc % 1) * 1.8), ease = fr * fr * (3 - 2 * fr);
      x.textAlign = "center"; x.textBaseline = "middle"; x.font = `${Math.round(s * .8)}px 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'DejaVu Sans', serif`;
      const piece = (g, side, cx, cy) => { x.fillStyle = side ? p.fg : p.marker; x.fillText(g, cx, cy); };
      STATIC.forEach(([g, sd, c, r]) => piece(g, sd, ox + c * s + s / 2, oy + r * s + s / 2 + 1));
      MOVES.forEach(([g, sd, a, b], i) => {
        const e = i < step ? 1 : i === step ? ease : 0;
        const c = a[0] + (b[0] - a[0]) * e, r = a[1] + (b[1] - a[1]) * e;
        piece(g, sd, ox + c * s + s / 2, oy + r * s + s / 2 + 1);
      });
    }
  };


  /* ---------- Vorschauen der neuen Spiele ---------- */
  const SUITS = ["♠", "♥", "♦", "♣"];
  function miniCard(x, cx, cy, cw, up, s, label, p) {
    const ch = cw * 1.4;
    if (!up) {
      x.fillStyle = "#13203d"; rr(x, cx, cy, cw, ch, 4); x.fill();
      x.strokeStyle = p.marker; x.globalAlpha = .7; x.lineWidth = 1; rr(x, cx + 3, cy + 3, cw - 6, ch - 6, 3); x.stroke(); x.globalAlpha = 1;
      return;
    }
    x.fillStyle = "#f4f0e6"; rr(x, cx, cy, cw, ch, 4); x.fill();
    x.fillStyle = s === 1 || s === 2 ? "#c2362b" : "#1b2238";
    x.font = `700 ${Math.round(cw * .34)}px Inter, sans-serif`; x.textAlign = "left"; x.textBaseline = "top";
    x.fillText(label + SUITS[s], cx + cw * .1, cy + cw * .08);
  }
  Object.assign(PREVIEW, {
    solitaer(x, w, hh, t, p) {
      karo(x, w, hh, 14, p);
      const cw = Math.min(w / 9.2, hh / 6), gap = (w - cw * 7) / 8, top = hh * .14 + cw * 1.4 + 10;
      // Ablage oben
      for (let f = 0; f < 4; f++) {
        const fx = gap + (f + 3) * (cw + gap), fy = hh * .1;
        x.strokeStyle = "rgba(226,181,82,.45)"; x.lineWidth = 1; rr(x, fx, fy, cw, cw * 1.4, 4); x.stroke();
        if (f < 2) miniCard(x, fx, fy, cw, true, f === 0 ? 1 : 3, "A", p);
      }
      miniCard(x, gap, hh * .1, cw, false, 0, "", p);
      // Spalten
      const labels = ["K", "D", "B", "10", "9", "8", "7"];
      for (let c = 0; c < 7; c++) {
        let y = top;
        for (let k = 0; k < c; k++) { miniCard(x, gap + c * (cw + gap), y, cw, false, 0, "", p); y += cw * .18; }
        for (let k = 0; k < Math.min(3, 7 - c); k++) { miniCard(x, gap + c * (cw + gap), y, cw, true, (c + k) % 4, labels[(c + k) % 7], p); y += cw * .38; }
      }
      // Karte fliegt zur Ablage
      const ph = (t * .5) % 1, e = ph < .6 ? ph / .6 : 1;
      const sx = gap + 6 * (cw + gap), sy = top + cw * 1.2, tx = gap + 5 * (cw + gap), ty = hh * .1;
      const fx = sx + (tx - sx) * e, fy = sy + (ty - sy) * e - Math.sin(e * Math.PI) * hh * .12;
      x.save(); x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 10; miniCard(x, fx, fy, cw, true, 2, "2", p); x.restore();
    },
    schiffe(x, w, hh, t, p) {
      x.fillStyle = "#0b1a33"; x.fillRect(0, 0, w, hh);
      const n = 10, s = Math.min((w - 30) / n, (hh - 24) / n), ox = (w - s * n) / 2, oy = (hh - s * n) / 2;
      x.strokeStyle = "rgba(56,189,248,.18)"; x.lineWidth = 1;
      for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(ox + i * s, oy); x.lineTo(ox + i * s, oy + n * s); x.moveTo(ox, oy + i * s); x.lineTo(ox + n * s, oy + i * s); x.stroke(); }
      const ships = [[1, 1, 5, 0], [7, 3, 4, 1], [2, 5, 3, 0], [5, 8, 3, 0], [0, 7, 2, 1]];
      const shipAt = new Map();
      ships.forEach(([sx, sy, l, v], k) => { for (let i = 0; i < l; i++) shipAt.set((sy + (v ? i : 0)) * n + sx + (v ? 0 : i), k); });
      // Schussreihenfolge, fest gemischt
      const order = Array.from({ length: n * n }, (_, i) => i).sort((a, b) => ((a * 37) % 101) - ((b * 37) % 101));
      const k = Math.floor((t * 4) % 70);
      for (let i = 0; i < k; i++) {
        const c = order[i], cx = ox + (c % n) * s + s / 2, cy = oy + Math.floor(c / n) * s + s / 2;
        if (shipAt.has(c)) {
          x.fillStyle = p.red; x.globalAlpha = .9; x.beginPath(); x.arc(cx, cy, s * .34, 0, 6.283); x.fill(); x.globalAlpha = 1;
          x.strokeStyle = "#fff"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - s * .16, cy - s * .16); x.lineTo(cx + s * .16, cy + s * .16); x.moveTo(cx + s * .16, cy - s * .16); x.lineTo(cx - s * .16, cy + s * .16); x.stroke();
        } else { x.fillStyle = "rgba(160,200,255,.45)"; x.beginPath(); x.arc(cx, cy, s * .1, 0, 6.283); x.fill(); }
      }
      // Fadenkreuz auf dem nächsten Ziel
      const nc = order[k], ax = ox + (nc % n) * s + s / 2, ay = oy + Math.floor(nc / n) * s + s / 2, pulse = 1 + Math.sin(t * 8) * .1;
      x.strokeStyle = p.marker; x.lineWidth = 1.5; x.beginPath(); x.arc(ax, ay, s * .45 * pulse, 0, 6.283); x.stroke();
      x.beginPath(); x.moveTo(ax - s * .7, ay); x.lineTo(ax + s * .7, ay); x.moveTo(ax, ay - s * .7); x.lineTo(ax, ay + s * .7); x.stroke();
    },
    minigolf(x, w, hh, t, p) {
      x.fillStyle = p.paper; x.fillRect(0, 0, w, hh);
      const m = 16, g = x.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, "#0f4a43"); g.addColorStop(1, "#0b3833");
      x.fillStyle = g; rr(x, m, m, w - 2 * m, hh - 2 * m, 10); x.fill();
      x.strokeStyle = p.marker; x.lineWidth = 3; x.stroke();
      // Teich
      x.fillStyle = "#11618a"; rr(x, w * .38, hh * .42, w * .26, hh * .3, 8); x.fill();
      const cup = [w * .8, hh * .3], tee = [w * .16, hh * .72];
      x.fillStyle = "#020409"; x.beginPath(); x.arc(cup[0], cup[1], 7, 0, 6.283); x.fill();
      x.strokeStyle = p.fg; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cup[0], cup[1]); x.lineTo(cup[0], cup[1] - 30); x.stroke();
      x.fillStyle = p.c[1]; x.beginPath(); x.moveTo(cup[0], cup[1] - 30); x.lineTo(cup[0] + 16, cup[1] - 25); x.lineTo(cup[0], cup[1] - 20); x.fill();
      // Ball rollt über einen Bogen ins Loch
      const ph = (t * .35) % 1;
      const ctrl = [w * .4, hh * .05];
      if (ph < .25) {
        const a = -0.9, len = 20 + (ph / .25) * 50;
        x.strokeStyle = p.marker; x.setLineDash([2, 6]); x.lineWidth = 2;
        x.beginPath(); x.moveTo(tee[0], tee[1]); x.lineTo(tee[0] + Math.cos(a) * len, tee[1] + Math.sin(a) * len); x.stroke(); x.setLineDash([]);
      }
      const e = ph < .25 ? 0 : Math.min(1, (ph - .25) / .6), ee = 1 - Math.pow(1 - e, 2.2);
      const bx = (1 - ee) * (1 - ee) * tee[0] + 2 * (1 - ee) * ee * ctrl[0] + ee * ee * cup[0];
      const by = (1 - ee) * (1 - ee) * tee[1] + 2 * (1 - ee) * ee * ctrl[1] + ee * ee * cup[1];
      if (e < 1) { x.fillStyle = "#f5f7fb"; x.beginPath(); x.arc(bx, by, 5, 0, 6.283); x.fill(); }
    },
    rennen(x, w, hh, t, p) {
      x.fillStyle = "#0b1224"; x.fillRect(0, 0, w, hh);
      const s = Math.min(w, hh) * .78, ox = (w - s) / 2, oy = (hh - s) / 2, step = s / 10;
      const pos = i => { const side = Math.floor(i / 10) % 4, k = i % 10; return side === 0 ? [ox + k * step, oy] : side === 1 ? [ox + s, oy + k * step] : side === 2 ? [ox + s - k * step, oy + s] : [ox, oy + s - k * step]; };
      for (let i = 0; i < 40; i++) {
        const [fx, fy] = pos(i);
        x.fillStyle = i % 10 === 0 ? [p.c[0], p.c[1], p.c[2], p.c[4]][i / 10] : "#1b2846";
        x.globalAlpha = i % 10 === 0 ? .5 : 1; x.beginPath(); x.arc(fx, fy, step * .3, 0, 6.283); x.fill(); x.globalAlpha = 1;
        if ([5, 15, 25, 35].includes(i)) { x.fillStyle = p.marker; x.font = `${Math.round(step * .45)}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("★", fx, fy + 1); }
      }
      [0, 1, 2, 3].forEach(pl => {
        const prog = (pl * 10 + Math.floor(t * (1.2 + pl * .35)) * 3) % 40;
        const [tx, ty] = pos(prog), hop = Math.abs(Math.sin(t * 3 + pl)) * 4;
        x.fillStyle = [p.c[0], p.c[1], p.c[2], p.c[4]][pl]; x.beginPath(); x.arc(tx, ty - hop, step * .26, 0, 6.283); x.fill();
        x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.2; x.stroke();
      });
      // Würfel
      const ds = s * .26, n = 1 + Math.floor(t * 1.5) % 6, cx = w / 2, cy = hh / 2;
      x.save(); x.translate(cx, cy); x.rotate(Math.sin(t * 1.5) * .15);
      x.fillStyle = "#f4f1e8"; rr(x, -ds / 2, -ds / 2, ds, ds, ds * .18); x.fill();
      const d = ds * .26, pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
      x.fillStyle = "#121833"; for (const [a, b] of pips) { x.beginPath(); x.arc(a * d, b * d, ds * .07, 0, 6.283); x.fill(); }
      x.restore();
    }
  });


  /* ---------- Vorschauen: Mühle, Sudoku, Wortjagd, Andersfarbig ---------- */
  Object.assign(PREVIEW, {
    muehle(x, w, hh, t, p) {
      x.fillStyle = "#0b1224"; x.fillRect(0, 0, w, hh);
      const s = Math.min(w, hh) * .8, ox = (w - s) / 2, oy = (hh - s) / 2, st = s / 6;
      x.strokeStyle = p.marker; x.lineWidth = 2;
      for (const k of [0, 1, 2]) x.strokeRect(ox + k * st, oy + k * st, s - 2 * k * st, s - 2 * k * st);
      x.beginPath();
      x.moveTo(ox + 3 * st, oy); x.lineTo(ox + 3 * st, oy + 2 * st); x.moveTo(ox + 3 * st, oy + 4 * st); x.lineTo(ox + 3 * st, oy + s);
      x.moveTo(ox, oy + 3 * st); x.lineTo(ox + 2 * st, oy + 3 * st); x.moveTo(ox + 4 * st, oy + 3 * st); x.lineTo(ox + s, oy + 3 * st);
      x.stroke();
      const P = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
      const seq = [[4, 1], [16, 2], [1, 1], [19, 2], [7, 1], [10, 2], [13, 1], [22, 2]];
      const n = Math.floor(t * 1.4) % (seq.length + 4);
      for (const [i] of P.entries()) { const [a, b] = P[i]; x.fillStyle = "#0b1224"; x.beginPath(); x.arc(ox + a * st, oy + b * st, 3.5, 0, 6.283); x.fill(); x.strokeStyle = p.marker; x.lineWidth = 1.5; x.stroke(); }
      seq.slice(0, Math.min(n, seq.length)).forEach(([i, pl], k) => {
        const [a, b] = P[i], drop = k === n - 1 ? Math.max(0, 1 - (t * 1.4 % 1) * 3) * 10 : 0;
        x.fillStyle = pl === 1 ? p.c[0] : p.c[1];
        x.beginPath(); x.arc(ox + a * st, oy + b * st - drop, st * .26, 0, 6.283); x.fill();
      });
      if (n >= 5 && n < seq.length + 4) { // Mühle 1-4-7 leuchtet
        x.strokeStyle = "rgba(226,181,82,.8)"; x.lineWidth = st * .5; x.globalAlpha = .25 + .2 * Math.sin(t * 6); x.lineCap = "round";
        x.beginPath(); x.moveTo(ox + 3 * st, oy); x.lineTo(ox + 3 * st, oy + 2 * st); x.stroke(); x.globalAlpha = 1;
      }
    },
    sudoku9(x, w, hh, t, p) {
      x.fillStyle = p.sheet; x.fillRect(0, 0, w, hh);
      const s = Math.floor(Math.min((w - 30) / 9, (hh - 22) / 9)), ox = Math.round((w - s * 9) / 2), oy = Math.round((hh - s * 9) / 2);
      const val = i => { const r = (i / 9) | 0, c = i % 9; return ((r * 3 + ((r / 3) | 0) + c + 4) % 9) + 1; };
      const given = i => ((i * 53 + 7) % 9) < 4;
      const sel = Math.floor(t * .9) % 81, selR = (sel / 9) | 0, selC = sel % 9;
      x.fillStyle = "rgba(56,189,248,.07)";
      for (let k = 0; k < 9; k++) { x.fillRect(ox + k * s, oy + selR * s, s, s); x.fillRect(ox + selC * s, oy + k * s, s, s); }
      x.fillStyle = "rgba(226,181,82,.25)"; x.fillRect(ox + selC * s, oy + selR * s, s, s);
      x.textAlign = "center"; x.textBaseline = "middle"; x.font = `600 ${Math.round(s * .55)}px 'IBM Plex Mono', monospace`;
      for (let i = 0; i < 81; i++) {
        const filled = given(i) || i < sel;
        if (!filled) continue;
        x.fillStyle = given(i) ? p.fg : p.marker;
        x.fillText(val(i), ox + (i % 9) * s + s / 2, oy + ((i / 9) | 0) * s + s / 2 + 1);
      }
      for (let i = 0; i <= 9; i++) {
        x.strokeStyle = i % 3 ? "rgba(255,255,255,.1)" : "rgba(226,181,82,.6)"; x.lineWidth = i % 3 ? 1 : 1.6;
        x.beginPath(); x.moveTo(ox + i * s, oy); x.lineTo(ox + i * s, oy + 9 * s); x.moveTo(ox, oy + i * s); x.lineTo(ox + 9 * s, oy + i * s); x.stroke();
      }
    },
    wortjagd(x, w, hh, t, p) {
      x.fillStyle = p.sheet; x.fillRect(0, 0, w, hh);
      const n = 9, s = Math.min((w - 24) / n, (hh - 20) / n), ox = (w - s * n) / 2, oy = (hh - s * n) / 2;
      const letters = "KOMETRAFEPLANETSULDMONDNIEGALAXIEBORTSTERNUHNEBELKAMRAKETEOWISONNEFRDTELESKOPIAUZ";
      const words = [[[0, 0], [1, 0], 5, "#38bdf8"], [[0, 2], [1, 1], 6, "#e2b552"], [[8, 1], [0, 1], 6, "#ff6b5e"], [[2, 8], [1, -1], 5, "#4ade80"]];
      const shown = Math.floor(t * .6) % (words.length + 2);
      words.slice(0, shown).forEach(([[sx, sy], [dx, dy], len, col], k) => {
        const prog = k === shown - 1 ? Math.min(1, (t * .6 % 1) * 2.2) : 1;
        x.strokeStyle = col; x.globalAlpha = .35; x.lineWidth = s * .78; x.lineCap = "round";
        x.beginPath(); x.moveTo(ox + (sx + .5) * s, oy + (sy + .5) * s);
        x.lineTo(ox + (sx + dx * (len - 1) * prog + .5) * s, oy + (sy + dy * (len - 1) * prog + .5) * s); x.stroke(); x.globalAlpha = 1;
      });
      x.textAlign = "center"; x.textBaseline = "middle"; x.font = `700 ${Math.round(s * .5)}px 'IBM Plex Mono', monospace`; x.fillStyle = "#c8d0e0";
      for (let i = 0; i < n * n; i++) x.fillText(letters[i % letters.length], ox + (i % n + .5) * s, oy + (((i / n) | 0) + .5) * s + 1);
    },
    farbton(x, w, hh, t, p) {
      x.fillStyle = "#0b1224"; x.fillRect(0, 0, w, hh);
      const round = Math.floor(t * .8), n = 3 + (round % 4), gap = 4;
      const s = Math.min((w - 30 - gap * (n - 1)) / n, (hh - 30 - gap * (n - 1)) / n), ox = (w - (s * n + gap * (n - 1))) / 2, oy = (hh - (s * n + gap * (n - 1))) / 2;
      const hue = (round * 67) % 360, odd = (round * 7) % (n * n), d = 16 - (round % 4) * 3;
      const pulse = (t * .8) % 1 > .7;
      for (let i = 0; i < n * n; i++) {
        x.fillStyle = `hsl(${hue} 62% ${i === odd ? 50 + d : 50}%)`;
        rr(x, ox + (i % n) * (s + gap), oy + ((i / n) | 0) * (s + gap), s, s, 6); x.fill();
        if (i === odd && pulse) { x.strokeStyle = p.marker; x.lineWidth = 3; x.stroke(); }
      }
    }
  });


  /* ---------- Vorschauen: Reichenspiel, Steine schmeißen, Heast chü amoi, Hüpfer ---------- */
  const pvDie = (x, cx, cy, s, n) => {
    x.fillStyle = "#f4f1e8"; rr(x, cx - s / 2, cy - s / 2, s, s, s * .18); x.fill();
    const d = s * .26, pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
    x.fillStyle = "#121833"; for (const [a, b] of pips) { x.beginPath(); x.arc(cx + a * d, cy + b * d, s * .07, 0, 6.283); x.fill(); }
  };
  const pvStone = (x, px, py, s, hue) => {
    const g = x.createLinearGradient(px, py, px + s, py + s);
    if (hue < 0) { g.addColorStop(0, "#fff3c4"); g.addColorStop(.5, "#e2b552"); g.addColorStop(1, "#8a6420"); }
    else { g.addColorStop(0, `hsl(${hue} 45% 62%)`); g.addColorStop(1, `hsl(${hue} 40% 34%)`); }
    x.fillStyle = g; rr(x, px + 1, py + 1, s - 2, s - 2, s * .25); x.fill();
  };
  Object.assign(PREVIEW, {
    reich(x, w, hh, t, p) {
      x.fillStyle = "#0b1224"; x.fillRect(0, 0, w, hh);
      const s = Math.min(w, hh) * .86, ox = (w - s) / 2, oy = (hh - s) / 2, cell = s / 8;
      const hues = [28, 200, 150, 340, 265, 45, 185];
      const pos = k => k <= 7 ? [7 - k, 7] : k <= 14 ? [0, 7 - (k - 7)] : k <= 21 ? [k - 14, 0] : [7, k - 21];
      for (let k = 0; k < 28; k++) {
        const [cx, cy] = pos(k), px = ox + cx * cell, py = oy + cy * cell;
        x.fillStyle = "#162240"; x.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        if (k % 7 && ![4, 11, 18, 25].includes(k)) { x.fillStyle = `hsl(${hues[Math.floor(k / 4) % 7]} 55% 48%)`; x.fillRect(px + 1, py + 1, cell - 2, cell * .2); }
        if ([2, 5, 9, 16, 19, 23].includes(k)) { x.strokeStyle = ["#38bdf8", "#ff6b5e", "#4ade80"][k % 3]; x.lineWidth = 2; x.strokeRect(px + 3, py + 3, cell - 6, cell - 6); }
      }
      x.strokeStyle = "rgba(226,181,82,.6)"; x.lineWidth = 1.2; x.strokeRect(ox + cell, oy + cell, s - 2 * cell, s - 2 * cell);
      x.fillStyle = p.marker; x.font = `800 ${Math.round(cell * .48)}px Cinzel, Georgia, serif`; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText("Reichenspiel", w / 2, oy + s * .36);
      const r1 = 1 + Math.floor(t * 1.1) % 6, r2 = 1 + Math.floor(t * 1.1 + 2) % 6;
      pvDie(x, w / 2 - cell * .62, oy + s * .58, cell * .9, r1); pvDie(x, w / 2 + cell * .62, oy + s * .58, cell * .9, r2);
      // Spielfigur zieht ums Brett
      const k = Math.floor(t * 2.2) % 28, [cx, cy] = pos(k);
      x.fillStyle = "#e2b552"; x.beginPath(); x.arc(ox + (cx + .5) * cell, oy + (cy + .55) * cell - Math.abs(Math.sin(t * 7)) * 4, cell * .2, 0, 6.283); x.fill();
      x.strokeStyle = "#fff"; x.lineWidth = 1.5; x.stroke();
    },
    steine(x, w, hh, t, p) {
      x.fillStyle = "#0d1a33"; x.fillRect(0, 0, w, hh);
      const cols = 11, s = Math.min((w - 20) / cols, (hh - 10) / 9), ox = (w - s * cols) / 2, rows = Math.floor((hh - 10) / s), oy = hh - 5 - rows * s;
      x.strokeStyle = p.marker; x.lineWidth = 1.5; x.strokeRect(ox - 1, oy - 1, s * cols + 2, s * rows + 2);
      const stack = ["00011100110", "01111101111", "11111111011"];
      stack.forEach((r, i) => [...r].forEach((v, j) => { if (v === "1") pvStone(x, ox + j * s, oy + (rows - 3 + i) * s, s, [205, 160, 28, 280, 340, 120, 50, 250][(i * 3 + j) % 8]); }));
      const ph = (t * .45) % 1, y = Math.floor(ph * (rows - 3)) - 1;
      const shape = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], px = 5;
      for (const [a, b] of shape) if (y + b >= 0) pvStone(x, ox + (px + a) * s, oy + (y + b) * s, s, 28);
      pvStone(x, ox + 9 * s, oy + Math.max(0, Math.floor(((t * .45 + .5) % 1) * (rows - 4))) * s, s, -1);
    },
    heast(x, w, hh, t, p) {
      x.fillStyle = "#0b1224"; x.fillRect(0, 0, w, hh);
      const cx = w / 2, cy = hh / 2, R = Math.min(w, hh) * .38, cols = [p.c[0], p.c[1], p.c[2], p.c[3]];
      for (let i = 0; i < 40; i++) {
        const a = -Math.PI / 2 + i / 40 * Math.PI * 2, fx = cx + Math.cos(a) * R, fy = cy + Math.sin(a) * R, own = i % 10 === 0;
        x.fillStyle = own ? cols[i / 10] : "#1b2846"; x.globalAlpha = own ? .6 : 1;
        x.beginPath(); x.arc(fx, fy, own ? 6 : 4.5, 0, 6.283); x.fill(); x.globalAlpha = 1;
      }
      for (let pl = 0; pl < 4; pl++) {
        const prog = (Math.floor(t * (1.3 + pl * .25)) * 2 + pl * 10) % 40, a = -Math.PI / 2 + prog / 40 * Math.PI * 2;
        x.fillStyle = cols[pl]; x.beginPath(); x.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R - Math.abs(Math.sin(t * 5 + pl)) * 3, 7, 0, 6.283); x.fill();
        x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.2; x.stroke();
      }
      pvDie(x, cx, cy - 6, R * .42, 1 + Math.floor(t * 1.3) % 6);
      if ((t % 4) > 2.4) {
        x.font = `700 ${Math.round(R * .14)}px Inter, sans-serif`; const txt = "Heast, chü amoi!", tw = x.measureText(txt).width + 16;
        x.fillStyle = "#f4f1e8"; rr(x, cx - tw / 2, cy + R * .3, tw, R * .24, 8); x.fill();
        x.fillStyle = "#121833"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(txt, cx, cy + R * .42);
      }
    },
    huepfer(x, w, hh, t, p) {
      const g = x.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, "#050a18"); g.addColorStop(1, "#14213d");
      x.fillStyle = g; x.fillRect(0, 0, w, hh);
      for (let i = 0; i < 30; i++) { x.fillStyle = p.fg; x.globalAlpha = .3 + (i % 3) * .2; x.fillRect(((i * 97 - t * 20 * (1 + i % 3)) % w + w) % w, (i * 53) % (hh * .6), 1.5, 1.5); }
      x.globalAlpha = 1;
      const ground = hh * .78;
      x.fillStyle = "#1b2846"; x.fillRect(0, ground, w, hh - ground);
      x.strokeStyle = p.marker; x.lineWidth = 2; x.beginPath(); x.moveTo(0, ground); x.lineTo(w, ground); x.stroke();
      const per = 2.2, ph = (t % per) / per, cxst = w * (1.05 - ph * 1.25);
      // Kristall
      x.fillStyle = "#8b6ef0"; x.beginPath(); x.moveTo(cxst, ground); x.lineTo(cxst + 6, ground - hh * .16); x.lineTo(cxst + 12, ground - hh * .24); x.lineTo(cxst + 19, ground - hh * .14); x.lineTo(cxst + 24, ground); x.fill();
      // Hüpfer springt, wenn der Kristall naht
      const heroX = w * .26, dist = cxst - heroX, jump = dist < w * .22 && dist > -w * .12 ? Math.sin(Math.min(1, (w * .22 - dist) / (w * .34)) * Math.PI) : 0;
      const r = hh * .085, by = ground - jump * hh * .38;
      const hg = x.createRadialGradient(heroX - r * .3, by - r * 1.4, 1, heroX, by - r, r * 1.2); hg.addColorStop(0, "#fff3c4"); hg.addColorStop(.5, "#e2b552"); hg.addColorStop(1, "#a8782a");
      x.fillStyle = hg; x.beginPath(); x.ellipse(heroX, by - r - 2, r, r, 0, 0, 6.283); x.fill();
      x.fillStyle = "#0b2f3a"; rr(x, heroX - 1, by - r * 1.55, r * .95, r * .55, r * .25); x.fill();
      x.fillStyle = "#2fe0cf"; x.beginPath(); x.arc(heroX + r * .55, by - r * 1.28, r * .15, 0, 6.283); x.fill();
      // Stern
      x.fillStyle = p.marker; x.save(); x.translate(((w * 1.4 - t * w * .45) % (w * 1.2) + w * 1.2) % (w * 1.2), hh * .32); x.rotate(t * 2);
      x.beginPath(); for (let k = 0; k < 10; k++) { const rad = k % 2 ? 3.5 : 8, a = k * Math.PI / 5 - Math.PI / 2; x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } x.closePath(); x.fill(); x.restore();
    }
  });

  WNG.PREVIEW = PREVIEW;
})();
