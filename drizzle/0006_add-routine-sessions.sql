CREATE TABLE `routine_session_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`block_index` integer NOT NULL,
	`set_index` integer NOT NULL,
	`habit_id` integer,
	`habit_name_snapshot` text NOT NULL,
	`notes_snapshot` text,
	`planned_duration_seconds` integer NOT NULL,
	`planned_break_seconds` integer NOT NULL,
	`actual_duration_seconds` integer,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `routine_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_session_sets_position` ON `routine_session_sets` (`session_id`,`block_index`,`set_index`);--> statement-breakpoint
CREATE TABLE `routine_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`routine_id` integer,
	`routine_name_snapshot` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_sessions_one_active_per_user` ON `routine_sessions` (`user_id`) WHERE status = 'active';--> statement-breakpoint
ALTER TABLE `active_timers` ADD `routine_session_set_id` integer REFERENCES routine_session_sets(id);--> statement-breakpoint
ALTER TABLE `active_timers` ADD `phase` text;