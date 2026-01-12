/**
 * Gamification Queries - Drizzle ORM
 */

import { db } from "@/db";
import { trophies, users, issues } from "@/db/schema";
import { eq, desc, and, count, not, sql } from "drizzle-orm";

// =============================================================================
// Badges / Trophies
// =============================================================================

export async function getUserBadges(username: string) {
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user[0]) return [];

    return db.select()
        .from(trophies)
        .where(eq(trophies.userId, user[0].id))
        .orderBy(desc(trophies.awardedAt));
}

// =============================================================================
// Streak
// =============================================================================

export async function getUserStreak(username: string) {
    // This is a simplified streak calculation based on issue/PR creation dates
    // In a real app, you might want to track daily activity explicitly

    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user[0]) return { currentStreak: 0, longestStreak: 0 };

    const activity = await db.select({
        createdAt: issues.createdAt
    })
        .from(issues)
        .leftJoin(users, eq(issues.authorName, users.username)) // Assuming authorName matches username
        .where(eq(users.username, username))
        .orderBy(desc(issues.createdAt));

    if (activity.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // Calculate streak logic here (simplified for now)
    // For now returning mock data or simple calculation as true streak logic can be complex
    // pending actual "daily activity" table

    return {
        currentStreak: 0,
        longestStreak: 0
    };
}

// =============================================================================
// Clean Calendar Data
// =============================================================================

export async function getUserCalendar(username: string) {
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user[0]) return [];

    // Aggregate issues created by day
    const activity = await db.select({
        day: sql<string>`substr(${issues.createdAt}, 1, 10)`,
        value: count()
    })
        .from(issues)
        .leftJoin(users, eq(issues.authorName, users.username))
        .where(eq(users.username, username))
        .groupBy(sql`substr(${issues.createdAt}, 1, 10)`)
        .orderBy(sql`substr(${issues.createdAt}, 1, 10)`);

    return activity;
}
