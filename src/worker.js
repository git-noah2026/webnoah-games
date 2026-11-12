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
  reaktion: { better: "low", variants: [""], min: 80, max: 5000 }
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
     key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL)`
];

let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) schemaReady = db.batch(SCHEMA.map(s => db.prepare(s))).catch(e => { schemaReady = null; throw e; });
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
    `SELECT u.id, u.username, u.display, u.color, u.created FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires > ?`).bind(await sha256(token), now()).first();
  return row || null;
}
async function requireUser(req, db) { const u = await currentUser(req, db); if (!u) fail(401, "Bitte zuerst anmelden."); return u; }

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
    return json({ user: u ? publicUser(u) : null });
  }

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
       WHERE r.game = ? AND r.variant = ? ORDER BY r.value ${order}, r.updated ASC LIMIT 10`).bind(game, variant).all();
    const me = await currentUser(req, db);
    let mine = null;
    if (me) {
      const own = await db.prepare("SELECT value FROM records WHERE user_id = ? AND game = ? AND variant = ?").bind(me.id, game, variant).first();
      if (own) {
        const cmp = g.better === "low" ? "<" : ">";
        const ahead = await db.prepare(`SELECT COUNT(*) AS n FROM records WHERE game = ? AND variant = ? AND value ${cmp} ?`).bind(game, variant, own.value).first();
        mine = { rank: ahead.n + 1, value: own.value };
      }
    }
    return json({ game, variant, better: g.better, top: rows.results, mine });
  }

  const userMatch = path.match(/^\/api\/users\/([A-Za-z0-9_.-]{3,20})$/);
  if (userMatch && m === "GET") {
    const u = await db.prepare("SELECT id, username, display, color, created FROM users WHERE username = ?").bind(userMatch[1]).first();
    if (!u) fail(404, "Dieses Profil gibt es nicht.");
    const [records, stats] = await db.batch([
      db.prepare("SELECT game, variant, value, updated FROM records WHERE user_id = ?").bind(u.id),
      db.prepare("SELECT game, plays, last FROM stats WHERE user_id = ?").bind(u.id)
    ]);
    return json({ user: publicUser(u), records: records.results, stats: stats.results });
  }

  fail(404, "Diese Schnittstelle gibt es nicht.");
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
