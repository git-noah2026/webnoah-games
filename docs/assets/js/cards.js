// WebNoah-Games: Spielkarten mit Live-Vorschau, Favoriten und Rekord.
(() => {
  "use strict";
  const { h, store, bestKey, favs, pal, reduced, root, fmt } = WNG;

  const href = g => g.ext || `${root}spiele/${g.id}/`;
  WNG.href = href;

  /* ---------- Vorschau-Schleife: eine für alle sichtbaren Karten ---------- */
  const thumbs = [];
  let raf = 0, last = 0;
  const ro = new ResizeObserver(entries => {
    for (const en of entries) {
      const th = thumbs.find(q => q.cv === en.target); if (!th) continue;
      const r = en.contentRect, dpr = Math.min(window.devicePixelRatio || 1, 2);
      th.w = r.width; th.h = r.height;
      th.cv.width = Math.max(1, Math.round(r.width * dpr)); th.cv.height = Math.max(1, Math.round(r.height * dpr));
      th.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(th, reduced ? 2.2 : performance.now() / 1000);
    }
  });
  const io = new IntersectionObserver(entries => {
    for (const en of entries) { const th = thumbs.find(q => q.cv === en.target); if (th) th.visible = en.isIntersecting; }
  });
  function draw(th, t) { if (th.w > 0 && th.cv.isConnected) th.fn(th.ctx, th.w, th.h, t, pal()); }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return; last = now;
    thumbs.forEach(th => { if (th.visible) draw(th, now / 1000); });
  }
  function attach(cv, id) {
    const fn = WNG.PREVIEW && WNG.PREVIEW[id]; if (!fn) return;
    const th = { cv, ctx: cv.getContext("2d"), fn, w: 0, h: 0, visible: false };
    thumbs.push(th); ro.observe(cv); io.observe(cv);
    if (!reduced && !raf) raf = requestAnimationFrame(loop);
  }
  function detachAll(container) {
    for (let i = thumbs.length - 1; i >= 0; i--) {
      if (container.contains(thumbs[i].cv)) { ro.unobserve(thumbs[i].cv); io.unobserve(thumbs[i].cv); thumbs.splice(i, 1); }
    }
  }
  WNG.thumbs = { attach, detachAll, draw };

  /* ---------- Karte ---------- */
  function recordHtml(g) {
    if (g.ext) return `<span class="rec ext-note">games.webnoah ↗</span>`;
    const b = store.get(bestKey(g.id, g.variant));
    if (b == null) return `<span class="rec none">noch kein Rekord</span>`;
    return `<span class="rec">${g.bestLabel || "Rekord"} <mark>${fmt(g, b)}</mark>${g.variantLabel ? ` <small>${g.variantLabel}</small>` : ""}</span>`;
  }
  function card(g, onFav) {
    const el = h("article", "card");
    el.dataset.id = g.id;
    const target = g.ext ? ` target="_blank" rel="noopener"` : "";
    el.innerHTML = `
      <a class="card-link" href="${href(g)}"${target}>
        <div class="thumb gild">
          <canvas aria-hidden="true"></canvas>
          <span class="badges"><span class="dur">≈ ${g.mins} Min</span>${g.isNew ? `<span class="new">Neu</span>` : ""}</span>
          ${g.ext ? `<span class="ext">Original ↗</span>` : ""}
          <span class="play-chip" aria-hidden="true">${g.ext ? "Öffnen ↗" : "Spielen ▸"}</span>
        </div>
        <div class="card-body">
          <div class="tags"><span>${g.cats[0]}</span><span>${g.players}</span></div>
          <h3 class="display">${g.name}</h3>
          <p>${g.desc}</p>
          <div class="card-foot"><span>${g.controls}</span>${recordHtml(g)}</div>
        </div>
      </a>
      <button class="fav" type="button" aria-pressed="${favs.has(g.id)}" aria-label="${g.name} als Favorit merken">★</button>`;
    el.querySelector(".fav").addEventListener("click", e => {
      const on = favs.toggle(g.id);
      e.currentTarget.setAttribute("aria-pressed", String(on));
      if (onFav) onFav(g, on);
    });
    attach(el.querySelector("canvas"), g.id);
    return el;
  }
  WNG.card = card;
})();
