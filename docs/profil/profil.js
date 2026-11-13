// WebNoah-Games: Profilseite. /profil/?u=name zeigt ein öffentliches Profil, ohne ?u das eigene.
(() => {
  "use strict";
  const { $, h, root, fmt } = WNG;
  const GAMES = window.WNG_GAMES.filter(g => !g.ext);
  const COLORS = ["#38bdf8", "#ff6b5e", "#4ade80", "#e2b552", "#a78bfa", "#2fb3a6", "#f472b6", "#94a3b8"];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const main = $("#profile");
  const date = t => new Date(t).toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });
  const variantName = (v, id) => WNG.variantName(GAMES.find(g => g.id === id), v);

  function message(title, text, withLogin) {
    main.innerHTML = `<div class="notice"><h1 class="display">${title}</h1><p>${text}</p>${withLogin ? `<button class="btn primary" type="button" data-login>Anmelden oder registrieren</button>` : ""}</div>`;
    const b = main.querySelector("[data-login]"); if (b) b.onclick = () => WNG.auth.open("login");
  }

  async function render() {
    const auth = await WNG.auth.ready;
    if (!auth.available) return message("Profile gibt es nur online", "Konten und Profile laufen über den WebNoah-Games-Server. Auf dieser Adresse ist er nicht erreichbar.");
    const wanted = new URLSearchParams(location.search).get("u") || (auth.user && auth.user.username);
    if (!wanted) return message("Dein Profil", "Melde dich an, um dein Profil, deine Rekorde und deinen Spielstand zu sehen.", true);
    main.innerHTML = `<p class="lb-empty">Lade Profil …</p>`;
    let data;
    try { data = await auth.api("users/" + encodeURIComponent(wanted)); }
    catch (e) { return message("Profil nicht gefunden", esc(e.message)); }
    const u = data.user, own = !!auth.user && auth.user.username.toLowerCase() === u.username.toLowerCase();
    document.title = `${u.display} · WebNoah-Games`;
    const plays = data.stats.reduce((s, r) => s + r.plays, 0);
    const recRows = GAMES.flatMap(g => data.records.filter(r => r.game === g.id).map(r => ({ g, r })));
    const statOf = id => data.stats.find(s => s.game === id);

    main.innerHTML = `
      <section class="profile-head">
        ${auth.avatar(u, "xl")}
        <div>
          <p class="eyebrow">${own ? "Dein Profil" : "Profil"}</p>
          <h1 class="display">${esc(u.display)}</h1>
          <p class="muted">@${esc(u.username)} · dabei seit ${date(u.created)}</p>
        </div>
        <div class="profile-stats">
          <div class="stat"><span class="lbl">Partien</span><span class="val">${plays}</span></div>
          <div class="stat"><span class="lbl">Rekorde</span><span class="val">${data.records.length}</span></div>
        </div>
      </section>

      <section class="profile-block">
        <h2 class="display">Rekorde</h2>
        ${recRows.length ? `<div class="table-wrap"><table class="rec-table">
          <thead><tr><th>Spiel</th><th>Rekord</th><th>Partien</th><th>Zuletzt</th></tr></thead>
          <tbody>${recRows.map(({ g, r }) => {
            const st = statOf(g.id);
            return `<tr><td><a href="${WNG.href(g)}">${g.name}</a>${variantName(r.variant, g.id) ? ` <small>${variantName(r.variant, g.id)}</small>` : ""}</td>
              <td><mark>${fmt(g, r.value)}</mark></td><td>${st ? st.plays : "–"}</td><td>${date(r.updated)}</td></tr>`;
          }).join("")}</tbody></table></div>`
          : `<p class="lb-empty">${own ? "Noch keine Rekorde. Such dir ein Spiel aus und leg los." : "Noch keine Rekorde."}</p>`}
      </section>
      ${own ? settingsHtml(u) : ""}`;
    if (own) wireSettings(u);
  }

  function settingsHtml(u) {
    return `
      <section class="profile-block">
        <h2 class="display">Einstellungen</h2>
        <div class="settings">
          <form class="panel" id="f-profile" novalidate>
            <h3>Anzeige</h3>
            <label class="field" for="p-display"><span>Anzeigename</span><input id="p-display" maxlength="24" value="${esc(u.display)}"></label>
            <fieldset class="swatches"><legend>Farbe</legend>
              ${COLORS.map(c => `<label><input type="radio" name="color" value="${c}" ${c === u.color ? "checked" : ""}><span style="--av:${c}" aria-label="Farbe ${c}"></span></label>`).join("")}
            </fieldset>
            <p class="form-error" hidden></p>
            <button class="btn primary" type="submit">Speichern</button>
          </form>
          <form class="panel" id="f-password" novalidate>
            <h3>Passwort ändern</h3>
            <label class="field" for="pw-cur"><span>Aktuelles Passwort</span><input id="pw-cur" type="password" autocomplete="current-password"></label>
            <label class="field" for="pw-new"><span>Neues Passwort</span><input id="pw-new" type="password" autocomplete="new-password" minlength="8"></label>
            <p class="form-error" hidden></p>
            <button class="btn" type="submit">Passwort ändern</button>
          </form>
          <div class="panel">
            <h3>Abmelden</h3>
            <p class="muted">Deine Rekorde bleiben im Konto gespeichert.</p>
            <button class="btn" type="button" id="b-logout">Abmelden</button>
          </div>
          <form class="panel danger" id="f-delete" novalidate>
            <h3>Konto löschen</h3>
            <p class="muted">Löscht dein Konto mit allen Rekorden, Favoriten und Spielständen auf dem Server. Das lässt sich nicht rückgängig machen.</p>
            <label class="field" for="del-pw"><span>Passwort zur Bestätigung</span><input id="del-pw" type="password" autocomplete="current-password"></label>
            <label class="check"><input type="checkbox" id="del-ok"> Ja, mein Konto endgültig löschen</label>
            <p class="form-error" hidden></p>
            <button class="btn danger-btn" type="submit">Konto löschen</button>
          </form>
        </div>
      </section>`;
  }

  function wireSettings() {
    const auth = WNG.auth;
    const errOf = f => f.querySelector(".form-error");
    const fail = (f, m) => { const e = errOf(f); e.textContent = m; e.hidden = false; };
    const busy = (f, on) => f.querySelectorAll("button").forEach(b => b.disabled = on);

    $("#f-profile").addEventListener("submit", async e => {
      e.preventDefault(); const f = e.currentTarget; errOf(f).hidden = true; busy(f, true);
      try {
        const r = await auth.api("me", { method: "PATCH", body: { display: $("#p-display").value, color: f.color.value } });
        auth.setUser(r.user); auth.toast("Gespeichert."); render();
      } catch (ex) { fail(f, ex.message); } finally { busy(f, false); }
    });
    $("#f-password").addEventListener("submit", async e => {
      e.preventDefault(); const f = e.currentTarget; errOf(f).hidden = true;
      if ($("#pw-new").value.length < 8) return fail(f, "Das neue Passwort braucht mindestens 8 Zeichen.");
      busy(f, true);
      try {
        await auth.api("me/password", { method: "POST", body: { current: $("#pw-cur").value, next: $("#pw-new").value } });
        f.reset(); auth.toast("Passwort geändert. Andere Geräte wurden abgemeldet.");
      } catch (ex) { fail(f, ex.message); } finally { busy(f, false); }
    });
    $("#b-logout").onclick = async () => { await auth.logout(); location.href = root; };
    $("#f-delete").addEventListener("submit", async e => {
      e.preventDefault(); const f = e.currentTarget; errOf(f).hidden = true;
      if (!$("#del-ok").checked) return fail(f, "Bitte bestätige das Löschen mit dem Häkchen.");
      busy(f, true);
      try {
        await auth.api("me", { method: "DELETE", body: { password: $("#del-pw").value } });
        auth.setUser(null); auth.toast("Dein Konto wurde gelöscht.");
        setTimeout(() => { location.href = root; }, 900);
      } catch (ex) { fail(f, ex.message); busy(f, false); }
    });
  }

  document.addEventListener("wng:auth", () => { WNG.auth.ready.then(render); });
})();
