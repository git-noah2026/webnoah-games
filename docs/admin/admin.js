// WebNoah-Games: Admin-Portal. Ansichten über den Hash: #uebersicht, #nutzer, #nutzer/NAME, #bestenlisten, #inhalte, #protokoll
(() => {
  "use strict";
  const { $, h, root, fmt, segmented } = WNG;
  const GAMES = window.WNG_GAMES, INTERNAL = GAMES.filter(g => !g.ext);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const main = $("#adm-main");
  const api = (p, o) => WNG.auth.api("admin/" + p, o);
  const date = t => t ? new Date(t).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
  const stamp = t => t ? new Date(t).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";
  const ago = t => {
    if (!t) return "nie";
    const s = (Date.now() - t) / 1000;
    if (s < 90) return "gerade eben";
    if (s < 3600) return `vor ${Math.round(s / 60)} Min`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std`;
    if (s < 86400 * 30) return `vor ${Math.round(s / 86400)} ${Math.round(s / 86400) === 1 ? "Tag" : "Tagen"}`;
    return date(t);
  };
  const game = id => GAMES.find(g => g.id === id) || { id, name: id, unit: "" };
  const variantName = v => v === "klein" ? "9 × 9" : v === "mittel" ? "12 × 12" : "";
  const n = v => Number(v || 0).toLocaleString("de-AT");
  const avatar = u => WNG.auth.avatar(u);
  const userLink = u => `<a class="adm-user" href="#nutzer/${encodeURIComponent(u.username)}">${avatar(u)}<span><b>${esc(u.display)}</b><small>@${esc(u.username)}</small></span></a>`;
  const pills = u => [
    u.owner ? `<span class="pill gold">Haupt-Admin</span>` : u.role === "admin" ? `<span class="pill gold">Admin</span>` : "",
    u.banned ? `<span class="pill red">Gesperrt</span>` : ""
  ].join("");
  const ACTIONS = { update: "Konto geändert", delete: "Konto gelöscht", password: "Passwort zurückgesetzt", logout: "Abgemeldet", records: "Rekorde", settings: "Einstellungen", export: "Export" };

  /* ---------- Bestätigungsdialog ---------- */
  const dlg = $("#adm-dialog");
  function ask({ title, text, ok = "Bestätigen", danger = false, input = null }) {
    return new Promise(resolve => {
      dlg.innerHTML = `
        <form method="dialog" class="adm-ask">
          <h2 class="display">${esc(title)}</h2>
          <p>${text}</p>
          ${input ? `<label class="field"><span>${esc(input.label)}</span><input id="ask-in" autocomplete="off" placeholder="${esc(input.placeholder || "")}" maxlength="${input.max || 140}"></label>` : ""}
          <p class="form-error" hidden></p>
          <div class="adm-ask-actions">
            <button class="btn" type="button" data-no>Abbrechen</button>
            <button class="btn ${danger ? "danger-btn solid" : "primary"}" type="submit">${esc(ok)}</button>
          </div>
        </form>`;
      const form = dlg.querySelector("form"), field = dlg.querySelector("#ask-in"), err = dlg.querySelector(".form-error");
      const done = v => { dlg.close(); resolve(v); };
      dlg.querySelector("[data-no]").onclick = () => done(false);
      dlg.oncancel = e => { e.preventDefault(); done(false); };
      form.onsubmit = e => {
        e.preventDefault();
        if (input && input.match && field.value.trim().toLowerCase() !== input.match.toLowerCase()) { err.textContent = `Bitte genau „${input.match}“ eintippen.`; err.hidden = false; return; }
        done(input ? field.value.trim() : true);
      };
      dlg.showModal();
      setTimeout(() => (field || dlg.querySelector("[type=submit]")).focus(), 30);
    });
  }
  const toast = t => WNG.auth.toast(t);
  async function run(fn, okText) {
    try { const r = await fn(); if (okText) toast(okText); return r; }
    catch (e) { toast(e.message); throw e; }
  }

  /* ---------- Übersicht ---------- */
  async function viewOverview() {
    const s = await api("stats");
    const days = Array.from({ length: 30 }, (_, i) => {
      const day = Math.floor(s.from / 86400000) + i, hit = s.signups.find(r => r.day === day);
      return { day, n: hit ? hit.n : 0 };
    });
    const max = Math.max(1, ...days.map(d => d.n));
    const W = 600, H = 170, bw = W / 30;
    const bars = days.map((d, i) => {
      const bh = d.n ? Math.max(3, (d.n / max) * (H - 34)) : 0, x = i * bw;
      const label = new Date(d.day * 86400000).toLocaleDateString("de-AT", { day: "numeric", month: "numeric" });
      return `<g><rect x="${x + 3}" y="${H - 20 - bh}" width="${bw - 6}" height="${bh}" rx="3" fill="var(--marker)"><title>${label}: ${d.n} ${d.n === 1 ? "Konto" : "Konten"}</title></rect>
        ${d.n === max && d.n ? `<text x="${x + bw / 2}" y="${H - 26 - bh}" text-anchor="middle" class="c-val">${d.n}</text>` : ""}
        ${i % 5 === 0 || i === 29 ? `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" class="c-axis">${i === 29 ? "heute" : label}</text>` : ""}</g>`;
    }).join("");
    const pmax = Math.max(1, ...s.perGame.map(r => r.plays));
    const perGame = INTERNAL.map(g => s.perGame.find(r => r.game === g.id) || { game: g.id, plays: 0, players: 0 }).sort((a, b) => b.plays - a.plays);
    const kpi = (label, value, sub, tone = "") => `<div class="kpi ${tone}"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    main.innerHTML = `
      <header class="adm-head"><div><p class="kicker"><i></i>Übersicht</p><h1 class="display">Lagebericht</h1></div>
        <p class="muted">Stand ${stamp(Date.now())}</p></header>
      ${s.owners === 0 ? `<div class="adm-note warn"><b>Kein Haupt-Admin eingetragen.</b> Setz in Cloudflare unter Worker → Einstellungen → Variablen <code>ADMIN_USERS</code> auf deinen Benutzernamen, damit du dich nie aussperren kannst.</div>` : ""}
      <div class="kpis">
        ${kpi("Konten", n(s.users), `+${n(s.new7)} in 7 Tagen`)}
        ${kpi("Aktiv in 24 h", n(s.active24), s.users ? `${Math.round(s.active24 / s.users * 100)} % aller Konten` : "")}
        ${kpi("Partien", n(s.plays), "mit Konto gespielt")}
        ${kpi("Rekorde", n(s.records), `in ${INTERNAL.length} Spielen`)}
        ${kpi("Angemeldete Geräte", n(s.sessions), "laufende Sitzungen")}
        ${kpi("Gesperrt", n(s.banned), s.banned ? `<a href="#nutzer" data-filter="banned">ansehen →</a>` : "alles ruhig", s.banned ? "red" : "")}
      </div>
      <div class="adm-grid">
        <section class="panel wide"><h3>Neue Konten, letzte 30 Tage</h3>
          <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Neue Konten pro Tag">
            <line x1="0" y1="${H - 20}" x2="${W}" y2="${H - 20}" class="c-base"/>${bars}</svg></section>
        <section class="panel"><h3>Partien pro Spiel</h3>
          <ul class="hbars">${perGame.map(r => `<li><span>${esc(game(r.game).name)}</span><i style="--w:${(r.plays / pmax) * 100}%"></i><b>${n(r.plays)}</b></li>`).join("")}</ul></section>
        <section class="panel"><h3>Fleißigste Spieler</h3>
          ${s.topPlayers.length ? `<ol class="adm-list">${s.topPlayers.map(u => `<li>${userLink(u)}<b>${n(u.plays)} Partien</b></li>`).join("")}</ol>` : `<p class="muted">Noch keine Partien mit Konto.</p>`}</section>
        <section class="panel"><h3>Neueste Konten</h3>
          ${s.newest.length ? `<ol class="adm-list">${s.newest.map(u => `<li>${userLink(u)}<small>${ago(u.created)}</small></li>`).join("")}</ol>` : `<p class="muted">Noch keine Konten.</p>`}</section>
      </div>`;
    const bl = main.querySelector("[data-filter=banned]"); if (bl) bl.onclick = () => { users.filter = "banned"; };
  }

  /* ---------- Nutzerliste ---------- */
  const users = { q: "", filter: "all", sort: "created", dir: "desc", page: 0 };
  let searchT = 0;
  async function viewUsers() {
    main.innerHTML = `
      <header class="adm-head"><div><p class="kicker"><i></i>Nutzer</p><h1 class="display">Konten verwalten</h1></div>
        <a class="btn" href="${root}api/admin/export.csv" download>CSV exportieren</a></header>
      <div class="adm-toolbar">
        <label class="search" for="u-q"><span class="sr">Konten suchen</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="u-q" type="search" placeholder="Name oder Anzeigename …" value="${esc(users.q)}" autocomplete="off"></label>
        <div id="u-filter"></div>
        <label class="adm-select" for="u-sort"><span class="sr">Sortieren</span>
          <select id="u-sort">
            ${[["created", "Neueste zuerst"], ["last_seen", "Zuletzt aktiv"], ["plays", "Meiste Partien"], ["recs", "Meiste Rekorde"], ["username", "Name A–Z"]].map(([v, l]) => `<option value="${v}" ${users.sort === v ? "selected" : ""}>${l}</option>`).join("")}
          </select></label>
      </div>
      <div class="table-wrap"><table class="adm-table" id="u-table"><thead><tr>
        <th>Konto</th><th>Status</th><th class="num">Partien</th><th class="num">Rekorde</th><th>Registriert</th><th>Zuletzt aktiv</th></tr></thead><tbody><tr><td colspan="6" class="muted">Lade …</td></tr></tbody></table></div>
      <div class="adm-pager" id="u-pager"></div>`;
    segmented($("#u-filter"), [["all", "Alle"], ["active", "Aktiv (7 Tage)"], ["admins", "Admins"], ["banned", "Gesperrt"]], users.filter, v => { users.filter = v; users.page = 0; loadUsers(); });
    $("#u-q").addEventListener("input", e => { clearTimeout(searchT); searchT = setTimeout(() => { users.q = e.target.value.trim(); users.page = 0; loadUsers(); }, 250); });
    $("#u-sort").addEventListener("change", e => { users.sort = e.target.value; users.dir = e.target.value === "username" ? "asc" : "desc"; users.page = 0; loadUsers(); });
    await loadUsers();
  }
  async function loadUsers() {
    const p = new URLSearchParams({ q: users.q, filter: users.filter, sort: users.sort, dir: users.dir, page: users.page });
    const d = await api("users?" + p);
    const body = $("#u-table tbody"); if (!body) return;
    body.innerHTML = d.users.length ? d.users.map(u => `
      <tr data-u="${esc(u.username)}" tabindex="0">
        <td>${userLink(u)}</td><td>${pills(u) || `<span class="pill">Spieler</span>`}</td>
        <td class="num">${n(u.plays)}</td><td class="num">${n(u.recs)}</td>
        <td>${date(u.created)}</td><td>${ago(u.last_seen)}</td></tr>`).join("")
      : `<tr><td colspan="6" class="muted">Keine Konten gefunden.</td></tr>`;
    body.querySelectorAll("tr[data-u]").forEach(tr => {
      const go = () => { location.hash = "nutzer/" + encodeURIComponent(tr.dataset.u); };
      tr.addEventListener("click", e => { if (!e.target.closest("a")) go(); });
      tr.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
    });
    const from = d.total ? d.page * d.per + 1 : 0, to = Math.min(d.total, (d.page + 1) * d.per);
    $("#u-pager").innerHTML = `<span>${from}–${to} von ${n(d.total)}</span>
      <button class="btn" type="button" data-p="-1" ${d.page === 0 ? "disabled" : ""}>← Zurück</button>
      <button class="btn" type="button" data-p="1" ${to >= d.total ? "disabled" : ""}>Weiter →</button>`;
    $("#u-pager").querySelectorAll("[data-p]").forEach(b => b.onclick = () => { users.page += +b.dataset.p; loadUsers(); });
  }

  /* ---------- Konto im Detail ---------- */
  async function viewUser(name) {
    const d = await api("users/" + encodeURIComponent(name));
    const u = d.user, locked = d.self || u.owner;
    const lockNote = d.self ? "Bei deinem eigenen Konto nicht möglich." : u.owner ? "Haupt-Admins aus ADMIN_USERS sind geschützt." : "";
    const totalPlays = d.stats.reduce((a, s) => a + s.plays, 0);
    main.innerHTML = `
      <a class="back" href="#nutzer">← Alle Konten</a>
      <header class="adm-profile">
        ${WNG.auth.avatar(u, "xl")}
        <div><h1 class="display">${esc(u.display)}</h1>
          <p class="muted">@${esc(u.username)} · registriert ${date(u.created)} · zuletzt aktiv ${ago(u.last_seen)}</p>
          <div class="pills">${pills(u) || `<span class="pill">Spieler</span>`}${u.banned && u.ban_reason ? `<span class="muted">Grund: ${esc(u.ban_reason)}</span>` : ""}</div></div>
        <div class="adm-profile-stats">
          <div class="stat"><span class="lbl">Partien</span><span class="val">${n(totalPlays)}</span></div>
          <div class="stat"><span class="lbl">Rekorde</span><span class="val">${d.records.length}</span></div>
          <div class="stat"><span class="lbl">Geräte</span><span class="val">${d.sessions}</span></div>
        </div>
      </header>
      ${u.banned ? "" : `<p><a class="muted-link" href="${root}profil/?u=${encodeURIComponent(u.username)}" target="_blank" rel="noopener">Öffentliches Profil ansehen ↗</a></p>`}
      <div class="adm-grid">
        <section class="panel"><h3>Anzeigename</h3>
          <form class="inline-form" id="f-display"><input class="input" id="in-display" maxlength="24" value="${esc(u.display)}" aria-label="Anzeigename"><button class="btn" type="submit">Speichern</button></form>
          <p class="muted small">Für unpassende Namen. Der Benutzername bleibt gleich.</p></section>
        <section class="panel"><h3>Rolle</h3>
          <p class="small">${u.role === "admin" ? "Darf das Admin-Portal benutzen." : "Normales Spielerkonto."}</p>
          <button class="btn" type="button" id="b-role" ${locked ? "disabled" : ""}>${u.role === "admin" ? "Admin-Rechte entziehen" : "Zum Admin ernennen"}</button>
          ${locked ? `<p class="muted small">${lockNote}</p>` : ""}</section>
        <section class="panel ${u.banned ? "" : "danger"}"><h3>${u.banned ? "Gesperrt" : "Sperren"}</h3>
          <p class="small">${u.banned ? "Kann sich nicht anmelden und taucht in keiner Bestenliste auf." : "Meldet überall ab, blockiert die Anmeldung und blendet Rekorde aus den Bestenlisten aus."}</p>
          <button class="btn ${u.banned ? "" : "danger-btn"}" type="button" id="b-ban" ${locked ? "disabled" : ""}>${u.banned ? "Entsperren" : "Konto sperren"}</button>
          ${locked ? `<p class="muted small">${lockNote}</p>` : ""}</section>
        <section class="panel"><h3>Zugang</h3>
          <p class="small">${d.sessions} ${d.sessions === 1 ? "Gerät ist" : "Geräte sind"} angemeldet.</p>
          <div class="btn-row">
            <button class="btn" type="button" id="b-logout" ${d.sessions ? "" : "disabled"}>Überall abmelden</button>
            <button class="btn" type="button" id="b-pw" ${d.self ? "disabled" : ""}>Temporäres Passwort</button>
          </div>
          <div id="pw-out"></div></section>

        <section class="panel wide"><div class="panel-head"><h3>Rekorde</h3>
          ${d.records.length ? `<button class="btn danger-btn small-btn" type="button" id="b-recs-all">Alle Rekorde löschen</button>` : ""}</div>
          ${d.records.length ? `<div class="table-wrap"><table class="adm-table"><thead><tr><th>Spiel</th><th class="num">Wert</th><th>Partien</th><th>Erreicht</th><th></th></tr></thead><tbody>
            ${d.records.map(r => { const st = d.stats.find(s => s.game === r.game); return `<tr><td>${esc(game(r.game).name)} ${variantName(r.variant) ? `<small class="muted">${variantName(r.variant)}</small>` : ""}</td>
              <td class="num"><mark>${fmt(game(r.game), r.value)}</mark></td><td>${st ? n(st.plays) : "–"}</td><td>${stamp(r.updated)}</td>
              <td class="num"><button class="btn small-btn" type="button" data-rec="${r.game}|${r.variant}">Löschen</button></td></tr>`; }).join("")}
          </tbody></table></div>` : `<p class="muted">Keine Rekorde.</p>`}</section>

        <section class="panel wide"><h3>Protokoll zu diesem Konto</h3>
          ${d.log.length ? `<ul class="log-list">${d.log.map(l => `<li><time>${stamp(l.at)}</time><b>${esc(ACTIONS[l.action] || l.action)}</b><span>${esc(l.detail || "")}</span><small>von @${esc(l.admin)}</small></li>`).join("")}</ul>` : `<p class="muted">Noch keine Admin-Aktionen.</p>`}</section>

        <section class="panel wide danger"><h3>Konto löschen</h3>
          <p class="small">Löscht das Konto mit allen Rekorden, Favoriten, Spielständen und Statistiken. Das lässt sich nicht rückgängig machen.</p>
          <button class="btn danger-btn" type="button" id="b-delete" ${locked ? "disabled" : ""}>Konto endgültig löschen</button>
          ${locked ? `<p class="muted small">${lockNote}</p>` : ""}</section>
      </div>`;

    const reload = () => viewUser(name);
    const patch = (b, ok) => run(() => api("users/" + encodeURIComponent(u.username), { method: "PATCH", body: b }), ok).then(reload, () => {});
    $("#f-display").onsubmit = e => { e.preventDefault(); patch({ display: $("#in-display").value }, "Anzeigename gespeichert."); };
    $("#b-role").onclick = async () => {
      const promote = u.role !== "admin";
      if (await ask({ title: promote ? "Zum Admin ernennen?" : "Admin-Rechte entziehen?", text: promote ? `<b>@${esc(u.username)}</b> bekommt vollen Zugriff auf das Admin-Portal: Konten sperren, löschen, Passwörter zurücksetzen.` : `<b>@${esc(u.username)}</b> verliert den Zugriff auf das Admin-Portal.`, ok: promote ? "Ernennen" : "Entziehen", danger: !promote }))
        patch({ role: promote ? "admin" : "user" }, promote ? "Ist jetzt Admin." : "Admin-Rechte entzogen.");
    };
    $("#b-ban").onclick = async () => {
      if (u.banned) { if (await ask({ title: "Konto entsperren?", text: `<b>@${esc(u.username)}</b> kann sich wieder anmelden, und die Rekorde erscheinen wieder in den Bestenlisten.`, ok: "Entsperren" })) patch({ banned: false }, "Konto entsperrt."); return; }
      const reason = await ask({ title: "Konto sperren?", text: `<b>@${esc(u.username)}</b> wird sofort auf allen Geräten abgemeldet. Den Grund sieht die Person beim Anmelden.`, ok: "Sperren", danger: true, input: { label: "Grund (optional)", placeholder: "z. B. Beleidigender Name" } });
      if (reason !== false) patch({ banned: true, ban_reason: reason }, "Konto gesperrt.");
    };
    $("#b-logout").onclick = async () => {
      if (await ask({ title: "Überall abmelden?", text: `Alle ${d.sessions} Sitzungen von <b>@${esc(u.username)}</b> werden beendet.`, ok: "Abmelden" }))
        run(() => api(`users/${encodeURIComponent(u.username)}/logout`, { method: "POST", body: {} }), "Abgemeldet.").then(reload, () => {});
    };
    $("#b-pw").onclick = async () => {
      if (!await ask({ title: "Temporäres Passwort erzeugen?", text: `Das bisherige Passwort von <b>@${esc(u.username)}</b> funktioniert danach nicht mehr, und alle Geräte werden abgemeldet.`, ok: "Erzeugen", danger: true })) return;
      try {
        const r = await api(`users/${encodeURIComponent(u.username)}/password`, { method: "POST", body: {} });
        $("#pw-out").innerHTML = `<div class="pw-box"><code id="pw-code">${esc(r.password)}</code><button class="btn small-btn" type="button" id="pw-copy">Kopieren</button>
          <p class="small">Gib es <b>@${esc(u.username)}</b> persönlich weiter. Es wird nur jetzt angezeigt. Danach im Profil ein eigenes Passwort setzen.</p></div>`;
        $("#pw-copy").onclick = () => navigator.clipboard.writeText(r.password).then(() => toast("Kopiert."), () => { const sel = getSelection(), rg = document.createRange(); rg.selectNodeContents($("#pw-code")); sel.removeAllRanges(); sel.addRange(rg); });
      } catch (e) { toast(e.message); }
    };
    main.querySelectorAll("[data-rec]").forEach(b => b.onclick = async () => {
      const [g, v] = b.dataset.rec.split("|");
      if (await ask({ title: "Rekord löschen?", text: `Der Rekord von <b>@${esc(u.username)}</b> in <b>${esc(game(g).name)}</b> verschwindet aus der Bestenliste.`, ok: "Löschen", danger: true }))
        run(() => api(`users/${encodeURIComponent(u.username)}/records`, { method: "DELETE", body: { game: g, variant: v } }), "Rekord gelöscht.").then(reload, () => {});
    });
    const all = $("#b-recs-all");
    if (all) all.onclick = async () => {
      if (await ask({ title: "Alle Rekorde löschen?", text: `Alle ${d.records.length} Rekorde von <b>@${esc(u.username)}</b> werden entfernt.`, ok: "Alle löschen", danger: true }))
        run(() => api(`users/${encodeURIComponent(u.username)}/records`, { method: "DELETE", body: { game: "*" } }), "Rekorde gelöscht.").then(reload, () => {});
    };
    $("#b-delete").onclick = async () => {
      const ok = await ask({ title: "Konto endgültig löschen?", text: `Alle Daten von <b>@${esc(u.username)}</b> werden gelöscht. Tipp zur Bestätigung den Benutzernamen ein.`, ok: "Endgültig löschen", danger: true, input: { label: "Benutzername", placeholder: u.username, match: u.username } });
      if (ok === false) return;
      run(() => api("users/" + encodeURIComponent(u.username), { method: "DELETE", body: {} }), "Konto gelöscht.").then(() => { location.hash = "nutzer"; }, () => {});
    };
  }

  /* ---------- Bestenlisten ---------- */
  const lb = { game: INTERNAL[0].id, variant: INTERNAL[0].variant || "" };
  async function viewBoards() {
    main.innerHTML = `
      <header class="adm-head"><div><p class="kicker"><i></i>Bestenlisten</p><h1 class="display">Einträge prüfen</h1></div></header>
      <div class="adm-toolbar">
        <label class="adm-select" for="lb-game"><span class="sr">Spiel</span><select id="lb-game">${INTERNAL.map(g => `<option value="${g.id}" ${g.id === lb.game ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></label>
        <div id="lb-var"></div>
      </div>
      <div id="lb-body"><p class="muted">Lade …</p></div>`;
    $("#lb-game").onchange = e => { lb.game = e.target.value; lb.variant = game(lb.game).variant || ""; viewBoards(); };
    if (lb.game === "minen") segmented($("#lb-var"), [["klein", "9 × 9"], ["mittel", "12 × 12"]], lb.variant, v => { lb.variant = v; loadBoard(); });
    await loadBoard();
  }
  async function loadBoard() {
    const d = await api(`leaderboard?game=${lb.game}&variant=${encodeURIComponent(lb.variant)}`), g = game(lb.game);
    $("#lb-body").innerHTML = `
      <p class="muted small">${n(d.total)} Einträge · ${d.better === "low" ? "weniger ist besser" : "mehr ist besser"} · erlaubter Bereich ${fmt(g, d.min)} bis ${fmt(g, d.max)}. Gesperrte Konten sind markiert und öffentlich ausgeblendet.</p>
      ${d.rows.length ? `<div class="table-wrap"><table class="adm-table"><thead><tr><th class="num">#</th><th>Konto</th><th class="num">Wert</th><th>Erreicht</th><th></th></tr></thead><tbody>
        ${d.rows.map((r, i) => `<tr class="${r.banned ? "is-banned" : ""}"><td class="num">${i + 1}</td><td>${userLink(r)} ${r.banned ? `<span class="pill red">Gesperrt</span>` : ""}</td>
          <td class="num"><mark>${fmt(g, r.value)}</mark></td><td>${stamp(r.updated)}</td>
          <td class="num"><button class="btn small-btn" type="button" data-del="${esc(r.username)}">Löschen</button></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="lb-empty">Noch keine Einträge.</p>`}`;
    $("#lb-body").querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      const name = b.dataset.del;
      if (await ask({ title: "Eintrag löschen?", text: `Der Rekord von <b>@${esc(name)}</b> in <b>${esc(g.name)}</b> wird entfernt. Die Person kann danach einen neuen aufstellen.`, ok: "Löschen", danger: true }))
        run(() => api(`users/${encodeURIComponent(name)}/records`, { method: "DELETE", body: { game: lb.game, variant: lb.variant } }), "Eintrag gelöscht.").then(loadBoard, () => {});
    });
  }

  /* ---------- Inhalte ---------- */
  async function viewContent() {
    const s = await api("settings");
    const a = s.announcement || { text: "", level: "info" };
    let level = a.level;
    main.innerHTML = `
      <header class="adm-head"><div><p class="kicker"><i></i>Inhalte</p><h1 class="display">Ankündigung und Spiele</h1></div></header>
      <div class="adm-grid">
        <section class="panel wide"><h3>Ankündigung</h3>
          <p class="small muted">Erscheint als Leiste oben auf jeder Seite. Wer sie wegklickt, sieht sie erst bei einer neuen Ankündigung wieder.</p>
          <label class="field" for="ann-text"><span>Text <small id="ann-count"></small></span>
            <textarea id="ann-text" class="input" rows="3" maxlength="280" placeholder="z. B. Neues Spiel: Minigolf mit sechs Bahnen!">${esc(a.text)}</textarea></label>
          <div class="btn-row"><div id="ann-level"></div></div>
          <p class="small muted">Vorschau</p>
          <div id="ann-preview"></div>
          <div class="btn-row">
            <button class="btn primary" type="button" id="ann-save">Veröffentlichen</button>
            <button class="btn" type="button" id="ann-clear" ${s.announcement ? "" : "disabled"}>Entfernen</button>
          </div></section>
        <section class="panel wide"><div class="panel-head"><h3>Spiele</h3><span class="muted small" id="g-count"></span></div>
          <p class="small muted">Pausierte Spiele verschwinden aus der Bibliothek. Wer einen direkten Link hat, sieht einen Hinweis. Admins können pausierte Spiele weiter testen.</p>
          <ul class="toggles">${GAMES.map(g => `<li><label class="switch"><input type="checkbox" data-g="${g.id}" ${s.disabled.includes(g.id) ? "" : "checked"}><span></span></label>
            <b>${esc(g.name)}</b><small class="muted">${esc(g.cats[0])}${g.ext ? " · extern" : ""}</small></li>`).join("")}</ul>
          <div class="btn-row"><button class="btn primary" type="button" id="g-save">Spiele speichern</button></div></section>
      </div>`;
    const ta = $("#ann-text");
    const preview = () => {
      $("#ann-count").textContent = `${ta.value.length} / 280`;
      $("#ann-preview").innerHTML = ta.value.trim() ? `<div class="announce lvl-${level} static"><div class="announce-in"><span class="announce-ico" aria-hidden="true"></span><p>${esc(ta.value.trim())}</p></div></div>` : `<p class="muted small">Kein Text, keine Leiste.</p>`;
    };
    segmented($("#ann-level"), [["info", "Info"], ["success", "Neuigkeit"], ["warn", "Warnung"]], level, v => { level = v; preview(); });
    ta.addEventListener("input", preview); preview();
    $("#ann-save").onclick = () => {
      if (!ta.value.trim()) return toast("Bitte zuerst einen Text eingeben.");
      run(() => api("settings", { method: "PUT", body: { announcement: { text: ta.value, level } } }), "Ankündigung veröffentlicht.").then(viewContent, () => {});
    };
    $("#ann-clear").onclick = async () => {
      if (await ask({ title: "Ankündigung entfernen?", text: "Die Leiste verschwindet sofort auf allen Seiten.", ok: "Entfernen" }))
        run(() => api("settings", { method: "PUT", body: { announcement: null } }), "Ankündigung entfernt.").then(viewContent, () => {});
    };
    const count = () => { const off = main.querySelectorAll("[data-g]:not(:checked)").length; $("#g-count").textContent = off ? `${off} pausiert` : "alle aktiv"; };
    main.querySelectorAll("[data-g]").forEach(c => c.onchange = count); count();
    $("#g-save").onclick = () => {
      const disabled = [...main.querySelectorAll("[data-g]:not(:checked)")].map(c => c.dataset.g);
      run(() => api("settings", { method: "PUT", body: { disabled } }), disabled.length ? `${disabled.length} ${disabled.length === 1 ? "Spiel" : "Spiele"} pausiert.` : "Alle Spiele aktiv.").then(viewContent, () => {});
    };
  }

  /* ---------- Protokoll ---------- */
  let logPage = 0;
  async function viewLog() {
    const d = await api("log?page=" + logPage);
    const from = d.total ? d.page * d.per + 1 : 0, to = Math.min(d.total, (d.page + 1) * d.per);
    main.innerHTML = `
      <header class="adm-head"><div><p class="kicker"><i></i>Protokoll</p><h1 class="display">Wer hat was gemacht</h1></div></header>
      ${d.rows.length ? `<div class="table-wrap"><table class="adm-table"><thead><tr><th>Zeitpunkt</th><th>Admin</th><th>Aktion</th><th>Konto</th><th>Details</th></tr></thead><tbody>
        ${d.rows.map(l => `<tr><td>${stamp(l.at)}</td><td>@${esc(l.admin)}</td><td><span class="pill act-${esc(l.action)}">${esc(ACTIONS[l.action] || l.action)}</span></td>
          <td>${l.target ? `<a href="#nutzer/${encodeURIComponent(l.target)}">@${esc(l.target)}</a>` : "–"}</td><td class="wrap">${esc(l.detail || "")}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="adm-pager"><span>${from}–${to} von ${n(d.total)}</span>
        <button class="btn" type="button" data-p="-1" ${d.page === 0 ? "disabled" : ""}>← Neuer</button>
        <button class="btn" type="button" data-p="1" ${to >= d.total ? "disabled" : ""}>Älter →</button></div>`
      : `<p class="lb-empty">Noch keine Admin-Aktionen.</p>`}`;
    main.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { logPage += +b.dataset.p; viewLog(); });
  }

  /* ---------- Navigation ---------- */
  const VIEWS = { uebersicht: viewOverview, nutzer: viewUsers, bestenlisten: viewBoards, inhalte: viewContent, protokoll: viewLog };
  let seq = 0;
  async function route() {
    const [view, arg] = decodeURIComponent(location.hash.slice(1)).split("/");
    const key = VIEWS[view] ? view : "uebersicht";
    document.querySelectorAll("#adm-nav a").forEach(a => a.setAttribute("aria-current", String(a.dataset.v === key)));
    const my = ++seq;
    main.innerHTML = `<p class="muted adm-loading">Lade …</p>`;
    try { await (key === "nutzer" && arg ? viewUser(arg) : VIEWS[key]()); }
    catch (e) { if (my === seq) main.innerHTML = `<div class="adm-note warn"><b>Das hat nicht geklappt.</b> ${esc(e.message)}</div>`; }
    if (my === seq) main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function gate(title, text, login) {
    $("#adm").classList.add("locked");
    main.innerHTML = `<div class="notice"><h1 class="display">${title}</h1><p>${text}</p>${login ? `<button class="btn primary" type="button" id="adm-login">Anmelden</button>` : `<a class="btn" href="${root}">Zur Startseite</a>`}</div>`;
    const b = $("#adm-login"); if (b) b.onclick = () => WNG.auth.open("login");
  }
  async function start() {
    const auth = await WNG.auth.ready;
    if (!auth.available) return gate("Admin-Portal nicht erreichbar", "Das Portal braucht den WebNoah-Games-Server. Auf dieser Adresse läuft er nicht.");
    if (!auth.user) return gate("Admin-Portal", "Bitte melde dich mit einem Admin-Konto an.", true);
    if (auth.user.role !== "admin") return gate("Kein Zugriff", "Dieses Konto hat keine Admin-Rechte. Ein Admin kann dich im Portal dazu ernennen.");
    $("#adm").classList.remove("locked");
    $("#adm-me").innerHTML = `${WNG.auth.avatar(auth.user)}<span><b>${esc(auth.user.display)}</b><small>@${esc(auth.user.username)}</small></span>`;
    route();
  }
  addEventListener("hashchange", () => { if (WNG.auth.user && WNG.auth.user.role === "admin") route(); });
  document.addEventListener("wng:auth", () => WNG.auth.ready.then(start));
})();
