CREATE TABLE `player_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL REFERENCES `players`(`id`),
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `player_sessions_player` ON `player_sessions` (`player_id`);--> statement-breakpoint
CREATE INDEX `player_sessions_expiry` ON `player_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `players_callsign` ON `players` (`callsign`);
