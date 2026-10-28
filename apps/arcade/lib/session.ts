/* Anonymous pilot sessions for the self-hosted server.
 *
 * No e-mail, no password: a player picks a callsign, the server creates the account and hands back a random
 * 256-bit token in an HttpOnly cookie. Only the SHA-256 of the token is stored, so a database leak does not leak
 * sessions. Sessions slide: each day of use extends them, an idle one expires after SESSION_DAYS.
 */
import { clientIp, fail, json, logSecurity, now, rateLimit, sha256Hex, type D1Like } from "./forge-server.ts";
import { callsignProblem, cleanCallsign, readWriteBody } from "./arena.ts";

export const SESSION_DAYS = 180;
const MAX_SESSIONS_PER_PILOT = 5;
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const SESSION_SEC = SESSION_DAYS * 86400;

export type CookieOptions = { secure: boolean };
export const cookieName = (o: CookieOptions) => (o.secure ? "__Host-forge_sid" : "forge_sid");

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
function makeCookie(o: CookieOptions, value: string, maxAge: number): string {
  return `${cookieName(o)}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${o.secure ? "; Secure" : ""}`;
}
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The player id behind the request's session cookie, or null. Never trusts any identity header. */
export async function sessionPlayer(request: Request, db: D1Like, o: CookieOptions): Promise<string | null> {
  const token = readCookie(request, cookieName(o));
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = await sha256Hex("forge-session:" + token);
  const t = now();
  const row = await db.prepare("SELECT player_id AS playerId, last_seen_at AS seen FROM player_sessions WHERE token_hash = ? AND expires_at > ?").bind(hash, t).first<{ playerId: string; seen: number }>();
  if (!row) return null;
  if (t - Number(row.seen) > 86400) {
    await db.prepare("UPDATE player_sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?").bind(t, t + SESSION_SEC, hash).run();
  }
  return row.playerId;
}

export const ipHash = (ip: string) => sha256Hex("forge-ip:" + ip);

/** Creates a session for a pilot, keeps only their newest sessions, and returns the Set-Cookie value. */
async function openSession(db: D1Like, o: CookieOptions, playerId: string): Promise<string> {
  const token = randomToken(), t = now();
  await db.prepare("INSERT INTO player_sessions (token_hash, player_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256Hex("forge-session:" + token), playerId, t, t + SESSION_SEC, t).run();
  await db.prepare(`DELETE FROM player_sessions WHERE player_id = ? AND token_hash NOT IN
    (SELECT token_hash FROM player_sessions WHERE player_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_SESSIONS_PER_PILOT})`).bind(playerId, playerId).run();
  return makeCookie(o, token, SESSION_SEC);
}

function newRecoveryCode(): string {
  // rejection sampling keeps every character equally likely (~99 bits in total)
  const limit = 256 - (256 % RECOVERY_ALPHABET.length);
  let chars = "";
  while (chars.length < 20) for (const x of crypto.getRandomValues(new Uint8Array(32))) if (x < limit && chars.length < 20) chars += RECOVERY_ALPHABET[x % RECOVERY_ALPHABET.length];
  return chars.match(/.{5}/g)!.join("-");
}
const normalizeRecovery = (v: unknown) => (typeof v === "string" ? v.toUpperCase().replace(/[^A-Z0-9]/g, "") : "");
const recoveryHash = (normalized: string) => sha256Hex("forge-recovery:" + normalized);

/** POST /api/session/recovery-code — issues a new one-time recovery code for the signed-in pilot (shown once). */
export async function handleRecoveryCode(request: Request, db: D1Like, playerId: string | null): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  if (!playerId) return fail(401, "Finish a run first to create your pilot.");
  if (!(await rateLimit(db, `recovery-new:${playerId}`, 5, 3600))) return fail(429, "Too many new codes. Try again later.");
  const code = newRecoveryCode();
  await db.prepare("UPDATE players SET recovery_hash = ? WHERE id = ?").bind(await recoveryHash(normalizeRecovery(code)), playerId).run();
  return json({ ok: true, code });
}

/** POST /api/session/recover {code} — signs this browser in as the pilot the code belongs to. The code is used up. */
export async function handleRecover(request: Request, db: D1Like, o: CookieOptions): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  const ip = clientIp(request);
  if (!(await rateLimit(db, `recover-h:${ip}`, 10, 3600)) || !(await rateLimit(db, `recover-d:${ip}`, 30, 86400))) {
    await logSecurity(db, "recovery_flood", ip, "");
    return fail(429, "Too many attempts. Try again later.");
  }
  const code = normalizeRecovery(body.code);
  if (code.length !== 20) return fail(400, "Enter the 20-character recovery code.");
  const hash = await recoveryHash(code);
  const player = await db.prepare("SELECT id, callsign FROM players WHERE recovery_hash = ?").bind(hash).first<{ id: string; callsign: string }>();
  // the code is spent atomically, so two browsers racing with one code cannot both win
  const spent = player ? await db.prepare("UPDATE players SET recovery_hash = NULL WHERE id = ? AND recovery_hash = ?").bind(player.id, hash).run() : null;
  if (!player || !(spent?.meta?.changes ?? 0)) {
    await logSecurity(db, "recovery_failed", ip, "");
    return fail(404, "That recovery code is not valid.");
  }
  const cookie = await openSession(db, o, player.id);
  return json({ ok: true, callsign: player.callsign }, 200, { "Set-Cookie": cookie });
}

/** POST /api/session {callsign} — creates a pilot and signs this browser in. */
export async function handleSessionCreate(request: Request, db: D1Like, o: CookieOptions): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  const existing = await sessionPlayer(request, db, o);
  if (existing) {
    const p = await db.prepare("SELECT callsign FROM players WHERE id = ?").bind(existing).first<{ callsign: string }>();
    return json({ ok: true, created: false, callsign: p?.callsign ?? null });
  }
  const ip = clientIp(request);
  if (!(await rateLimit(db, `signup-h:${ip}`, 5, 3600)) || !(await rateLimit(db, `signup-d:${ip}`, 20, 86400))) {
    await logSecurity(db, "signup_flood", ip, "");
    return fail(429, "Too many new pilots from this network. Try again later.");
  }
  const callsign = cleanCallsign(body.callsign);
  const problem = await callsignProblem(db, callsign, null);
  if (problem) return fail(409, problem);

  const playerId = "p_" + crypto.randomUUID().replace(/-/g, "");
  const referral = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  try {
    await db.prepare("INSERT INTO players (id, callsign, referral_code, signup_ip_hash) VALUES (?, ?, ?, ?)").bind(playerId, callsign, referral, await ipHash(ip)).run();
  } catch {
    // a referral-code collision (one in billions); ask for a retry
    return fail(409, "Could not create the pilot. Try again.");
  }
  return json({ ok: true, created: true, callsign }, 201, { "Set-Cookie": await openSession(db, o, playerId) });
}

/** DELETE /api/session — signs this browser out (the pilot stays on the board). */
export async function handleSessionDelete(request: Request, db: D1Like, o: CookieOptions): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  const token = readCookie(request, cookieName(o));
  if (token) await db.prepare("DELETE FROM player_sessions WHERE token_hash = ?").bind(await sha256Hex("forge-session:" + token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": makeCookie(o, "", 0) });
}
