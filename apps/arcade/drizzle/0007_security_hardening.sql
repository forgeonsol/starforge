CREATE TABLE `run_tickets` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`ip` text NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE INDEX `run_tickets_created` ON `run_tickets` (`created_at`);--> statement-breakpoint
ALTER TABLE `players` ADD `signup_ip_hash` text;--> statement-breakpoint
ALTER TABLE `players` ADD `recovery_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `players_recovery` ON `players` (`recovery_hash`);
