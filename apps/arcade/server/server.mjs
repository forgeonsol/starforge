// $FORGE self-hosted server: static site + arena API on Node 22 and SQLite. No npm dependencies.
//
//   node --experimental-strip-types server/server.mjs
//
// Environment (see .env.example at the repo root):
//   PORT=3000  HOST=0.0.0.0  DATA_DIR=./data  PUBLIC_DIR=./public
//   COOKIE_SECURE=1    session cookie is __Host- prefixed and Secure (set 0 only for plain-http local dev)
//   TRUST_PROXY=1      take the client IP from X-Forwarded-For (only behind your own reverse proxy)
//   ALLOWED_HOSTS=forge.example.com,www.forge.example.com   reject other Host headers (empty = allow any)
//   BACKUP_HOURS=24  BACKUP_KEEP=14   DEV_SEED=1 (sample players, local only)
//   SECURITY_CONTACT=mailto:security@forge.example.com   published in /.well-known/security.txt
//   BAN_STRIKES=40  BAN_MINUTES=30   an IP that collects this many rejected API calls in 10 min is blocked
import http from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { backup, cleanup, d1, migrate, openDb } from "./sqlite-d1.mjs";
import { handleLeaderboard, json } from "../lib/forge-server.ts";
import { handleProfileGet, handleProfilePost, handleRaid, handleRunStart, handleScore } from "../lib/arena.ts";
import { handleRecover, handleRecoveryCode, handleSessionCreate, handleSessionDelete, sessionPlayer } from "../lib/session.ts";

const APP = fileURLToPath(new URL("..", import.meta.url));
const env = process.env;
const PORT = Number(env.PORT || 3000);
const HOST = env.HOST || "127.0.0.1";
const DATA_DIR = resolve(env.DATA_DIR || join(APP, "data"));
const PUBLIC_DIR = resolve(env.PUBLIC_DIR || join(APP, "public"));
const COOKIE = { secure: env.COOKIE_SECURE !== "0" };
const TRUST_PROXY = env.TRUST_PROXY === "1";
const ALLOWED_HOSTS = new Set((env.ALLOWED_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
const BACKUP_HOURS = Number(env.BACKUP_HOURS || 24);
const BACKUP_KEEP = Number(env.BACKUP_KEEP || 14);
const MAX_BODY = 16 * 1024;
const SECURITY_CONTACT = env.SECURITY_CONTACT || "";
const BAN_STRIKES = Number(env.BAN_STRIKES || 40);
const BAN_MS = Number(env.BAN_MINUTES || 30) * 60_000;

// ------------------------------------------------------------------ database
mkdirSync(DATA_DIR, { recursive: true });
const sqlite = openDb(join(DATA_DIR, "forge.db"));
const applied = migrate(sqlite, join(APP, "drizzle"));
if (applied.length) log({ msg: "migrations applied", applied });
const db = d1(sqlite);
if (env.DEV_SEED === "1" && !sqlite.prepare("SELECT COUNT(*) AS n FROM players").get().n) seedDev();

// ------------------------------------------------------------------ headers
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" + (COOKIE.secure ? "; upgrade-insecure-requests" : "");
const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": CSP,
  ...(COOKIE.secure ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
};
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2",
};
function cacheFor(path) {
  if (path.startsWith("/assets/") || path.startsWith("/vendor/")) return "public, max-age=31536000, immutable";
  if (path.endsWith(".html")) return "no-cache";
  if (/\.(js|css)$/.test(path)) return "public, max-age=300, must-revalidate";
  return "public, max-age=3600";
}

// ------------------------------------------------------------------ cheap in-memory flood guard (before any DB work)
const buckets = new Map();
function allow(key, limit, windowMs) {
  const t = Date.now(); let b = buckets.get(key);
  if (!b || t - b.start >= windowMs) { b = { start: t, n: 0 }; buckets.set(key, b); }
  return ++b.n <= limit;
}
setInterval(() => {
  const t = Date.now();
  for (const [k, b] of buckets) if (t - b.start > 120_000) buckets.delete(k);
  for (const [k, s] of strikes) if (t - s.start > STRIKE_WINDOW_MS) strikes.delete(k);
  for (const [k, until] of bans) if (until < t) bans.delete(k);
}, 60_000).unref();

// ------------------------------------------------------------------ automatic ban for clients that keep getting refused
// Rejections that an honest browser almost never produces (forged runs, cross-site writes, oversized or malformed
// bodies, hammering past rate limits) count as strikes. Too many in 10 minutes blocks the IP's API access for a while.
const STRIKE_WINDOW_MS = 10 * 60_000;
const STRIKE_STATUSES = new Set([400, 403, 404, 405, 413, 415, 429]);
const strikes = new Map(), bans = new Map();
function strike(ip, status, path, method = "POST") {
  if (!STRIKE_STATUSES.has(status) || (status === 404 && !path.startsWith("/api/session/recover"))) return;
  if (method === "GET" && status !== 400) return; // busy shared networks polling the board are not abusers
  const t = Date.now(); let s = strikes.get(ip);
  if (!s || t - s.start > STRIKE_WINDOW_MS) { s = { start: t, n: 0 }; strikes.set(ip, s); }
  if (++s.n >= BAN_STRIKES && !bans.has(ip)) {
    bans.set(ip, t + BAN_MS); strikes.delete(ip);
    log({ level: "warn", msg: "ip banned", ip, minutes: BAN_MS / 60_000 });
    try { sqlite.prepare("INSERT INTO security_events (kind, subject, detail, created_at) VALUES ('ip_banned', ?, ?, ?)").run(ip.slice(0, 64), `${BAN_STRIKES} rejected calls`, Math.floor(t / 1000)); } catch {}
  }
}
const banned = (ip) => { const until = bans.get(ip); return until && until > Date.now(); };

// ------------------------------------------------------------------ routes
const ROUTES = {
  "GET /api/leaderboard": (r, me) => handleLeaderboard(r, db, me),
  "GET /api/profile": (r, me) => handleProfileGet(r, db, me),
  "POST /api/profile": (r, me) => handleProfilePost(r, db, me),
  "GET /api/raid": (r, me) => handleRaid(r, db, me),
  "POST /api/score": (r, me) => handleScore(r, db, me),
  "POST /api/run/start": (r) => handleRunStart(r, db),
  "POST /api/session/recovery-code": (r, me) => handleRecoveryCode(r, db, me),
  "POST /api/session/recover": (r) => handleRecover(r, db, COOKIE),
  "POST /api/session": (r) => handleSessionCreate(r, db, COOKIE),
  "DELETE /api/session": (r) => handleSessionDelete(r, db, COOKIE),
  "GET /api/session": async (_r, me) => {
    const p = me ? sqlite.prepare("SELECT callsign FROM players WHERE id = ?").get(me) : null;
    return json({ signedIn: !!p, callsign: p?.callsign ?? null });
  },
};

function clientIpOf(req) {
  if (TRUST_PROXY) { const f = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim(); if (f) return f; }
  return req.socket.remoteAddress || "unknown";
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) return null; chunks.push(c); }
  return Buffer.concat(chunks);
}

async function api(req, res, url, ip, started) {
  const handler = ROUTES[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, url.pathname.startsWith("/api/") && Object.keys(ROUTES).some((k) => k.endsWith(" " + url.pathname)) ? 405 : 404, '{"error":"Not found."}', { "Content-Type": "application/json" });
  if (banned(ip)) return send(res, 403, '{"error":"Access paused for this network. Try again later."}', { "Content-Type": "application/json", "Retry-After": String(BAN_MS / 1000) });
  if (!allow("api:" + ip, 300, 60_000)) { strike(ip, 429, url.pathname, req.method); return send(res, 429, '{"error":"Slow down a little."}', { "Content-Type": "application/json", "Retry-After": "60" }); }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  if (body === null) { strike(ip, 413, url.pathname); return send(res, 413, '{"error":"Request too large."}', { "Content-Type": "application/json" }); }
  // identity never comes from headers: rebuild them, dropping anything a client could use to impersonate
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v !== "string" || /^(oai-|cf-connecting-ip$|x-forwarded-for$|x-real-ip$|forwarded$)/i.test(k)) continue;
    headers.set(k, v);
  }
  headers.set("x-forwarded-for", ip);
  const request = new Request(url, { method: req.method, headers, body });
  const me = await sessionPlayer(request, db, COOKIE);
  const out = await handler(request, me);
  const outHeaders = Object.fromEntries(out.headers);
  res.writeHead(out.status, { ...BASE_HEADERS, ...outHeaders });
  res.end(Buffer.from(await out.arrayBuffer()));
  strike(ip, out.status, url.pathname, req.method);
  log({ m: req.method, p: url.pathname, s: out.status, ms: Date.now() - started, ip });
}

function staticFile(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return send(res, 400, "Bad request"); }
  if (path.includes("\0") || path.split("/").some((seg) => seg.startsWith(".") || seg === "_headers")) return send(res, 404, "Not found");
  if (path === "/robots.txt") return send(res, 200, "User-agent: *\nDisallow: /api/\n", { "Cache-Control": "public, max-age=86400" });
  if (path.endsWith("/")) path += "index.html";
  const file = resolve(PUBLIC_DIR, "." + path);
  if (!file.startsWith(PUBLIC_DIR + sep)) return send(res, 404, "Not found");
  let st; try { st = statSync(file); } catch { return send(res, 404, "Not found"); }
  if (!st.isFile()) return send(res, 404, "Not found");
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const headers = { ...BASE_HEADERS, "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": cacheFor(path), ETag: etag, "Last-Modified": st.mtime.toUTCString() };
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(200, { ...headers, "Content-Length": st.size });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const ip = clientIpOf(req);
  try {
    const host = String(req.headers.host || "").toLowerCase().replace(/:\d+$/, "");
    if (req.url === "/healthz") { sqlite.prepare("SELECT 1").get(); return send(res, 200, "ok"); }
    if (ALLOWED_HOSTS.size && !ALLOWED_HOSTS.has(host)) return send(res, 421, "Unknown host");
    if (!allow("all:" + ip, 1200, 60_000)) return send(res, 429, "Too many requests", { "Retry-After": "60" });
    const url = new URL(req.url || "/", `${COOKIE.secure ? "https" : "http"}://${req.headers.host || "localhost"}`);
    if (url.pathname === "/") { res.writeHead(302, { ...BASE_HEADERS, Location: "/index.html" }); return res.end(); }
    if (url.pathname === "/.well-known/security.txt" && SECURITY_CONTACT) {
      const expires = new Date(Date.now() + 365 * 86400_000).toISOString().replace(/\.\d+Z$/, "Z");
      return send(res, 200, `Contact: ${SECURITY_CONTACT}\nExpires: ${expires}\nPreferred-Languages: en, ru\n`, { "Cache-Control": "public, max-age=86400" });
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url, ip, started);
    return staticFile(req, res, url);
  } catch (error) {
    log({ level: "error", msg: String(error?.stack || error), m: req.method, p: req.url, ip });
    if (!res.headersSent) send(res, 500, '{"error":"Server error."}', { "Content-Type": "application/json" }); else res.destroy();
  }
});
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 1000;
server.listen(PORT, HOST, () => log({ msg: `forge server on http://${HOST}:${PORT}`, data: DATA_DIR, secureCookies: COOKIE.secure, trustProxy: TRUST_PROXY }));

// ------------------------------------------------------------------ housekeeping
const housekeeping = setInterval(() => { try { cleanup(sqlite); } catch (e) { log({ level: "error", msg: "cleanup failed " + e.message }); } }, 60 * 60 * 1000);
housekeeping.unref();
if (BACKUP_HOURS > 0) {
  const doBackup = () => { try { log({ msg: "backup written", file: backup(sqlite, join(DATA_DIR, "backups"), BACKUP_KEEP) }); } catch (e) { log({ level: "error", msg: "backup failed " + e.message }); } };
  setTimeout(doBackup, 60_000).unref();
  setInterval(doBackup, BACKUP_HOURS * 3600 * 1000).unref();
}

function shutdown(signal) {
  log({ msg: `${signal}: shutting down` });
  server.close(() => { try { sqlite.close(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

function log(obj) { process.stdout.write(JSON.stringify({ t: new Date().toISOString(), ...obj }) + "\n"); }

function seedDev() {
  const today = new Date().toISOString().slice(0, 10), yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  for (const [id, cs, y, t] of [["dev-1", "NIGHTDRIFTER", 8000, 21500], ["dev-2", "ANA_SOL", 17800, null], ["dev-3", "KAITO", 9000, 9400]]) {
    sqlite.prepare("INSERT INTO players (id, callsign, referral_code) VALUES (?, ?, ?)").run(id, cs, id.toUpperCase().padEnd(8, "X"));
    if (y != null) sqlite.prepare("INSERT INTO arena_scores (player_id, day_key, score, duration_seconds, level, bosses_defeated) VALUES (?,?,?,?,?,?)").run(id, yday, y, 150, 4, 3);
    if (t != null) sqlite.prepare("INSERT INTO arena_scores (player_id, day_key, score, duration_seconds, level, bosses_defeated) VALUES (?,?,?,?,?,?)").run(id, today, t, 150, 4, 3);
  }
  log({ msg: "dev seed: 3 sample players" });
}
