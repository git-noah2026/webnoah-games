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

  WNG.PREVIEW = PREVIEW;
})();
