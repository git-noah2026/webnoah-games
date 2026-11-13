// WebNoah-Games: Konto (Anmelden, Registrieren, Abgleich von Rekorden, Favoriten und Spielständen).
// Läuft nur, wenn die API unter /api erreichbar ist (Cloudflare). Auf GitHub Pages bleibt alles lokal.
(() => {
  "use strict";
  const { $, h, store, bestKey, root } = WNG;
  const GAMES = () => (window.WNG_GAMES || []).filter(g => !g.ext);
  const variantsOf = g => g.variants ? g.variants.map(v => v[0]) : [""];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const auth = { user: null, available: false };
  let readyResolve; auth.ready = new Promise(r => { readyResolve = r; });

  async function api(path, opts = {}) {
    const init = { method: opts.method || "GET", credentials: "same-origin", headers: {} };
    if (opts.body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), opts.timeout || 8000); init.signal = ctrl.signal;
    let res;
    try { res = await fetch(root + "api/" + path, init); }
    catch { throw new Error("Keine Verbindung zum Server. Bitte später nochmal versuchen."); }
    finally { clearTimeout(t); }
    let data = null;
    try { data = await res.json(); } catch { /* keine JSON-Antwort */ }
    if (!res.ok) { const e = new Error((data && data.error) || `Fehler ${res.status}`); e.status = res.status; throw e; }
    return data;
  }
  auth.api = api;

  const emit = () => document.dispatchEvent(new CustomEvent("wng:auth", { detail: auth.user }));

  /* ---------- Abgleich ---------- */
  function localRecords() {
    const out = [];
    for (const g of GAMES()) for (const v of variantsOf(g)) {
      const val = store.get(bestKey(g.id, v));
      if (typeof val === "number") out.push({ game: g.id, variant: v, value: val });
    }
    return out;
  }
  function apply(state) {
    for (const r of state.records || []) store.set(bestKey(r.game, r.variant), r.value);
    if (Array.isArray(state.favs)) store.set("wng:favs", state.favs);
    for (const [game, data] of Object.entries(state.saves || {})) store.set("wng:save:" + game, data);
    auth.stats = state.stats || {};
    document.dispatchEvent(new CustomEvent("wng:sync"));
  }
  async function merge() { apply(await api("sync", { method: "POST", body: { records: localRecords(), favs: WNG.favs.all() } })); }

  // Wird von shell.js und cards.js aufgerufen
  WNG.cloud = {
    record(game, variant, value) {
      if (!auth.user) return Promise.resolve(null);
      return api("records", { method: "POST", body: { game, variant: variant || "", value } }).catch(() => null);
    },
    favs() { if (auth.user) api("favs", { method: "PUT", body: { favs: WNG.favs.all() } }).catch(() => {}); },
    save(game, data) {
      store.set("wng:save:" + game, data);
      if (auth.user) api("saves/" + game, { method: "PUT", body: { data } }).catch(() => {});
    },
    load: game => store.get("wng:save:" + game),
    clear(game) {
      try { localStorage.removeItem("wng:save:" + game); } catch { /* egal */ }
      if (auth.user) api("saves/" + game, { method: "DELETE", body: {} }).catch(() => {});
    }
  };

  /* ---------- Anmelden / Registrieren ---------- */
  async function login(username, password) { const r = await api("login", { method: "POST", body: { username, password } }); auth.user = r.user; await merge(); paint(); emit(); }
  async function register(username, password) { const r = await api("register", { method: "POST", body: { username, password } }); auth.user = r.user; await merge(); paint(); emit(); }
  async function logout() { try { await api("logout", { method: "POST", body: {} }); } catch { /* trotzdem lokal abmelden */ } auth.user = null; paint(); emit(); }
  auth.logout = logout;
  auth.setUser = u => { auth.user = u; paint(); emit(); };

  let dialog = null, mode = "login";
  function openDialog(which = "login") {
    if (!dialog) buildDialog();
    setMode(which);
    dialog.querySelector("form").reset();
    dialog.querySelector(".form-error").hidden = true;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    setTimeout(() => dialog.querySelector("#auth-user").focus(), 30);
  }
  auth.open = openDialog;
  function setMode(which) {
    mode = which;
    dialog.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    dialog.querySelector("#auth-title").textContent = mode === "login" ? "Willkommen zurück" : "Konto erstellen";
    dialog.querySelector("#auth-confirm-row").hidden = mode === "login";
    dialog.querySelector("#auth-confirm").required = mode === "register";
    dialog.querySelector("#auth-pass").autocomplete = mode === "login" ? "current-password" : "new-password";
    dialog.querySelector("#auth-submit").textContent = mode === "login" ? "Anmelden" : "Konto erstellen";
    dialog.querySelector("#auth-hint").innerHTML = mode === "login"
      ? "Noch kein Konto? Oben auf <b>Registrieren</b> tippen."
      : "Keine E-Mail nötig. Merk dir dein Passwort gut: Zurücksetzen kann nur der Admin.";
  }
  function buildDialog() {
    dialog = h("dialog", "auth-dialog");
    dialog.setAttribute("aria-labelledby", "auth-title");
    dialog.innerHTML = `
      <form method="dialog" novalidate>
        <button class="close" type="button" aria-label="Schließen">×</button>
        <div class="seg auth-tabs" role="group">
          <button type="button" data-mode="login">Anmelden</button>
          <button type="button" data-mode="register">Registrieren</button>
        </div>
        <h2 class="display" id="auth-title">Willkommen zurück</h2>
        <p class="auth-sub">Mit Konto landen deine Rekorde in der Bestenliste und sind auf jedem Gerät da.</p>
        <label class="field" for="auth-user"><span>Benutzername</span>
          <input id="auth-user" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" required pattern="[A-Za-z0-9_.\\-]{3,20}">
        </label>
        <label class="field" for="auth-pass"><span>Passwort</span>
          <input id="auth-pass" name="password" type="password" minlength="8" maxlength="200" required>
        </label>
        <label class="field" id="auth-confirm-row" for="auth-confirm" hidden><span>Passwort wiederholen</span>
          <input id="auth-confirm" name="confirm" type="password" autocomplete="new-password" maxlength="200">
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn primary wide" id="auth-submit" type="submit">Anmelden</button>
        <p class="auth-hint" id="auth-hint"></p>
      </form>`;
    document.body.append(dialog);
    const form = dialog.querySelector("form"), err = dialog.querySelector(".form-error"), btn = dialog.querySelector("#auth-submit");
    const close = () => { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); };
    dialog.querySelector(".close").onclick = close;
    dialog.addEventListener("click", e => { if (e.target === dialog) close(); });
    dialog.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { setMode(b.dataset.mode); err.hidden = true; });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const u = form.username.value.trim(), p = form.password.value;
      const show = msg => { err.textContent = msg; err.hidden = false; };
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(u)) return show("Benutzername: 3 bis 20 Zeichen, nur Buchstaben, Ziffern, Punkt, Minus und Unterstrich.");
      if (p.length < 8) return show("Das Passwort braucht mindestens 8 Zeichen.");
      if (mode === "register" && p !== form.confirm.value) return show("Die beiden Passwörter sind nicht gleich.");
      btn.disabled = true; btn.textContent = mode === "login" ? "Melde an …" : "Erstelle Konto …";
      try {
        if (mode === "login") await login(u, p); else await register(u, p);
        close();
        toast(mode === "login" ? `Angemeldet als ${auth.user.display}.` : `Willkommen, ${auth.user.display}! Deine Rekorde werden jetzt gespeichert.`);
      } catch (ex) { show(ex.message); }
      finally { btn.disabled = false; setMode(mode); }
    });
  }

  function toast(text) {
    const t = h("div", "toast", esc(text)); t.setAttribute("role", "status");
    document.body.append(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  auth.toast = toast;

  /* ---------- Konto in der Kopfzeile ---------- */
  function avatar(u, size = "") { return `<span class="avatar ${size}" style="--av:${esc(u.color)}" aria-hidden="true">${esc(u.display.slice(0, 1).toUpperCase())}</span>`; }
  auth.avatar = avatar;
  let menuWired = false, closeMenu = null;
  function paint() {
    const slot = $("#account-slot"); if (!slot) return;
    if (!auth.available) { slot.innerHTML = ""; return; }
    if (!auth.user) {
      slot.innerHTML = `<button class="btn login-btn" type="button">Anmelden</button>`;
      slot.querySelector("button").onclick = () => openDialog("login");
      return;
    }
    const u = auth.user;
    slot.innerHTML = `
      <div class="account">
        <button class="account-btn" type="button" aria-expanded="false" aria-haspopup="true">${avatar(u)}<span class="account-name">${esc(u.display)}</span></button>
        <div class="account-menu" hidden>
          <div class="account-head">${avatar(u, "lg")}<div><b>${esc(u.display)}</b><span>@${esc(u.username)}</span></div></div>
          <a href="${root}profil/">Mein Profil</a>
          <a href="${root}bestenliste/">Bestenliste</a>
          ${u.role === "admin" ? `<a href="${root}admin/" class="admin-link">Admin-Portal</a>` : ""}
          <button type="button" data-logout>Abmelden</button>
        </div>
      </div>`;
    const btn = slot.querySelector(".account-btn"), menu = slot.querySelector(".account-menu");
    const set = open => { menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    btn.onclick = e => { e.stopPropagation(); set(menu.hidden); };
    closeMenu = () => set(false);
    if (!menuWired) {
      menuWired = true;
      document.addEventListener("click", e => { const s = $("#account-slot"); if (s && !s.contains(e.target) && closeMenu) closeMenu(); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && closeMenu) closeMenu(); });
    }
    slot.querySelector("[data-logout]").onclick = async () => { await logout(); toast("Abgemeldet. Deine Rekorde bleiben auch auf diesem Gerät."); };
  }

  /* ---------- Ankündigung und pausierte Spiele (vom Admin-Portal) ---------- */
  auth.settings = { announcement: null, disabled: [] };
  function banner() {
    const old = document.querySelector(".announce:not(.static)"); if (old) old.remove();
    const a = auth.settings.announcement;
    // Im Spiel stört die Leiste nur, sie erscheint im Hauptmenü
    if (document.body.classList.contains("game-page")) return;
    if (!a || !a.text || store.get("wng:ann:" + a.id)) return;
    const el = h("div", `announce lvl-${a.level}`);
    el.setAttribute("role", "status");
    el.innerHTML = `<div class="announce-in"><span class="announce-ico" aria-hidden="true"></span><p>${esc(a.text)}</p><button type="button" aria-label="Ankündigung ausblenden">×</button></div>`;
    el.querySelector("button").onclick = () => { store.set("wng:ann:" + a.id, 1); el.remove(); };
    const bar = document.querySelector(".bar");
    if (bar) bar.after(el); else document.body.prepend(el);
  }
  async function loadSettings() {
    try { auth.settings = await api("settings", { timeout: 5000 }); } catch { return; }
    banner();
    document.dispatchEvent(new CustomEvent("wng:settings", { detail: auth.settings }));
  }

  async function init() {
    paint();
    try {
      const r = await api("me", { timeout: 5000 });
      if (!r || !("user" in r)) throw new Error("keine API");
      auth.available = true; auth.user = r.user;
      if (auth.user) { try { apply(await api("sync")); } catch { /* offline: lokale Daten nutzen */ } }
    } catch { auth.available = false; auth.user = null; }
    paint(); emit(); readyResolve(auth);
    if (auth.available) loadSettings();
  }

  WNG.auth = auth;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
