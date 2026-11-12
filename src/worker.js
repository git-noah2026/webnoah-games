// WebNoah-Games API (Cloudflare Worker + D1).
// Alles unter /api/* landet hier, alle anderen Pfade liefert Cloudflare direkt aus docs/ aus.
//
// Sicherheit:
// - Passwörter: PBKDF2-SHA256, 100 000 Runden, eigenes Salt pro Konto.
// - Sitzung: zufälliges Token im HttpOnly-Cookie, in der Datenbank nur als SHA-256-Hash.
// - Schreibende Anfragen nur mit JSON und passendem Origin (Schutz gegen CSRF).
// - Rate-Limits für Registrierung und Anmeldung pro IP.

const GAMES = {
  schlange: { better: "high", variants: [""], min: 0, max: 397 },
  memory: { better: "low", variants: [""], min: 8, max: 999 },
  vier: { better: "high", variants: [""], min: 0, max: 100000 },
  minen: { better: "low", variants: ["klein", "mittel"], min: 1, max: 99999 },
  ziegel: { better: "high", variants: [""], min: 0, max: 10000000 },
  reaktion: { better: "low", variants: [""], min: 80, max: 5000 },
  solitaer: { better: "low", variants: [""], min: 20, max: 36000 },
  schiffe: { better: "low", variants: [""], min: 17, max: 100 },
  minigolf: { better: "low", variants: [""], min: 6, max: 54 },
  rennen: { better: "high", variants: [""], min: 0, max: 100000 },
  muehle: { better: "high", variants: [""], min: 0, max: 100000 },
  sudoku9: { better: "low", variants: ["leicht", "mittel", "schwer"], min: 30, max: 36000 },
  wortjagd: { better: "low", variants: [""], min: 15, max: 36000 },
  farbton: { better: "high", variants: [""], min: 0, max: 300 },
  steine: { better: "high", variants: [""], min: 0, max: 10000000 },
  huepfer: { better: "high", variants: [""], min: 0, max: 5000000 },
  heast: { better: "high", variants: [""], min: 0, max: 100000 },
  reich: { better: "high", variants: [""], min: 0, max: 100000 }
};
const COLORS = ["#38bdf8", "#ff6b5e", "#4ade80", "#e2b552", "#a78bfa", "#2fb3a6", "#f472b6", "#94a3b8"];
const COOKIE = "wng_session";
const SESSION_DAYS = 30;
const PBKDF2_ROUNDS = 100000;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;
const MAX_SAVE_BYTES = 4096;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     display TEXT NOT NULL,
     color TEXT NOT NULL,
     pw_hash TEXT NOT NULL,
     pw_salt TEXT NOT NULL,
     created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS records (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     game TEXT NOT NULL, variant TEXT NOT NULL DEFAULT '',
     value REAL NOT NULL, updated INTEGER NOT NULL,
     PRIMARY KEY (user_id, game, variant))`,
  `CREATE INDEX IF NOT EXISTS records_board ON records (game, variant, value)`,
  `CREATE TABLE IF NOT EXISTS favs (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     game TEXT NOT NULL, PRIMARY KEY (user_id, game))`,
  `CREATE TABLE IF NOT EXISTS saves (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     game TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL,
     PRIMARY KEY (user_id, game))`,
  `CREATE TABLE IF NOT EXISTS stats (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     game TEXT NOT NULL, plays INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL,
     PRIMARY KEY (user_id, game))`,
  `CREATE TABLE IF NOT EXISTS limits (
     key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS admin_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT, admin TEXT NOT NULL, action TEXT NOT NULL,
     target TEXT, detail TEXT, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS admin_log_at ON admin_log (at)`
];
// Spalten, die nach dem ersten Start dazugekommen sind. "duplicate column" heißt: schon da.
const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
  "ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN ban_reason TEXT",
  "ALTER TABLE users ADD COLUMN last_seen INTEGER"
];

let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) schemaReady = (async () => {
    await db.batch(SCHEMA.map(s => db.prepare(s)));
    for (const m of MIGRATIONS) {
      try { await db.prepare(m).run(); }
      catch (e) { if (!/duplicate column/i.test(String(e && e.message))) throw e; }
    }
  })().catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

/* ---------- Hilfen ---------- */
const now = () => Date.now();
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ROUNDS }, key, 256);
  return { hash: b64(bits), salt: b64(salt) };
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sha256(text) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(text))); }

function readCookie(req, name) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}
function sessionCookie(req, token, maxAge) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function body(req) {
  if (!(req.headers.get("content-type") || "").includes("application/json")) fail(415, "Anfrage muss JSON sein.");
  const text = await req.text();
  if (text.length > 20000) fail(413, "Anfrage ist zu groß.");
  try { return JSON.parse(text || "{}"); } catch { fail(400, "Ungültiges JSON."); }
}

function checkOrigin(req) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) fail(403, "Fremde Herkunft ist nicht erlaubt.");
}

async function limit(db, key, max, windowMs) {
  const t = now();
  const row = await db.prepare("SELECT count, reset FROM limits WHERE key = ?").bind(key).first();
  if (!row || row.reset < t) {
    await db.prepare("INSERT INTO limits (key, count, reset) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset = excluded.reset").bind(key, t + windowMs).run();
    return;
  }
  if (row.count >= max) fail(429, `Zu viele Versuche. Bitte in ${Math.ceil((row.reset - t) / 60000)} Minuten nochmal.`);
  await db.prepare("UPDATE limits SET count = count + 1 WHERE key = ?").bind(key).run();
}

async function currentUser(req, db) {
  const token = readCookie(req, COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db.prepare(
    `SELECT u.id, u.username, u.display, u.color, u.created, u.role, u.banned, u.last_seen FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires > ?`).bind(await sha256(token), now()).first();
  if (!row || row.banned) return null;
  // "Zuletzt aktiv" höchstens alle 10 Minuten schreiben
  if (!row.last_seen || now() - row.last_seen > 600000) await db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").bind(now(), row.id).run();
  return row;
}
async function requireUser(req, db) { const u = await currentUser(req, db); if (!u) fail(401, "Bitte zuerst anmelden."); return u; }

// Haupt-Admins stehen in der Cloudflare-Variable ADMIN_USERS (kommagetrennt) und lassen sich nicht aussperren.
const envAdmins = env => String(env.ADMIN_USERS || "").split(/[,\s]+/).filter(Boolean).map(s => s.toLowerCase());
const isEnvAdmin = (u, env) => !!u && envAdmins(env).includes(String(u.username).toLowerCase());
const isAdmin = (u, env) => !!u && (u.role === "admin" || isEnvAdmin(u, env));
async function requireAdmin(req, env) {
  const u = await requireUser(req, env.DB);
  if (!isAdmin(u, env)) fail(403, "Dieser Bereich ist nur für Admins.");
  return u;
}
async function audit(db, admin, action, target, detail) {
  await db.prepare("INSERT INTO admin_log (admin, action, target, detail, at) VALUES (?, ?, ?, ?, ?)")
    .bind(admin.username, action, target || null, detail ? String(detail).slice(0, 500) : null, now()).run();
}
async function readSettings(db) {
  const rows = (await db.prepare("SELECT key, value FROM settings").all()).results;
  const s = Object.fromEntries(rows.map(r => { try { return [r.key, JSON.parse(r.value)]; } catch { return [r.key, null]; } }));
  return { announcement: s.announcement || null, disabled: Array.isArray(s.disabled) ? s.disabled : [] };
}
function tempPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789", bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = [...bytes].map(b => abc[b % abc.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

async function startSession(req, db, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const maxAge = SESSION_DAYS * 86400;
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires < ?").bind(userId, now()),
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)").bind(await sha256(token), userId, now() + maxAge * 1000)
  ]);
  return sessionCookie(req, token, maxAge);
}

const publicUser = u => ({ username: u.username, display: u.display, color: u.color, created: u.created });
function validGame(game, variant = "") {
  const g = GAMES[game];
  if (!g) fail(400, "Unbekanntes Spiel.");
  if (!g.variants.includes(variant)) fail(400, "Unbekannte Variante.");
  return g;
}
const isBetter = (g, v, old) => old == null || (g.better === "low" ? v < old : v > old);

async function userState(db, userId) {
  const [records, favs, saves, stats] = await db.batch([
    db.prepare("SELECT game, variant, value FROM records WHERE user_id = ?").bind(userId),
    db.prepare("SELECT game FROM favs WHERE user_id = ?").bind(userId),
    db.prepare("SELECT game, data FROM saves WHERE user_id = ?").bind(userId),
    db.prepare("SELECT game, plays, last FROM stats WHERE user_id = ?").bind(userId)
  ]);
  return {
    records: records.results,
    favs: favs.results.map(r => r.game),
    saves: Object.fromEntries(saves.results.map(r => [r.game, JSON.parse(r.data)])),
    stats: Object.fromEntries(stats.results.map(r => [r.game, { plays: r.plays, last: r.last }]))
  };
}

async function saveRecord(db, userId, game, variant, value) {
  const g = validGame(game, variant);
  if (typeof value !== "number" || !Number.isFinite(value) || value < g.min || value > g.max) fail(400, "Ungültiger Wert.");
  const old = await db.prepare("SELECT value FROM records WHERE user_id = ? AND game = ? AND variant = ?").bind(userId, game, variant).first();
  if (!isBetter(g, value, old && old.value)) return { improved: false, value: old.value };
  await db.prepare(`INSERT INTO records (user_id, game, variant, value, updated) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, game, variant) DO UPDATE SET value = excluded.value, updated = excluded.updated`).bind(userId, game, variant, value, now()).run();
  return { improved: true, value };
}

/* ---------- Routen ---------- */
async function route(req, env) {
  const db = env.DB;
  await ensureSchema(db);
  checkOrigin(req);
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const m = req.method;
  const ip = req.headers.get("cf-connecting-ip") || "lokal";

  if (path === "/api/health") return json({ ok: true });

  if (path === "/api/me" && m === "GET") {
    const u = await currentUser(req, db);
    return json({ user: u ? { ...publicUser(u), role: isAdmin(u, env) ? "admin" : "user" } : null });
  }

  if (path === "/api/settings" && m === "GET") return json(await readSettings(db));

  if (path.startsWith("/api/admin/")) return adminRoute(req, env, url, path, m);

  if (path === "/api/register" && m === "POST") {
    const { username = "", password = "" } = await body(req);
    if (!USERNAME_RE.test(username)) fail(400, "Benutzername: 3 bis 20 Zeichen, nur Buchstaben, Ziffern, Punkt, Minus und Unterstrich.");
    if (typeof password !== "string" || password.length < 8) fail(400, "Das Passwort braucht mindestens 8 Zeichen.");
    if (password.length > 200) fail(400, "Das Passwort ist zu lang.");
    if (password.toLowerCase() === username.toLowerCase()) fail(400, "Passwort und Benutzername dürfen nicht gleich sein.");
    await limit(db, "reg:" + ip, 5, 3600000);
    const exists = await db.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
    if (exists) fail(409, "Dieser Benutzername ist schon vergeben.");
    const { hash, salt } = await hashPassword(password);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const created = now();
    const res = await db.prepare("INSERT INTO users (username, display, color, pw_hash, pw_salt, created) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(username, username, color, hash, salt, created).run();
    const cookie = await startSession(req, db, res.meta.last_row_id);
    return json({ user: { username, display: username, color, created } }, 201, { "set-cookie": cookie });
  }

  if (path === "/api/login" && m === "POST") {
    const { username = "", password = "" } = await body(req);
    if (typeof username !== "string" || typeof password !== "string") fail(400, "Benutzername und Passwort fehlen.");
    await limit(db, "login:" + ip, 20, 900000);
    await limit(db, "login:" + ip + ":" + username.toLowerCase(), 8, 900000);
    const u = await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
    // Auch ohne Konto rechnen, damit die Antwortzeit nichts verrät.
    const { hash } = await hashPassword(password, u ? u.pw_salt : "AAAAAAAAAAAAAAAAAAAAAA==");
    if (!u || !safeEqual(hash, u.pw_hash)) fail(401, "Benutzername oder Passwort stimmt nicht.");
    if (u.banned) fail(403, `Dieses Konto ist gesperrt${u.ban_reason ? `: ${u.ban_reason}` : "."}`);
    const cookie = await startSession(req, db, u.id);
    return json({ user: publicUser(u) }, 200, { "set-cookie": cookie });
  }

  if (path === "/api/logout" && m === "POST") {
    const token = readCookie(req, COOKIE);
    if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(req, "", 0) });
  }

  if (path === "/api/me" && m === "PATCH") {
    const u = await requireUser(req, db);
    const { display, color } = await body(req);
    const d = typeof display === "string" ? display.trim().replace(/\s+/g, " ") : u.display;
    if (d.length < 2 || d.length > 24) fail(400, "Der Anzeigename braucht 2 bis 24 Zeichen.");
    const c = color === undefined ? u.color : color;
    if (!COLORS.includes(c)) fail(400, "Diese Farbe gibt es nicht.");
    await db.prepare("UPDATE users SET display = ?, color = ? WHERE id = ?").bind(d, c, u.id).run();
    return json({ user: { ...publicUser(u), display: d, color: c } });
  }

  if (path === "/api/me/password" && m === "POST") {
    const u = await requireUser(req, db);
    const { current = "", next = "" } = await body(req);
    await limit(db, "pw:" + u.id, 8, 900000);
    const row = await db.prepare("SELECT pw_hash, pw_salt FROM users WHERE id = ?").bind(u.id).first();
    if (!safeEqual((await hashPassword(String(current), row.pw_salt)).hash, row.pw_hash)) fail(401, "Das aktuelle Passwort stimmt nicht.");
    if (typeof next !== "string" || next.length < 8 || next.length > 200) fail(400, "Das neue Passwort braucht 8 bis 200 Zeichen.");
    const { hash, salt } = await hashPassword(next);
    await db.batch([
      db.prepare("UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?").bind(hash, salt, u.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id)
    ]);
    const cookie = await startSession(req, db, u.id);
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }

  if (path === "/api/me" && m === "DELETE") {
    const u = await requireUser(req, db);
    const { password = "" } = await body(req);
    const row = await db.prepare("SELECT pw_hash, pw_salt FROM users WHERE id = ?").bind(u.id).first();
    if (!safeEqual((await hashPassword(String(password), row.pw_salt)).hash, row.pw_hash)) fail(401, "Das Passwort stimmt nicht.");
    await db.batch(["sessions", "records", "favs", "saves", "stats"].map(t => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(u.id))
      .concat(db.prepare("DELETE FROM users WHERE id = ?").bind(u.id)));
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(req, "", 0) });
  }

  // Lokale Daten nach dem Anmelden zusammenführen und den Stand zurückgeben
  if (path === "/api/sync" && (m === "GET" || m === "POST")) {
    const u = await requireUser(req, db);
    if (m === "POST") {
      const { records = [], favs = [] } = await body(req);
      for (const r of Array.isArray(records) ? records.slice(0, 50) : []) {
        try { await saveRecord(db, u.id, r.game, r.variant || "", r.value); } catch { /* ungültige lokale Werte überspringen */ }
      }
      const okFavs = (Array.isArray(favs) ? favs : []).filter(f => typeof f === "string" && /^[a-z0-9-]{2,30}$/.test(f)).slice(0, 50);
      if (okFavs.length) await db.batch(okFavs.map(f => db.prepare("INSERT OR IGNORE INTO favs (user_id, game) VALUES (?, ?)").bind(u.id, f)));
    }
    return json(await userState(db, u.id));
  }

  if (path === "/api/records" && m === "POST") {
    const u = await requireUser(req, db);
    const { game, variant = "", value, played = true } = await body(req);
    const result = await saveRecord(db, u.id, game, variant, value);
    if (played) await db.prepare(`INSERT INTO stats (user_id, game, plays, last) VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, game) DO UPDATE SET plays = plays + 1, last = excluded.last`).bind(u.id, game, now()).run();
    return json(result);
  }

  if (path === "/api/favs" && m === "PUT") {
    const u = await requireUser(req, db);
    const { favs = [] } = await body(req);
    const list = (Array.isArray(favs) ? favs : []).filter(f => typeof f === "string" && /^[a-z0-9-]{2,30}$/.test(f)).slice(0, 50);
    await db.batch([db.prepare("DELETE FROM favs WHERE user_id = ?").bind(u.id)]
      .concat(list.map(f => db.prepare("INSERT OR IGNORE INTO favs (user_id, game) VALUES (?, ?)").bind(u.id, f))));
    return json({ favs: list });
  }

  const saveMatch = path.match(/^\/api\/saves\/([a-z0-9-]{2,30})$/);
  if (saveMatch) {
    const u = await requireUser(req, db);
    const game = saveMatch[1]; validGame(game, GAMES[game] ? GAMES[game].variants[0] : "");
    if (m === "PUT") {
      const { data } = await body(req);
      const text = JSON.stringify(data ?? null);
      if (text.length > MAX_SAVE_BYTES) fail(413, "Spielstand ist zu groß.");
      await db.prepare(`INSERT INTO saves (user_id, game, data, updated) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, game) DO UPDATE SET data = excluded.data, updated = excluded.updated`).bind(u.id, game, text, now()).run();
      return json({ ok: true });
    }
    if (m === "DELETE") {
      await db.prepare("DELETE FROM saves WHERE user_id = ? AND game = ?").bind(u.id, game).run();
      return json({ ok: true });
    }
  }

  if (path === "/api/leaderboard" && m === "GET") {
    const game = url.searchParams.get("game") || "", variant = url.searchParams.get("variant") || "";
    const g = validGame(game, variant);
    const order = g.better === "low" ? "ASC" : "DESC";
    const rows = await db.prepare(
      `SELECT u.username, u.display, u.color, r.value, r.updated FROM records r JOIN users u ON u.id = r.user_id
       WHERE r.game = ? AND r.variant = ? AND u.banned = 0 ORDER BY r.value ${order}, r.updated ASC LIMIT 10`).bind(game, variant).all();
    const me = await currentUser(req, db);
    let mine = null;
    if (me) {
      const own = await db.prepare("SELECT value FROM records WHERE user_id = ? AND game = ? AND variant = ?").bind(me.id, game, variant).first();
      if (own) {
        const cmp = g.better === "low" ? "<" : ">";
        const ahead = await db.prepare(`SELECT COUNT(*) AS n FROM records r JOIN users u ON u.id = r.user_id
          WHERE r.game = ? AND r.variant = ? AND u.banned = 0 AND r.value ${cmp} ?`).bind(game, variant, own.value).first();
        mine = { rank: ahead.n + 1, value: own.value };
      }
    }
    return json({ game, variant, better: g.better, top: rows.results, mine });
  }

  const userMatch = path.match(/^\/api\/users\/([A-Za-z0-9_.-]{3,20})$/);
  if (userMatch && m === "GET") {
    const u = await db.prepare("SELECT id, username, display, color, created FROM users WHERE username = ? AND banned = 0").bind(userMatch[1]).first();
    if (!u) fail(404, "Dieses Profil gibt es nicht.");
    const [records, stats] = await db.batch([
      db.prepare("SELECT game, variant, value, updated FROM records WHERE user_id = ?").bind(u.id),
      db.prepare("SELECT game, plays, last FROM stats WHERE user_id = ?").bind(u.id)
    ]);
    return json({ user: publicUser(u), records: records.results, stats: stats.results });
  }

  fail(404, "Diese Schnittstelle gibt es nicht.");
}

/* ---------- Admin ---------- */
const DAY = 86400000;
async function findUser(db, name) {
  const u = await db.prepare("SELECT id, username, display, color, role, banned, ban_reason, created, last_seen FROM users WHERE username = ?").bind(name).first();
  if (!u) fail(404, "Dieses Konto gibt es nicht.");
  return u;
}
const adminView = (u, env) => ({
  username: u.username, display: u.display, color: u.color, created: u.created, last_seen: u.last_seen,
  role: isAdmin(u, env) ? "admin" : "user", owner: isEnvAdmin(u, env), banned: !!u.banned, ban_reason: u.ban_reason || null,
  plays: u.plays ?? undefined, recs: u.recs ?? undefined
});
function guardTarget(me, target, env, what) {
  if (target.id === me.id) fail(400, `Du kannst dich nicht selbst ${what}.`);
  if (isEnvAdmin(target, env)) fail(400, `Haupt-Admins aus ADMIN_USERS lassen sich nicht ${what}.`);
}
const csvCell = v => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

async function adminRoute(req, env, url, path, m) {
  const db = env.DB;
  const me = await requireAdmin(req, env);
  const q = url.searchParams;

  // Übersicht
  if (path === "/api/admin/stats" && m === "GET") {
    const t = now(), from30 = Math.floor((t - 29 * DAY) / DAY) * DAY;
    const r = await db.batch([
      db.prepare("SELECT COUNT(*) AS n FROM users"),
      db.prepare("SELECT COUNT(*) AS n FROM users WHERE created > ?").bind(t - 7 * DAY),
      db.prepare("SELECT COUNT(*) AS n FROM users WHERE last_seen > ?").bind(t - DAY),
      db.prepare("SELECT COUNT(*) AS n FROM users WHERE banned = 1"),
      db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires > ?").bind(t),
      db.prepare("SELECT COUNT(*) AS n FROM records"),
      db.prepare("SELECT COALESCE(SUM(plays), 0) AS n FROM stats"),
      db.prepare("SELECT game, SUM(plays) AS plays, COUNT(*) AS players FROM stats GROUP BY game ORDER BY plays DESC"),
      db.prepare("SELECT created / 86400000 AS day, COUNT(*) AS n FROM users WHERE created >= ? GROUP BY day").bind(from30),
      db.prepare(`SELECT u.username, u.display, u.color, SUM(s.plays) AS plays FROM stats s JOIN users u ON u.id = s.user_id
                  GROUP BY u.id ORDER BY plays DESC LIMIT 6`),
      db.prepare("SELECT username, display, color, created FROM users ORDER BY created DESC LIMIT 6")
    ]);
    const n = i => r[i].results[0].n;
    return json({
      users: n(0), new7: n(1), active24: n(2), banned: n(3), sessions: n(4), records: n(5), plays: n(6),
      perGame: r[7].results, signups: r[8].results, from: from30, topPlayers: r[9].results, newest: r[10].results,
      owners: envAdmins(env).length
    });
  }

  // Nutzerliste
  if (path === "/api/admin/users" && m === "GET") {
    const term = `%${(q.get("q") || "").trim()}%`, page = Math.max(0, +q.get("page") || 0), per = 25;
    const sorts = { created: "u.created", username: "u.username COLLATE NOCASE", last_seen: "COALESCE(u.last_seen, 0)", plays: "plays", recs: "recs" };
    const sort = sorts[q.get("sort")] || sorts.created, dir = q.get("dir") === "asc" ? "ASC" : "DESC";
    const owners = envAdmins(env), ownerIn = owners.length ? `OR LOWER(u.username) IN (${owners.map(() => "?").join(",")})` : "";
    const filter = q.get("filter");
    const where = ["(u.username LIKE ? OR u.display LIKE ?)"];
    const args = [term, term];
    if (filter === "admins") { where.push(`(u.role = 'admin' ${ownerIn})`); args.push(...owners); }
    if (filter === "banned") where.push("u.banned = 1");
    if (filter === "active") { where.push("u.last_seen > ?"); args.push(now() - 7 * DAY); }
    const w = where.join(" AND ");
    const [rows, total] = await db.batch([
      db.prepare(`SELECT u.id, u.username, u.display, u.color, u.role, u.banned, u.ban_reason, u.created, u.last_seen,
          (SELECT COALESCE(SUM(plays), 0) FROM stats WHERE user_id = u.id) AS plays,
          (SELECT COUNT(*) FROM records WHERE user_id = u.id) AS recs
        FROM users u WHERE ${w} ORDER BY ${sort} ${dir} LIMIT ${per} OFFSET ${page * per}`).bind(...args),
      db.prepare(`SELECT COUNT(*) AS n FROM users u WHERE ${w}`).bind(...args)
    ]);
    return json({ users: rows.results.map(u => adminView(u, env)), total: total.results[0].n, page, per });
  }

  // CSV-Export aller Konten
  if (path === "/api/admin/export.csv" && m === "GET") {
    const rows = (await db.prepare(`SELECT u.username, u.display, u.role, u.banned, u.created, u.last_seen,
        (SELECT COALESCE(SUM(plays), 0) FROM stats WHERE user_id = u.id) AS plays,
        (SELECT COUNT(*) FROM records WHERE user_id = u.id) AS recs FROM users u ORDER BY u.created`).all()).results;
    const iso = v => v ? new Date(v).toISOString() : "";
    const lines = [["Benutzername", "Anzeigename", "Rolle", "Gesperrt", "Registriert", "Zuletzt aktiv", "Partien", "Rekorde"].join(";")]
      .concat(rows.map(u => [u.username, u.display, isAdmin(u, env) ? "admin" : "user", u.banned ? "ja" : "nein", iso(u.created), iso(u.last_seen), u.plays, u.recs].map(csvCell).join(";")));
    await audit(db, me, "export", null, `${rows.length} Konten`);
    return new Response("﻿" + lines.join("\r\n"), { headers: {
      "content-type": "text/csv; charset=utf-8", "cache-control": "no-store",
      "content-disposition": `attachment; filename="webnoah-konten-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }

  // Einzelnes Konto
  const um = path.match(/^\/api\/admin\/users\/([A-Za-z0-9_.-]{3,20})(?:\/(password|logout|records))?$/);
  if (um) {
    const target = await findUser(db, um[1]), sub = um[2];

    if (!sub && m === "GET") {
      const [records, stats, sessions, log] = await db.batch([
        db.prepare("SELECT game, variant, value, updated FROM records WHERE user_id = ? ORDER BY game").bind(target.id),
        db.prepare("SELECT game, plays, last FROM stats WHERE user_id = ? ORDER BY plays DESC").bind(target.id),
        db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires > ?").bind(target.id, now()),
        db.prepare("SELECT admin, action, detail, at FROM admin_log WHERE target = ? COLLATE NOCASE ORDER BY at DESC LIMIT 20").bind(target.username)
      ]);
      return json({ user: adminView(target, env), self: target.id === me.id, records: records.results, stats: stats.results, sessions: sessions.results[0].n, log: log.results });
    }

    if (!sub && m === "PATCH") {
      const b = await body(req), changes = [];
      const upd = { display: target.display, color: target.color, role: target.role, banned: target.banned, ban_reason: target.ban_reason };
      if (b.display !== undefined) {
        const d = String(b.display).trim().replace(/\s+/g, " ");
        if (d.length < 2 || d.length > 24) fail(400, "Der Anzeigename braucht 2 bis 24 Zeichen.");
        if (d !== target.display) { upd.display = d; changes.push(`Anzeigename „${target.display}“ → „${d}“`); }
      }
      if (b.color !== undefined) {
        if (!COLORS.includes(b.color)) fail(400, "Diese Farbe gibt es nicht.");
        if (b.color !== target.color) { upd.color = b.color; changes.push("Farbe geändert"); }
      }
      if (b.role !== undefined) {
        if (!["admin", "user"].includes(b.role)) fail(400, "Unbekannte Rolle.");
        if (b.role !== target.role) { guardTarget(me, target, env, b.role === "admin" ? "befördern" : "zurückstufen"); upd.role = b.role; changes.push(b.role === "admin" ? "zum Admin ernannt" : "Admin-Rechte entzogen"); }
      }
      if (b.banned !== undefined) {
        const ban = b.banned ? 1 : 0;
        if (ban !== target.banned) {
          guardTarget(me, target, env, ban ? "sperren" : "entsperren");
          upd.banned = ban;
          upd.ban_reason = ban ? (String(b.ban_reason || "").trim().slice(0, 140) || null) : null;
          changes.push(ban ? `gesperrt${upd.ban_reason ? `: ${upd.ban_reason}` : ""}` : "entsperrt");
        }
      }
      if (!changes.length) return json({ user: adminView(target, env) });
      const ops = [db.prepare("UPDATE users SET display = ?, color = ?, role = ?, banned = ?, ban_reason = ? WHERE id = ?")
        .bind(upd.display, upd.color, upd.role, upd.banned, upd.ban_reason, target.id)];
      if (upd.banned && !target.banned) ops.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id));
      await db.batch(ops);
      await audit(db, me, "update", target.username, changes.join(", "));
      return json({ user: adminView({ ...target, ...upd }, env) });
    }

    if (!sub && m === "DELETE") {
      guardTarget(me, target, env, "löschen");
      await db.batch(["sessions", "records", "favs", "saves", "stats"].map(t => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(target.id))
        .concat(db.prepare("DELETE FROM users WHERE id = ?").bind(target.id)));
      await audit(db, me, "delete", target.username, "Konto mit allen Daten gelöscht");
      return json({ ok: true });
    }

    if (sub === "password" && m === "POST") {
      if (target.id === me.id) fail(400, "Dein eigenes Passwort änderst du in deinem Profil.");
      const pw = tempPassword(), { hash, salt } = await hashPassword(pw);
      await db.batch([
        db.prepare("UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?").bind(hash, salt, target.id),
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id)
      ]);
      await audit(db, me, "password", target.username, "Temporäres Passwort erzeugt");
      return json({ password: pw });
    }

    if (sub === "logout" && m === "POST") {
      const r = await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id).run();
      await audit(db, me, "logout", target.username, `${r.meta.changes || 0} Sitzungen beendet`);
      return json({ ended: r.meta.changes || 0 });
    }

    if (sub === "records" && m === "DELETE") {
      const { game = "", variant = "" } = await body(req);
      if (game === "*") {
        const r = await db.prepare("DELETE FROM records WHERE user_id = ?").bind(target.id).run();
        await audit(db, me, "records", target.username, `Alle Rekorde gelöscht (${r.meta.changes || 0})`);
        return json({ deleted: r.meta.changes || 0 });
      }
      validGame(game, variant);
      const r = await db.prepare("DELETE FROM records WHERE user_id = ? AND game = ? AND variant = ?").bind(target.id, game, variant).run();
      await audit(db, me, "records", target.username, `Rekord ${game}${variant ? ` (${variant})` : ""} gelöscht`);
      return json({ deleted: r.meta.changes || 0 });
    }
  }

  // Bestenliste mit allen Einträgen (auch gesperrte Konten)
  if (path === "/api/admin/leaderboard" && m === "GET") {
    const game = q.get("game") || "", variant = q.get("variant") || "";
    const g = validGame(game, variant);
    const rows = await db.prepare(`SELECT u.username, u.display, u.color, u.banned, r.value, r.updated FROM records r JOIN users u ON u.id = r.user_id
      WHERE r.game = ? AND r.variant = ? ORDER BY r.value ${g.better === "low" ? "ASC" : "DESC"}, r.updated ASC LIMIT 100`).bind(game, variant).all();
    const total = await db.prepare("SELECT COUNT(*) AS n FROM records WHERE game = ? AND variant = ?").bind(game, variant).first();
    return json({ game, variant, better: g.better, min: g.min, max: g.max, rows: rows.results, total: total.n });
  }

  // Einstellungen: Ankündigung und pausierte Spiele
  if (path === "/api/admin/settings") {
    if (m === "GET") return json(await readSettings(db));
    if (m === "PUT") {
      const b = await body(req), ops = [], changes = [];
      if (b.announcement !== undefined) {
        let a = null;
        if (b.announcement && String(b.announcement.text || "").trim()) {
          const text = String(b.announcement.text).trim().slice(0, 280);
          const level = ["info", "warn", "success"].includes(b.announcement.level) ? b.announcement.level : "info";
          a = { text, level, id: hex(crypto.getRandomValues(new Uint8Array(4))), at: now() };
        }
        ops.push(a ? db.prepare("INSERT INTO settings (key, value) VALUES ('announcement', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(a))
          : db.prepare("DELETE FROM settings WHERE key = 'announcement'"));
        changes.push(a ? `Ankündigung: ${a.text}` : "Ankündigung entfernt");
      }
      if (b.disabled !== undefined) {
        const list = (Array.isArray(b.disabled) ? b.disabled : []).filter(s => typeof s === "string" && /^[a-z0-9-]{2,30}$/.test(s)).slice(0, 50);
        ops.push(db.prepare("INSERT INTO settings (key, value) VALUES ('disabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(list)));
        changes.push(list.length ? `Pausiert: ${list.join(", ")}` : "Alle Spiele aktiv");
      }
      if (ops.length) { await db.batch(ops); await audit(db, me, "settings", null, changes.join(" · ")); }
      return json(await readSettings(db));
    }
  }

  // Protokoll
  if (path === "/api/admin/log" && m === "GET") {
    const page = Math.max(0, +q.get("page") || 0), per = 40;
    const [rows, total] = await db.batch([
      db.prepare(`SELECT id, admin, action, target, detail, at FROM admin_log ORDER BY at DESC LIMIT ${per} OFFSET ${page * per}`),
      db.prepare("SELECT COUNT(*) AS n FROM admin_log")
    ]);
    return json({ rows: rows.results, total: total.results[0].n, page, per });
  }

  fail(404, "Diese Admin-Schnittstelle gibt es nicht.");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Da ist auf dem Server etwas schiefgegangen." }, 500);
    }
  }
};
