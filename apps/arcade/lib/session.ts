/* Anonymous pilot sessions for the self-hosted server.
 *
 * No e-mail, no password: a player picks a callsign, the server creates the account and hands back a random
 * 256-bit token in an HttpOnly cookie. Only the SHA-256 of the token is stored, so a database leak does not leak
 * sessions. Sessions slide: each day of use extends them, an idle one expires after SESSION_DAYS.
 */
import { clientIp, fail, json, logSecurity, now, rateLimit, sha256Hex, type D1Like } from "./forge-server.ts";
import { callsignProblem, cleanCallsign, readWriteBody } from "./arena.ts";

export const SESSION_DAYS = 180;
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
  const token = randomToken();
  const t = now();
  const referral = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  try {
    await db.batch([
      db.prepare("INSERT INTO players (id, callsign, referral_code) VALUES (?, ?, ?)").bind(playerId, callsign, referral),
      db.prepare("INSERT INTO player_sessions (token_hash, player_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
        .bind(await sha256Hex("forge-session:" + token), playerId, t, t + SESSION_SEC, t),
    ]);
  } catch {
    // two people grabbing the same callsign at the same moment, or a referral-code collision
    return fail(409, "That callsign was just taken. Pick another one.");
  }
  return json({ ok: true, created: true, callsign }, 201, { "Set-Cookie": makeCookie(o, token, SESSION_SEC) });
}

/** DELETE /api/session — signs this browser out (the pilot stays on the board). */
export async function handleSessionDelete(request: Request, db: D1Like, o: CookieOptions): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  const token = readCookie(request, cookieName(o));
  if (token) await db.prepare("DELETE FROM player_sessions WHERE token_hash = ?").bind(await sha256Hex("forge-session:" + token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": makeCookie(o, "", 0) });
}
