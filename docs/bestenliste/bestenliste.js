// WebNoah-Games: Bestenlisten aller Spiele. /bestenliste/?spiel=id öffnet ein bestimmtes Spiel.
(() => {
  "use strict";
  const { $, h, root, fmt, segmented } = WNG;
  const GAMES = window.WNG_GAMES.filter(g => !g.ext);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const params = new URLSearchParams(location.search);
  let game = GAMES.find(g => g.id === params.get("spiel")) || GAMES[0];
  let variant = game.variant || "";

  const tabs = $("#lb-games"), vars = $("#lb-variant"), out = $("#lb-out");
  GAMES.forEach(g => {
    const b = h("button", "cat", esc(g.name)); b.type = "button"; b.dataset.id = g.id;
    b.onclick = () => { game = g; variant = g.variant || ""; history.replaceState(null, "", `?spiel=${g.id}`); load(); };
    tabs.append(b);
  });

  let seq = 0;
  async function load() {
    tabs.querySelectorAll(".cat").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === game.id)));
    vars.innerHTML = "";
    if (game.id === "minen") segmented(vars, [["klein", "Klein · 9 × 9"], ["mittel", "Mittel · 12 × 12"]], variant, v => { variant = v; load(); });
    const auth = await WNG.auth.ready;
    if (!auth.available) { out.innerHTML = `<p class="lb-empty">Bestenlisten gibt es nur auf der Hauptadresse von WebNoah-Games, wo der Server läuft.</p>`; return; }
    const my = ++seq;
    out.innerHTML = `<p class="lb-empty">Lade …</p>`;
    try {
      const d = await auth.api(`leaderboard?game=${game.id}&variant=${encodeURIComponent(variant)}`);
      if (my !== seq) return;
      const rows = d.top.map((r, i) => `
        <li class="${auth.user && r.username.toLowerCase() === auth.user.username.toLowerCase() ? "me" : ""} ${i < 3 ? "top" + (i + 1) : ""}">
          <span class="lb-rank">${i + 1}</span>
          <a class="lb-user" href="${root}profil/?u=${encodeURIComponent(r.username)}">${auth.avatar(r)}<span>${esc(r.display)}<small>@${esc(r.username)}</small></span></a>
          <b class="lb-val">${fmt(game, r.value)}</b>
        </li>`).join("");
      const mine = !auth.user
        ? `<p class="lb-cta"><button class="btn primary" type="button" data-login>Anmelden</button> und mitspielen.</p>`
        : d.mine ? `<p class="lb-cta">Dein Platz: <b>#${d.mine.rank}</b> mit <mark>${fmt(game, d.mine.value)}</mark></p>`
        : `<p class="lb-cta">Noch kein Eintrag von dir. <a href="${root}spiele/${game.id}/">${esc(game.name)} spielen →</a></p>`;
      out.innerHTML = `
        <div class="lb-big-head"><h2 class="display">${esc(game.name)}</h2>
          <span class="eyebrow">${game.better === "low" ? "weniger ist besser" : "mehr ist besser"} · Top 10</span></div>
        ${rows ? `<ol class="lb-list big">${rows}</ol>` : `<p class="lb-empty">Noch niemand eingetragen. Der erste Platz ist frei.</p>`}
        ${mine}`;
      const b = out.querySelector("[data-login]"); if (b) b.onclick = () => auth.open("login");
    } catch (e) { if (my === seq) out.innerHTML = `<p class="lb-empty">${esc(e.message)}</p>`; }
  }
  document.addEventListener("wng:auth", load);
})();
