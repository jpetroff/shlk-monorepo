CREATE TABLE `banlist` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "banlist_type_ck" CHECK("banlist"."type" IN ('IP', 'user', 'location'))
);
--> statement-breakpoint
CREATE INDEX `banlist_type_idx` ON `banlist` (`type`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`session_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `shortlinks` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`location` text NOT NULL,
	`descriptor_user_tag` text,
	`descriptor_description_tag` text,
	`owner_id` text,
	`url_metadata` text,
	`site_title` text,
	`site_description` text,
	`snooze_awake` integer,
	`snooze_description` text,
	`tags` text,
	`search_index` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shortlinks_hash_uq` ON `shortlinks` (`hash`);--> statement-breakpoint
CREATE INDEX `shortlinks_owner_created_idx` ON `shortlinks` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shortlinks_snooze_idx` ON `shortlinks` (`owner_id`,`snooze_awake`);--> statement-breakpoint
CREATE UNIQUE INDEX `shortlinks_descriptor_uq` ON `shortlinks` (`descriptor_user_tag`,`descriptor_description_tag`) WHERE "shortlinks"."descriptor_description_tag" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `shortlinks_owner_location_uq` ON `shortlinks` (`owner_id`,`location`) WHERE "shortlinks"."owner_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`user_tag` text,
	`id_token` text,
	`access_token` text,
	`refresh_token` text,
	`ip` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_id_token_uq` ON `users` (`id_token`) WHERE "users"."id_token" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_access_token_uq` ON `users` (`access_token`) WHERE "users"."access_token" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_refresh_token_uq` ON `users` (`refresh_token`) WHERE "users"."refresh_token" IS NOT NULL;