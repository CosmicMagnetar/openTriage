-- Profile settings (public profile link, featured/hidden badges, style)
CREATE TABLE IF NOT EXISTS profile_settings (
    user_id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    settings TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_settings_username ON profile_settings (lower(username));
