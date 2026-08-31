CREATE TABLE `user_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_user_state_updated_at` ON `user_state` (`updated_at`);