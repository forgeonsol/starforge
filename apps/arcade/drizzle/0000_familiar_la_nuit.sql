CREATE TABLE `arena_scores` (
	`player_id` text NOT NULL,
	`day_key` text NOT NULL,
	`score` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`level` integer NOT NULL,
	`bosses_defeated` integer NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`player_id`, `day_key`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `arena_scores_daily_board` ON `arena_scores` (`day_key`,`score`,`bosses_defeated`,`duration_seconds`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`callsign` text NOT NULL,
	`last_submission_at` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
