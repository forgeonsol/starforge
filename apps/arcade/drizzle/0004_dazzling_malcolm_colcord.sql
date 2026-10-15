ALTER TABLE `players` ADD `play_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `equipped_skin` text DEFAULT 'skin-01' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `equipped_ammo` text DEFAULT 'ammo-pulse' NOT NULL;