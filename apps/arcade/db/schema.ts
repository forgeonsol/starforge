import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  callsign: text("callsign").notNull(),
  credits: integer("credits").notNull().default(0),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  referralRewarded: integer("referral_rewarded").notNull().default(0),
  welcomeClaimed: integer("welcome_claimed").notNull().default(0),
  lifetimeXp: integer("lifetime_xp").notNull().default(0),
  totalRuns: integer("total_runs").notNull().default(0),
  totalBosses: integer("total_bosses").notNull().default(0),
  totalKills: integer("total_kills").notNull().default(0),
  highestLevel: integer("highest_level").notNull().default(1),
  playSeconds: integer("play_seconds").notNull().default(0),
  equippedSkin: text("equipped_skin").notNull().default("skin-01"),
  equippedAmmo: text("equipped_ammo").notNull().default("ammo-pulse"),
  lastSubmissionAt: integer("last_submission_at").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const inventory = sqliteTable("inventory", {
  playerId: text("player_id").notNull().references(() => players.id),
  itemId: text("item_id").notNull(),
  purchasedAt: text("purchased_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({ pk: primaryKey({ columns: [table.playerId, table.itemId] }) }));

export const raidRooms = sqliteTable("raid_rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  boss: text("boss").notNull(),
  hp: integer("hp").notNull(),
  maxHp: integer("max_hp").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at").notNull(),
});

export const raidMembers = sqliteTable("raid_members", {
  roomId: text("room_id").notNull().references(() => raidRooms.id),
  playerId: text("player_id").notNull().references(() => players.id),
  callsign: text("callsign").notNull(),
  damage: integer("damage").notNull().default(0),
  joinedAt: integer("joined_at").notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.roomId, table.playerId] }) }));

export const arenaScores = sqliteTable(
  "arena_scores",
  {
    playerId: text("player_id").notNull().references(() => players.id),
    dayKey: text("day_key").notNull(),
    score: integer("score").notNull(),
    duration: integer("duration_seconds").notNull(),
    level: integer("level").notNull(),
    bossesDefeated: integer("bosses_defeated").notNull(),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.dayKey] }),
    boardIndex: index("arena_scores_daily_board").on(
      table.dayKey,
      table.score,
      table.bossesDefeated,
      table.duration,
    ),
  }),
);

export const rateLimits = sqliteTable("rate_limits", {
  bucket: text("bucket").primaryKey(),
  windowStart: integer("window_start").notNull(),
  hits: integer("hits").notNull(),
});

export const securityEvents = sqliteTable("security_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  subject: text("subject").notNull(),
  detail: text("detail").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => ({ byTime: index("security_events_time").on(t.createdAt) }));

export const playerSessions = sqliteTable("player_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  playerId: text("player_id").notNull().references(() => players.id),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
}, (t) => ({ byPlayer: index("player_sessions_player").on(t.playerId), byExpiry: index("player_sessions_expiry").on(t.expiresAt) }));
