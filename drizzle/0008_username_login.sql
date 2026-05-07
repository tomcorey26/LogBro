DELETE FROM active_timers WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@%');--> statement-breakpoint
DELETE FROM time_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@%');--> statement-breakpoint
DELETE FROM routine_session_sets WHERE session_id IN (SELECT id FROM routine_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@%'));--> statement-breakpoint
DELETE FROM routine_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@%');--> statement-breakpoint
DELETE FROM routine_blocks WHERE routine_id IN (SELECT id FROM routines WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@%'));--> statement-breakpoint
DELETE FROM routines WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@%');--> statement-breakpoint
DELETE FROM habits WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@%');--> statement-breakpoint
DELETE FROM users WHERE email LIKE '%@%';--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN "email" TO "username";--> statement-breakpoint
DROP INDEX `users_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);