ALTER TABLE `issues` ADD `body_summary` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `head_sha` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `triage_data` ADD `bug_risk_score` integer;--> statement-breakpoint
ALTER TABLE `triage_data` ADD `toxicity_flag` integer DEFAULT false;