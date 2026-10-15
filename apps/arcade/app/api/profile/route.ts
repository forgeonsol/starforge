import { getChatGPTUser } from "../../chatgpt-auth";
import { getArenaDb } from "../../../db/d1";

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
const skinCatalog = Object.fromEntries(Array.from({ length: 30 }, (_, index) => {
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
const CATALOG: Record<string, { cost: number; name: string }> = {
  ...moduleCatalog,
  ...skinCatalog as Record<string, { cost: number; name: string }>,
  ...ammoCatalog,
};
const BOSSES = ["THE ARCHIVIST", "MIRROR PROXY", "THE HOLLOW KING"];
const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16).toUpperCase() : "";
const code = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

async function current() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getArenaDb();
  await db.prepare("INSERT OR IGNORE INTO players (id, callsign, referral_code) VALUES (?, ?, ?)")
    .bind(user.userId, "PILOT", code()).run();
  await db.prepare("UPDATE players SET referral_code = ? WHERE id = ? AND referral_code IS NULL")
    .bind(code(), user.userId).run();
  return { user, db };
}

export async function GET(request: Request) {
  try {
    const ctx = await current();
    if (!ctx) return Response.json({ error: "Sign in to access your pilot profile." }, { status: 401 });
    const { user, db } = ctx;
    const referral = new URL(request.url).searchParams.get("ref")?.toUpperCase();
    if (referral && referral.length === 8) {
      const inviter = await db.prepare("SELECT id FROM players WHERE referral_code = ? AND id <> ?").bind(referral, user.userId).first<{ id: string }>();
      if (inviter) await db.prepare("UPDATE players SET referred_by = ? WHERE id = ? AND referred_by IS NULL").bind(inviter.id, user.userId).run();
    }
    const player = await db.prepare("SELECT callsign, credits, referral_code AS referralCode, welcome_claimed AS welcomeClaimed, lifetime_xp AS lifetimeXp, total_runs AS totalRuns, total_bosses AS totalBosses, total_kills AS totalKills, highest_level AS highestLevel, play_seconds AS playSeconds, equipped_skin AS equippedSkin, equipped_ammo AS equippedAmmo, (SELECT COUNT(*) FROM players invited WHERE invited.referred_by = players.id AND invited.referral_rewarded = 1) AS referrals FROM players WHERE id = ?").bind(user.userId).first();
    const items = await db.prepare("SELECT item_id AS itemId FROM inventory WHERE player_id = ?").bind(user.userId).all<{ itemId: string }>();
    const progress = player as { lifetimeXp?: number; totalRuns?: number; totalBosses?: number; totalKills?: number; highestLevel?: number; playSeconds?: number } | null;
    const playSeconds = Math.max(0, Number(progress?.playSeconds) || 0);
    const earnedSkinCount = Math.min(10, 1 + Math.floor(playSeconds / 420));
    const earnedSkins = Array.from({ length: earnedSkinCount }, (_, index) => `skin-${String(index + 1).padStart(2, "0")}`);
    const unlockedMaps = ["rust", ...(Number(progress?.highestLevel) >= 2 ? ["neon"] : []), ...(Number(progress?.highestLevel) >= 4 ? ["abyss"] : []), ...(Number(progress?.highestLevel) >= 7 ? ["orbit"] : [])];
    const achievements = [
      ...(Number(progress?.totalRuns) >= 1 ? ["first_run"] : []),
      ...(Number(progress?.totalBosses) >= 1 ? ["boss_breaker"] : []),
      ...(Number(progress?.highestLevel) >= 3 ? ["sector_3"] : []),
      ...(Number(progress?.highestLevel) >= 6 ? ["sector_6"] : []),
      ...(Number(progress?.lifetimeXp) >= 5000 ? ["signal_5000"] : []),
      ...(Number(progress?.totalRuns) >= 10 ? ["ten_runs"] : []),
      ...(Number(progress?.totalKills) >= 100 ? ["hundred_kills"] : []),
    ];
    return Response.json({ player, inventory: (items.results ?? []).map((item) => item.itemId), unlockedMaps, achievements, earnedSkins, nextSkinAtSeconds: earnedSkinCount < 10 ? earnedSkinCount * 420 : null });
  } catch (error) {
    console.error("profile read failed", error);
    return Response.json({ error: "Pilot profile unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await current();
    if (!ctx) return Response.json({ error: "Sign in to use the arena services." }, { status: 401 });
    const { user, db } = ctx;
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (action === "welcome") {
      const result = await db.prepare("UPDATE players SET credits = credits + 1000, welcome_claimed = 1 WHERE id = ? AND welcome_claimed = 0").bind(user.userId).run();
      return Response.json({ ok: true, claimed: Boolean(result.meta?.changes), creditsGranted: result.meta?.changes ? 1000 : 0 });
    }
    if (action === "callsign") {
      const callsign = clean(body.callsign);
      if (callsign.length < 2) return Response.json({ error: "Callsign must have at least two characters." }, { status: 400 });
      await db.prepare("UPDATE players SET callsign = ? WHERE id = ?").bind(callsign, user.userId).run();
      await db.prepare("UPDATE raid_members SET callsign = ? WHERE player_id = ?").bind(callsign, user.userId).run();
      return Response.json({ ok: true });
    }
    if (action === "equip-skin") {
      const skinId = String(body.skinId || "");
      const number = Number(skinId.match(/^skin-(\d{2})$/)?.[1]);
      if (!Number.isInteger(number) || number < 1 || number > 40) return Response.json({ error: "Unknown ship skin." }, { status: 400 });
      const player = await db.prepare("SELECT play_seconds AS playSeconds FROM players WHERE id = ?").bind(user.userId).first<{ playSeconds: number }>();
      const earnedSkinCount = Math.min(10, 1 + Math.floor((Number(player?.playSeconds) || 0) / 420));
      const owned = number <= earnedSkinCount || Boolean(await db.prepare("SELECT 1 FROM inventory WHERE player_id = ? AND item_id = ?").bind(user.userId, skinId).first());
      if (!owned) return Response.json({ error: "This skin is still locked." }, { status: 403 });
      await db.prepare("UPDATE players SET equipped_skin = ? WHERE id = ?").bind(skinId, user.userId).run();
      return Response.json({ ok: true, equippedSkin: skinId });
    }
    if (action === "equip-ammo") {
      const ammoId = String(body.ammoId || "");
      if (ammoId !== "ammo-pulse" && !Object.hasOwn(ammoCatalog, ammoId)) return Response.json({ error: "Unknown projectile style." }, { status: 400 });
      const owned = ammoId === "ammo-pulse" || Boolean(await db.prepare("SELECT 1 FROM inventory WHERE player_id = ? AND item_id = ?").bind(user.userId, ammoId).first());
      if (!owned) return Response.json({ error: "Purchase this projectile style first." }, { status: 403 });
      await db.prepare("UPDATE players SET equipped_ammo = ? WHERE id = ?").bind(ammoId, user.userId).run();
      return Response.json({ ok: true, equippedAmmo: ammoId });
    }
    if (action === "buy") {
      const item = CATALOG[String(body.item)];
      if (!item) return Response.json({ error: "This item is not in the catalog." }, { status: 400 });
      const purchase = await db.batch([
        db.prepare("UPDATE players SET credits = credits - ? WHERE id = ? AND credits >= ? AND NOT EXISTS (SELECT 1 FROM inventory WHERE player_id = ? AND item_id = ?)").bind(item.cost, user.userId, item.cost, user.userId, body.item),
        db.prepare("INSERT INTO inventory (player_id, item_id) SELECT ?, ? WHERE changes() > 0").bind(user.userId, body.item),
      ]);
      if (!(purchase[0]?.meta?.changes ?? 0)) return Response.json({ error: "Not enough credits or this item is already in your inventory." }, { status: 402 });
      return Response.json({ ok: true, item: body.item });
    }
    if (action === "room-create") {
      const player = await db.prepare("SELECT callsign FROM players WHERE id = ?").bind(user.userId).first<{ callsign: string }>();
      const roomId = crypto.randomUUID();
      const roomCode = code().slice(0, 6);
      const boss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
      const hp = 5000;
      await db.batch([
        db.prepare("INSERT INTO raid_rooms (id, code, boss, hp, max_hp, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)").bind(roomId, roomCode, boss, hp, hp, Date.now()),
        db.prepare("INSERT INTO raid_members (room_id, player_id, callsign, joined_at) VALUES (?, ?, ?, ?)").bind(roomId, user.userId, player?.callsign ?? "PILOT", Date.now()),
      ]);
      return Response.json({ ok: true, code: roomCode });
    }
    if (action === "room-join") {
      const roomCode = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      const room = await db.prepare("SELECT id FROM raid_rooms WHERE code = ? AND status = 'open' AND created_at > ?").bind(roomCode, Date.now() - 90 * 60 * 1000).first<{ id: string }>();
      if (!room) return Response.json({ error: "Raid room not found or already complete." }, { status: 404 });
      const count = await db.prepare("SELECT COUNT(*) AS total FROM raid_members WHERE room_id = ?").bind(room.id).first<{ total: number }>();
      if (Number(count?.total) >= 4) return Response.json({ error: "This raid is full (4 pilots)." }, { status: 409 });
      const player = await db.prepare("SELECT callsign FROM players WHERE id = ?").bind(user.userId).first<{ callsign: string }>();
      await db.prepare("INSERT OR IGNORE INTO raid_members (room_id, player_id, callsign, joined_at) VALUES (?, ?, ?, ?)").bind(room.id, user.userId, player?.callsign ?? "PILOT", Date.now()).run();
      return Response.json({ ok: true, code: roomCode });
    }
    if (action === "room-hit") {
      const roomCode = String(body.code || "").toUpperCase();
      const room = await db.prepare("SELECT id, hp, status FROM raid_rooms WHERE code = ?").bind(roomCode).first<{ id: string; hp: number; status: string }>();
      if (!room || room.status !== "open") return Response.json({ error: "Raid is no longer active." }, { status: 409 });
      const member = await db.prepare("SELECT 1 AS yes FROM raid_members WHERE room_id = ? AND player_id = ?").bind(room.id, user.userId).first();
      if (!member) return Response.json({ error: "Join this raid before attacking." }, { status: 403 });
      const team = await db.prepare("SELECT COUNT(*) AS total FROM raid_members WHERE room_id = ?").bind(room.id).first<{ total: number }>();
      if (Number(team?.total) < 2) return Response.json({ error: "Invite at least one other pilot before starting a co-op boss raid." }, { status: 409 });
      const damage = Math.max(0, Math.min(180, Math.floor(Number(body.damage) || 0)));
      const hp = Math.max(0, Number(room.hp) - damage);
      const strike = await db.prepare("UPDATE raid_rooms SET hp = ?, status = ? WHERE id = ? AND status = 'open' AND hp = ?").bind(hp, hp === 0 ? "won" : "open", room.id, room.hp).run();
      if (!(strike.meta?.changes ?? 0)) return Response.json({ error: "The boss moved. Sync the raid and strike again." }, { status: 409 });
      await db.prepare("UPDATE raid_members SET damage = damage + ? WHERE room_id = ? AND player_id = ?").bind(damage, room.id, user.userId).run();
      if (hp === 0) {
        const members = await db.prepare("SELECT player_id AS playerId FROM raid_members WHERE room_id = ?").bind(room.id).all<{ playerId: string }>();
        if (members.results?.length) await db.batch(members.results.map((memberRow) => db.prepare("UPDATE players SET credits = credits + 120 WHERE id = ?").bind(memberRow.playerId)));
      }
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown arena action." }, { status: 400 });
  } catch (error) {
    console.error("profile action failed", error);
    return Response.json({ error: "Arena action failed. Try again." }, { status: 503 });
  }
}
