/* $FORGE arena services: pilot profile, shop, raids and run submission.
 *
 * Framework-free like forge-server.ts: each handler takes a standard Request, a D1-compatible database and the
 * id of the player the caller has proven to be (or null), and returns a Response. The self-hosted Node server
 * (server/server.mjs) resolves that id from an anonymous session cookie; the Next routes can pass any other
 * trusted identity. Nothing here reads identity from request headers.
 */
import { clientIp, fail, invalidateBoard, json, logSecurity, now, plausibleRun, rateLimit, sameOrigin, sha256Hex, type D1Like } from "./forge-server.ts";

// ------------------------------------------------------------------ catalog (prices are server-side only)
const moduleCatalog: Record<string, { cost: number; name: string }> = {
  ion: { cost: 250, name: "Ion Core" },
  phantom: { cost: 500, name: "Phantom Hull" },
  overdrive: { cost: 750, name: "Overdrive Array" },
  revenant: { cost: 1200, name: "Revenant Frame" },
  magnet: { cost: 350, name: "Shard Magnet" },
  chrono: { cost: 450, name: "Chrono Greaves" },
  drone: { cost: 900, name: "Warden Drone" },
  nova: { cost: 650, name: "Nova Capacitor" },
  kinetic: { cost: 800, name: "Kinetic Lens" },
  leech: { cost: 1100, name: "Siphon Matrix" },
  aurora: { cost: 1400, name: "Aurora Mantle" },
  rift: { cost: 1800, name: "Rift Walker" },
};
const skinCatalog: Record<string, { cost: number; name: string }> = Object.fromEntries(Array.from({ length: 30 }, (_, index) => {
  const number = index + 11;
  return [`skin-${String(number).padStart(2, "0")}`, { cost: 420 + index * 85, name: `Hangar skin ${number}` }];
}));
const ammoCatalog: Record<string, { cost: number; name: string }> = {
  "ammo-prism": { cost: 280, name: "Prism Darts" },
  "ammo-ember": { cost: 320, name: "Ember Bolts" },
  "ammo-void": { cost: 560, name: "Void Rings" },
  "ammo-toxin": { cost: 480, name: "Toxin Shards" },
  "ammo-frost": { cost: 420, name: "Frost Stars" },
  "ammo-solar": { cost: 680, name: "Solar Orbs" },
  "ammo-glitch": { cost: 760, name: "Glitch Squares" },
};
const CATALOG: Record<string, { cost: number; name: string }> = { ...moduleCatalog, ...skinCatalog, ...ammoCatalog };
const BOSSES = ["THE ARCHIVIST", "MIRROR PROXY", "THE HOLLOW KING"];
const RAID_HP = 5000;
const MAX_BODY = 8 * 1024;
const TICKET_SLACK_SEC = 5;           // clock and network slack when comparing a run's length with its ticket
const TICKET_MAX_AGE_SEC = 3 * 3600;  // a ticket older than this cannot be used

// ------------------------------------------------------------------ POST /api/run/start
/** Issues a one-time run ticket. No session needed: a guest's first run creates the pilot only when it ends. */
export async function handleRunStart(request: Request, db: D1Like): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  if (!(await rateLimit(db, `ticket:${clientIp(request)}`, 120, 3600))) return fail(429, "Too many runs started. Take a short break.");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ticket = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await db.prepare("INSERT INTO run_tickets (id_hash, ip, created_at) VALUES (?, ?, ?)").bind(await sha256Hex("forge-ticket:" + ticket), clientIp(request).slice(0, 64), now()).run();
  return json({ ticket }, 201);
}

const randomCode = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
const utcDay = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ guards shared by every write
/** Same-origin, JSON-only, size-capped body. Returns the parsed object or an error Response. */
export async function readWriteBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!sameOrigin(request)) return fail(403, "Cross-site request blocked.");
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return fail(415, "Send JSON.");
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return fail(413, "Request too large.");
  const text = await request.text();
  if (text.length > MAX_BODY) return fail(413, "Request too large.");
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as Record<string, unknown>;
  } catch {
    return fail(400, "Malformed JSON.");
  }
}

// ------------------------------------------------------------------ callsigns
export function cleanCallsign(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16).toUpperCase() : "";
}
const RESERVED = /^(ADMIN|ADMINISTRATOR|MOD|MODERATOR|STAFF|SUPPORT|OFFICIAL|SYSTEM|ROOT|DEV|TEAM|PILOT|FORGE|STARFORGE|NULL|UNDEFINED)$|^(ADMIN|MOD_|OFFICIAL|SUPPORT|STARFORGE|FORGE_)/;

/** null when the callsign can be used by this player, otherwise a message for them. */
export async function callsignProblem(db: D1Like, callsign: string, selfId: string | null): Promise<string | null> {
  if (callsign.length < 2) return "Use a callsign with at least two letters or numbers.";
  if (RESERVED.test(callsign)) return "That callsign is reserved. Pick another one.";
  const taken = await db.prepare("SELECT 1 AS x FROM players WHERE callsign = ? AND id <> ? LIMIT 1").bind(callsign, selfId ?? "").first();
  return taken ? "That callsign is already taken. Pick another one." : null;
}

async function ensurePlayer(db: D1Like, playerId: string): Promise<void> {
  await db.prepare("INSERT OR IGNORE INTO players (id, callsign, referral_code) VALUES (?, 'PILOT', ?)").bind(playerId, randomCode()).run();
  await db.prepare("UPDATE players SET referral_code = ? WHERE id = ? AND referral_code IS NULL").bind(randomCode(), playerId).run();
}

// ------------------------------------------------------------------ GET /api/profile
export async function handleProfileGet(request: Request, db: D1Like, playerId: string | null): Promise<Response> {
  // a guest is a normal state (they play locally until their first run), not an error
  if (!playerId) return json({ guest: true, player: null });
  try {
    await ensurePlayer(db, playerId);
    const referral = new URL(request.url).searchParams.get("ref")?.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (referral && referral.length === 8) {
      // a referral never links two pilots that signed up from the same network (self-referral farming)
      const inviter = await db.prepare(
        `SELECT inv.id FROM players inv, players me
         WHERE inv.referral_code = ? AND inv.id <> ? AND me.id = ?
           AND (inv.signup_ip_hash IS NULL OR me.signup_ip_hash IS NULL OR inv.signup_ip_hash <> me.signup_ip_hash)`,
      ).bind(referral, playerId, playerId).first<{ id: string }>();
      if (inviter) await db.prepare("UPDATE players SET referred_by = ? WHERE id = ? AND referred_by IS NULL AND total_runs = 0").bind(inviter.id, playerId).run();
    }
    const player = await db.prepare("SELECT callsign, credits, referral_code AS referralCode, welcome_claimed AS welcomeClaimed, lifetime_xp AS lifetimeXp, total_runs AS totalRuns, total_bosses AS totalBosses, total_kills AS totalKills, highest_level AS highestLevel, play_seconds AS playSeconds, equipped_skin AS equippedSkin, equipped_ammo AS equippedAmmo, (SELECT COUNT(*) FROM players invited WHERE invited.referred_by = players.id AND invited.referral_rewarded = 1) AS referrals FROM players WHERE id = ?").bind(playerId).first();
    const items = await db.prepare("SELECT item_id AS itemId FROM inventory WHERE player_id = ?").bind(playerId).all<{ itemId: string }>();
    const p = (player || {}) as Record<string, number>;
    const playSeconds = Math.max(0, Number(p.playSeconds) || 0);
    const earnedSkinCount = Math.min(10, 1 + Math.floor(playSeconds / 420));
    const lvl = Number(p.highestLevel) || 1;
    const achievements = [
      ...(Number(p.totalRuns) >= 1 ? ["first_run"] : []),
      ...(Number(p.totalBosses) >= 1 ? ["boss_breaker"] : []),
      ...(lvl >= 3 ? ["sector_3"] : []),
      ...(lvl >= 6 ? ["sector_6"] : []),
      ...(Number(p.lifetimeXp) >= 5000 ? ["signal_5000"] : []),
      ...(Number(p.totalRuns) >= 10 ? ["ten_runs"] : []),
      ...(Number(p.totalKills) >= 100 ? ["hundred_kills"] : []),
    ];
    return json({
      player,
      inventory: (items.results ?? []).map((item) => item.itemId),
      unlockedMaps: ["rust", ...(lvl >= 2 ? ["neon"] : []), ...(lvl >= 4 ? ["abyss"] : []), ...(lvl >= 7 ? ["orbit"] : [])],
      achievements,
      earnedSkins: Array.from({ length: earnedSkinCount }, (_, index) => `skin-${String(index + 1).padStart(2, "0")}`),
      nextSkinAtSeconds: earnedSkinCount < 10 ? earnedSkinCount * 420 : null,
    });
  } catch (error) {
    console.error("profile read failed", error);
    return fail(503, "Pilot profile unavailable.");
  }
}

// ------------------------------------------------------------------ POST /api/profile
export async function handleProfilePost(request: Request, db: D1Like, playerId: string | null): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  if (!playerId) return fail(401, "Finish a run to create your pilot profile.");
  try {
    if (!(await rateLimit(db, `act:${playerId}`, 90, 60))) return fail(429, "Too many actions. Wait a moment.");
    await ensurePlayer(db, playerId);
    const action = String(body.action || "");

    if (action === "welcome") {
      const result = await db.prepare("UPDATE players SET credits = credits + 1000, welcome_claimed = 1 WHERE id = ? AND welcome_claimed = 0").bind(playerId).run();
      return json({ ok: true, claimed: Boolean(result.meta?.changes), creditsGranted: result.meta?.changes ? 1000 : 0 });
    }
    if (action === "callsign") {
      const callsign = cleanCallsign(body.callsign);
      const problem = await callsignProblem(db, callsign, playerId);
      if (problem) return fail(409, problem);
      await db.batch([
        db.prepare("UPDATE players SET callsign = ? WHERE id = ?").bind(callsign, playerId),
        db.prepare("UPDATE raid_members SET callsign = ? WHERE player_id = ?").bind(callsign, playerId),
      ]);
      return json({ ok: true, callsign });
    }
    if (action === "equip-skin") {
      const skinId = String(body.skinId || "");
      const number = Number(skinId.match(/^skin-(\d{2})$/)?.[1]);
      if (!Number.isInteger(number) || number < 1 || number > 40) return fail(400, "Unknown ship skin.");
      const player = await db.prepare("SELECT play_seconds AS playSeconds FROM players WHERE id = ?").bind(playerId).first<{ playSeconds: number }>();
      const earnedSkinCount = Math.min(10, 1 + Math.floor((Number(player?.playSeconds) || 0) / 420));
      const owned = number <= earnedSkinCount || Boolean(await db.prepare("SELECT 1 AS x FROM inventory WHERE player_id = ? AND item_id = ?").bind(playerId, skinId).first());
      if (!owned) return fail(403, "This skin is still locked.");
      await db.prepare("UPDATE players SET equipped_skin = ? WHERE id = ?").bind(skinId, playerId).run();
      return json({ ok: true, equippedSkin: skinId });
    }
    if (action === "equip-ammo") {
      const ammoId = String(body.ammoId || "");
      if (ammoId !== "ammo-pulse" && !Object.hasOwn(ammoCatalog, ammoId)) return fail(400, "Unknown projectile style.");
      const owned = ammoId === "ammo-pulse" || Boolean(await db.prepare("SELECT 1 AS x FROM inventory WHERE player_id = ? AND item_id = ?").bind(playerId, ammoId).first());
      if (!owned) return fail(403, "Purchase this projectile style first.");
      await db.prepare("UPDATE players SET equipped_ammo = ? WHERE id = ?").bind(ammoId, playerId).run();
      return json({ ok: true, equippedAmmo: ammoId });
    }
    if (action === "buy") {
      const itemId = String(body.item || "");
      if (!Object.hasOwn(CATALOG, itemId)) return fail(400, "This item is not in the catalog.");
      const item = CATALOG[itemId];
      const purchase = await db.batch([
        db.prepare("UPDATE players SET credits = credits - ? WHERE id = ? AND credits >= ? AND NOT EXISTS (SELECT 1 FROM inventory WHERE player_id = ? AND item_id = ?)").bind(item.cost, playerId, item.cost, playerId, itemId),
        db.prepare("INSERT INTO inventory (player_id, item_id) SELECT ?, ? WHERE changes() > 0").bind(playerId, itemId),
      ]);
      if (!(purchase[0]?.meta?.changes ?? 0)) return fail(402, "Not enough credits or this item is already in your inventory.");
      return json({ ok: true, item: itemId });
    }
    if (action === "room-create") {
      if (!(await rateLimit(db, `room:${playerId}`, 10, 3600))) return fail(429, "Too many raid rooms. Try again later.");
      const player = await db.prepare("SELECT callsign FROM players WHERE id = ?").bind(playerId).first<{ callsign: string }>();
      const roomId = crypto.randomUUID();
      const roomCode = randomCode().slice(0, 6);
      const boss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
      await db.batch([
        db.prepare("INSERT INTO raid_rooms (id, code, boss, hp, max_hp, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)").bind(roomId, roomCode, boss, RAID_HP, RAID_HP, Date.now()),
        db.prepare("INSERT INTO raid_members (room_id, player_id, callsign, joined_at) VALUES (?, ?, ?, ?)").bind(roomId, playerId, player?.callsign ?? "PILOT", Date.now()),
      ]);
      return json({ ok: true, code: roomCode });
    }
    if (action === "room-join") {
      const roomCode = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (!(await rateLimit(db, `join:${playerId}`, 20, 600))) return fail(429, "Too many attempts. Try again later.");
      const room = await db.prepare("SELECT id FROM raid_rooms WHERE code = ? AND status = 'open' AND created_at > ?").bind(roomCode, Date.now() - 90 * 60 * 1000).first<{ id: string }>();
      if (!room) return fail(404, "Raid room not found or already complete.");
      const count = await db.prepare("SELECT COUNT(*) AS total FROM raid_members WHERE room_id = ?").bind(room.id).first<{ total: number }>();
      if (Number(count?.total) >= 4) return fail(409, "This raid is full (4 pilots).");
      const player = await db.prepare("SELECT callsign FROM players WHERE id = ?").bind(playerId).first<{ callsign: string }>();
      await db.prepare("INSERT OR IGNORE INTO raid_members (room_id, player_id, callsign, joined_at) VALUES (?, ?, ?, ?)").bind(room.id, playerId, player?.callsign ?? "PILOT", Date.now()).run();
      return json({ ok: true, code: roomCode });
    }
    if (action === "room-hit") {
      if (!(await rateLimit(db, `hit:${playerId}`, 40, 60))) return fail(429, "Easy on the trigger. Strike again in a moment.");
      const roomCode = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      const room = await db.prepare("SELECT id, hp, status FROM raid_rooms WHERE code = ?").bind(roomCode).first<{ id: string; hp: number; status: string }>();
      if (!room || room.status !== "open") return fail(409, "Raid is no longer active.");
      const member = await db.prepare("SELECT 1 AS yes FROM raid_members WHERE room_id = ? AND player_id = ?").bind(room.id, playerId).first();
      if (!member) return fail(403, "Join this raid before attacking.");
      const team = await db.prepare("SELECT COUNT(*) AS total FROM raid_members WHERE room_id = ?").bind(room.id).first<{ total: number }>();
      if (Number(team?.total) < 2) return fail(409, "Invite at least one other pilot before starting a co-op boss raid.");
      const damage = Math.max(0, Math.min(180, Math.floor(Number(body.damage) || 0)));
      const hp = Math.max(0, Number(room.hp) - damage);
      const strike = await db.prepare("UPDATE raid_rooms SET hp = ?, status = ? WHERE id = ? AND status = 'open' AND hp = ?").bind(hp, hp === 0 ? "won" : "open", room.id, room.hp).run();
      if (!(strike.meta?.changes ?? 0)) return fail(409, "The boss moved. Sync the raid and strike again.");
      await db.prepare("UPDATE raid_members SET damage = damage + ? WHERE room_id = ? AND player_id = ?").bind(damage, room.id, playerId).run();
      if (hp === 0) {
        const members = await db.prepare("SELECT player_id AS playerId FROM raid_members WHERE room_id = ?").bind(room.id).all<{ playerId: string }>();
        if (members.results?.length) await db.batch(members.results.map((row) => db.prepare("UPDATE players SET credits = credits + 120 WHERE id = ?").bind(row.playerId)));
      }
      return json({ ok: true });
    }
    return fail(400, "Unknown arena action.");
  } catch (error) {
    console.error("profile action failed", error);
    return fail(503, "Arena action failed. Try again.");
  }
}

// ------------------------------------------------------------------ GET /api/raid?code=
export async function handleRaid(request: Request, db: D1Like, playerId: string | null): Promise<Response> {
  if (!playerId) return fail(401, "Finish a run to join raids.");
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (!code) return fail(400, "Room code required.");
  try {
    if (!(await rateLimit(db, `raid:${clientIp(request)}`, 120, 60))) return fail(429, "Slow down a little.");
    const room = await db.prepare("SELECT code, boss, hp, max_hp AS maxHp, status FROM raid_rooms WHERE code = ?").bind(code).first();
    if (!room) return fail(404, "Raid room not found.");
    const member = await db.prepare("SELECT 1 AS x FROM raid_members WHERE player_id = ? AND room_id = (SELECT id FROM raid_rooms WHERE code = ?)").bind(playerId, code).first();
    if (!member) return fail(403, "Join this raid to see it.");
    const members = await db.prepare("SELECT callsign, damage FROM raid_members WHERE room_id = (SELECT id FROM raid_rooms WHERE code = ?)").bind(code).all();
    return json({ room, members: members.results ?? [] });
  } catch (error) {
    console.error("raid read failed", error);
    return fail(503, "Raid status unavailable.");
  }
}

// ------------------------------------------------------------------ POST /api/score
export async function handleScore(request: Request, db: D1Like, playerId: string | null): Promise<Response> {
  const body = await readWriteBody(request);
  if (body instanceof Response) return body;
  if (!playerId) return fail(401, "Sign in before posting a run.");
  try {
    if (!(await rateLimit(db, `score:${clientIp(request)}`, 60, 3600))) return fail(429, "Too many runs posted. Try again later.");
    const run = {
      score: Number(body.score), duration: Number(body.duration), level: Number(body.level),
      bossesDefeated: Number(body.bossesDefeated), kills: Number(body.kills),
    };
    if (!plausibleRun(run)) {
      await logSecurity(db, "implausible_run", playerId, JSON.stringify(run));
      return fail(400, "That run could not be verified. Play another run and submit again.");
    }
    // the run must have been started on the server at least `duration` seconds ago, and each ticket counts once
    const ticket = typeof body.ticket === "string" && /^[0-9a-f]{32}$/.test(body.ticket) ? body.ticket : "";
    const ticketHash = ticket ? await sha256Hex("forge-ticket:" + ticket) : "";
    const t = now();
    const claimed = ticket ? await db.prepare(
      "UPDATE run_tickets SET used_at = ? WHERE id_hash = ? AND used_at IS NULL AND created_at <= ? AND created_at >= ?",
    ).bind(t, ticketHash, t - Math.max(0, run.duration - TICKET_SLACK_SEC), t - TICKET_MAX_AGE_SEC).run() : null;
    if (!(claimed?.meta?.changes ?? 0)) {
      const row = ticket ? await db.prepare("SELECT created_at AS createdAt, used_at AS usedAt FROM run_tickets WHERE id_hash = ?").bind(ticketHash).first<{ createdAt: number; usedAt: number | null }>() : null;
      const why = !ticket ? "missing" : !row ? "unknown" : row.usedAt ? "reused" : t - Number(row.createdAt) > TICKET_MAX_AGE_SEC ? "expired" : "faster_than_real_time";
      await logSecurity(db, "bad_run_ticket", playerId, JSON.stringify({ why, duration: run.duration, age: row ? t - Number(row.createdAt) : null }));
      return fail(400, "That run could not be verified. Start a new run and try again.");
    }
    await ensurePlayer(db, playerId);
    const existing = await db.prepare("SELECT p.last_submission_at AS last, p.play_seconds AS playSeconds, p.callsign, p.referred_by AS inviter, p.referral_rewarded AS rewarded, (p.signup_ip_hash IS NOT NULL AND p.signup_ip_hash = i.signup_ip_hash) AS sameNetwork FROM players p LEFT JOIN players i ON i.id = p.referred_by WHERE p.id = ?")
      .bind(playerId).first<{ last: number; playSeconds: number; callsign: string; inviter: string | null; rewarded: number; sameNetwork: number | null }>();
    const nowSec = Math.floor(Date.now() / 1000);
    if (existing && nowSec - Number(existing.last) < Math.max(8, Math.floor(run.duration / 2))) {
      await logSecurity(db, "run_too_fast", playerId, JSON.stringify({ since: nowSec - Number(existing.last), duration: run.duration }));
      return fail(429, "Please wait a few seconds before posting another run.");
    }

    // a callsign typed on the launch screen is adopted only if it is free; otherwise the stored one stays
    let callsign = existing?.callsign || "PILOT";
    const wanted = cleanCallsign(body.callsign);
    if (wanted && wanted !== callsign && !(await callsignProblem(db, wanted, playerId))) callsign = wanted;

    const rewardCredits = Math.min(500, Math.floor(run.score / 350));
    // a referral pays out once, and only for a real first run
    const payReferral = Boolean(existing?.inviter) && !Number(existing?.rewarded) && run.duration >= 60 && !Number(existing?.sameNetwork);
    await db.batch([
      db.prepare("UPDATE players SET callsign = ?, last_submission_at = ? WHERE id = ?").bind(callsign, nowSec, playerId),
      db.prepare(
        `INSERT INTO arena_scores (player_id, day_key, score, duration_seconds, level, bosses_defeated)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(player_id, day_key) DO UPDATE SET
           score = excluded.score, duration_seconds = excluded.duration_seconds, level = excluded.level,
           bosses_defeated = excluded.bosses_defeated, submitted_at = CURRENT_TIMESTAMP
         WHERE excluded.score > arena_scores.score`,
      ).bind(playerId, utcDay(), run.score, run.duration, run.level, run.bossesDefeated),
      db.prepare("UPDATE players SET lifetime_xp = lifetime_xp + ?, total_runs = total_runs + 1, total_bosses = total_bosses + ?, total_kills = total_kills + ?, highest_level = MAX(highest_level, ?), play_seconds = play_seconds + ?, credits = credits + ? WHERE id = ?")
        .bind(run.score, run.bossesDefeated, run.kills, run.level, run.duration, rewardCredits, playerId),
      ...(payReferral ? [
        db.prepare("UPDATE players SET credits = credits + 250 WHERE id = ?").bind(existing?.inviter),
        db.prepare("UPDATE players SET referral_rewarded = 1 WHERE id = ? AND referral_rewarded = 0").bind(playerId),
      ] : []),
    ]);
    if (callsign !== existing?.callsign) await db.prepare("UPDATE raid_members SET callsign = ? WHERE player_id = ?").bind(callsign, playerId).run();
    invalidateBoard();

    const before = Number(existing?.playSeconds) || 0, totalPlaySeconds = before + run.duration;
    const earned = Math.min(10, 1 + Math.floor(totalPlaySeconds / 420));
    const newlyEarnedSkin = earned > Math.min(10, 1 + Math.floor(before / 420)) ? `skin-${String(earned).padStart(2, "0")}` : null;
    return json({ ok: true, score: run.score, callsign, creditsEarned: rewardCredits, totalPlaySeconds, newlyEarnedSkin, day: utcDay() }, 201);
  } catch (error) {
    console.error("score submit failed", error);
    return fail(503, "Your run could not be saved. Your local record is still safe.");
  }
}
