CREATE TABLE `private_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`repo_owner` text NOT NULL,
	`pr_author` text NOT NULL,
	`resource_type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`language` text,
	`shared_by` text NOT NULL,
	`shared_by_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `repositories` ADD `added_by_user` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `repositories` ADD `etag` text;--> statement-breakpoint
ALTER TABLE `repositories` ADD `last_synced_at` text;