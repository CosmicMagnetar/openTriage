-- Self-updating opportunities + program participation. Additive: new tables only.
CREATE TABLE IF NOT EXISTS `opportunities` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `source` text NOT NULL,
  `data` text NOT NULL,
  `ends_on` text,
  `recurring` integer DEFAULT false NOT NULL,
  `link_failures` integer DEFAULT 0 NOT NULL,
  `last_seen_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `opportunities_kind` ON `opportunities` (`kind`);
CREATE TABLE IF NOT EXISTS `opportunity_sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `started_at` text NOT NULL,
  `finished_at` text,
  `ok` integer,
  `summary` text
);
CREATE TABLE IF NOT EXISTS `program_participation` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `program_id` text NOT NULL,
  `program_name` text NOT NULL,
  `round` text,
  `repo` text,
  `role` text DEFAULT 'contributor' NOT NULL,
  `status` text NOT NULL,
  `ends_on` text,
  `notes` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `program_participation_user` ON `program_participation` (`user_id`);
