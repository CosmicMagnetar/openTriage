/**
 * Profile settings: what a user shows on their profile and whether the
 * public link is on. Kept apart from schema.ts so it can ship on its own.
 * Migration: src/db/migrations/add_profile_settings.sql (also created on
 * first use with CREATE TABLE IF NOT EXISTS).
 */
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profileSettings = sqliteTable("profile_settings", {
    userId: text("user_id").primaryKey(),
    username: text("username").notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    /** JSON: { hidden, featured, banner, hue, stats, weeklyGoal } */
    settings: text("settings").notNull().default("{}"),
    updatedAt: text("updated_at").notNull(),
});
