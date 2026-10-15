CREATE TABLE `inventory` (
	`player_id` text NOT NULL,
	`item_id` text NOT NULL,
	`purchased_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`player_id`, `item_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `raid_members` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`callsign` text NOT NULL,
	`damage` integer DEFAULT 0 NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `player_id`),
	FOREIGN KEY (`room_id`) REFERENCES `raid_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `raid_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`boss` text NOT NULL,
	`hp` integer NOT NULL,
	`max_hp` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raid_rooms_code_unique` ON `raid_rooms` (`code`);--> statement-breakpoint
ALTER TABLE `players` ADD `credits` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `referral_code` text;--> statement-breakpoint
ALTER TABLE `players` ADD `referred_by` text;--> statement-breakpoint
ALTER TABLE `players` ADD `referral_rewarded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `players_referral_code_unique` ON `players` (`referral_code`);
