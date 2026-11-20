-- Signal history (PROPOSAL_v3 C2). Additive: new table only, nothing altered or dropped.
CREATE TABLE IF NOT EXISTS `signal_events` (
  `id` text PRIMARY KEY NOT NULL,
  `repo` text NOT NULL,
  `number` integer NOT NULL,
  `kind` text NOT NULL,
  `signal` text NOT NULL,
  `actor` text,
  `detail` text,
  `source` text NOT NULL,
  `started_at` text NOT NULL,
  `ended_at` text
);
CREATE UNIQUE INDEX IF NOT EXISTS `signal_events_item_signal_start`
  ON `signal_events` (`repo`, `number`, `signal`, `actor`, `started_at`);
