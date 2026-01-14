CREATE TABLE `chat_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_history_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_history_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` text NOT NULL,
	`github_comment_id` text,
	`github_comment_url` text,
	FOREIGN KEY (`chat_history_id`) REFERENCES `chat_history`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_message_attachments` (
	`message_id` text NOT NULL,
	`attachment` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_message_reactions` (
	`message_id` text NOT NULL,
	`emoji` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_username` text NOT NULL,
	`is_mentor` integer DEFAULT false,
	`content` text NOT NULL,
	`message_type` text DEFAULT 'text',
	`language` text,
	`is_ai_generated` integer DEFAULT false,
	`contains_resource` integer DEFAULT false,
	`extracted_resource_id` text,
	`timestamp` text NOT NULL,
	`edited_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_session_key_points` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`key_point` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_session_mentees` (
	`session_id` text NOT NULL,
	`mentee_id` text NOT NULL,
	`mentee_username` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mentee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_session_resources` (
	`session_id` text NOT NULL,
	`resource_id` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mentor_id` text NOT NULL,
	`mentor_username` text NOT NULL,
	`session_type` text DEFAULT 'one_on_one',
	`issue_id` text,
	`repo_name` text,
	`topic` text,
	`status` text DEFAULT 'active',
	`started_at` text NOT NULL,
	`ended_at` text,
	`last_activity_at` text NOT NULL,
	`summary` text,
	`message_count` integer DEFAULT 0,
	`duration_minutes` integer DEFAULT 0,
	FOREIGN KEY (`mentor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `global_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`sender_username` text NOT NULL,
	`sender_avatar_url` text,
	`content` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issue_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_chat_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` text NOT NULL,
	`github_comment_id` text,
	`github_comment_url` text,
	FOREIGN KEY (`issue_chat_id`) REFERENCES `issue_chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issue_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`github_issue_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`author_name` text NOT NULL,
	`repo_id` text NOT NULL,
	`repo_name` text NOT NULL,
	`owner` text,
	`repo` text,
	`html_url` text,
	`state` text DEFAULT 'open' NOT NULL,
	`is_pr` integer DEFAULT false NOT NULL,
	`author_association` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mentor_frameworks` (
	`mentor_id` text NOT NULL,
	`framework` text NOT NULL,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_languages` (
	`mentor_id` text NOT NULL,
	`language` text NOT NULL,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_match_skills` (
	`match_id` text NOT NULL,
	`skill` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `mentor_matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`mentor_id` text NOT NULL,
	`mentor_username` text NOT NULL,
	`mentee_id` text NOT NULL,
	`mentee_username` text NOT NULL,
	`compatibility_score` real NOT NULL,
	`match_reason` text,
	`issue_id` text,
	`repo_name` text,
	`status` text DEFAULT 'suggested',
	`created_at` text NOT NULL,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mentee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_preferred_topics` (
	`mentor_id` text NOT NULL,
	`topic` text NOT NULL,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`mentor_id` text NOT NULL,
	`mentee_id` text NOT NULL,
	`session_id` text,
	`rating` integer NOT NULL,
	`feedback` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mentee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentor_tech_stack` (
	`mentor_id` text NOT NULL,
	`tech` text NOT NULL,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentors` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`expertise_level` text DEFAULT 'intermediate',
	`availability_hours_per_week` integer DEFAULT 5,
	`timezone` text,
	`is_active` integer DEFAULT true,
	`bio` text,
	`avatar_url` text,
	`mentee_count` integer DEFAULT 0,
	`sessions_completed` integer DEFAULT 0,
	`avg_rating` real DEFAULT 0,
	`total_ratings` integer DEFAULT 0,
	`max_mentees` integer DEFAULT 3,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mentorship_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`mentee_id` text NOT NULL,
	`mentee_username` text,
	`mentor_id` text NOT NULL,
	`mentor_username` text,
	`issue_id` text,
	`message` text,
	`status` text DEFAULT 'pending',
	`created_at` text NOT NULL,
	FOREIGN KEY (`mentee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mentor_id`) REFERENCES `mentors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`content` text NOT NULL,
	`read` integer DEFAULT false,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profile_connected_repos` (
	`profile_id` text NOT NULL,
	`repo_name` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profile_mentoring_topics` (
	`profile_id` text NOT NULL,
	`topic` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profile_skills` (
	`profile_id` text NOT NULL,
	`skill` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`avatar_url` text,
	`bio` text,
	`location` text,
	`website` text,
	`twitter` text,
	`available_for_mentoring` integer DEFAULT false,
	`profile_visibility` text DEFAULT 'public',
	`show_email` integer DEFAULT false,
	`github_stats` text,
	`stats_updated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`github_repo_id` integer NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resource_tags` (
	`resource_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_name` text NOT NULL,
	`source_type` text DEFAULT 'chat',
	`source_id` text,
	`resource_type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`language` text,
	`shared_by` text NOT NULL,
	`shared_by_id` text NOT NULL,
	`save_count` integer DEFAULT 0,
	`helpful_count` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shared_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`owner_id` text NOT NULL,
	`trigger_classification` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `triage_data` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`classification` text NOT NULL,
	`summary` text NOT NULL,
	`suggested_label` text NOT NULL,
	`sentiment` text NOT NULL,
	`analyzed_at` text NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trophies` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`trophy_type` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`rarity` text NOT NULL,
	`svg_data` text,
	`is_public` integer DEFAULT true,
	`share_url` text,
	`earned_for` text,
	`milestone_value` integer,
	`awarded_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`added_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_repo_unique` ON `user_repositories` (`user_id`,`repo_full_name`);--> statement-breakpoint
CREATE TABLE `user_saved_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`notes` text,
	`saved_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` integer NOT NULL,
	`username` text NOT NULL,
	`avatar_url` text NOT NULL,
	`role` text,
	`github_access_token` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);