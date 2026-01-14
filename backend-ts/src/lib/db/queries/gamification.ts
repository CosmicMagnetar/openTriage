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
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user[0]) return { current_streak: 0, longest_streak: 0, is_active: false, total_contribution_days: 0 };

    // Get all activity dates (from issues created by this user)
    const activity = await db.select({
        createdAt: issues.createdAt
    })
        .from(issues)
        .where(eq(issues.authorName, username))
        .orderBy(desc(issues.createdAt));

    if (activity.length === 0) {
        return { current_streak: 0, longest_streak: 0, is_active: false, total_contribution_days: 0 };
    }

    // Get unique dates (YYYY-MM-DD format)
    const activityDates = [...new Set(
        activity
            .map(a => a.createdAt?.substring(0, 10))
            .filter(Boolean)
    )].sort().reverse(); // Most recent first

    if (activityDates.length === 0) {
        return { current_streak: 0, longest_streak: 0, is_active: false, total_contribution_days: 0 };
    }

    const today = new Date().toISOString().substring(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);

    // Calculate current streak
    let currentStreak = 0;
    let isActive = false;

    // Check if contributed today or yesterday
    if (activityDates[0] === today) {
        isActive = true;
        currentStreak = 1;
    } else if (activityDates[0] === yesterday) {
        isActive = false; // Need to contribute today to keep streak
        currentStreak = 1;
    } else {
        // Streak is broken
        return {
            current_streak: 0,
            longest_streak: calculateLongestStreak(activityDates),
            is_active: false,
            total_contribution_days: activityDates.length
        };
    }

    // Count consecutive days
    for (let i = 1; i < activityDates.length; i++) {
        const current = new Date(activityDates[i - 1]);
        const prev = new Date(activityDates[i]);
        const diffDays = Math.floor((current.getTime() - prev.getTime()) / 86400000);

        if (diffDays === 1) {
            currentStreak++;
        } else {
            break;
        }
    }

    const longestStreak = calculateLongestStreak(activityDates);

    return {
        current_streak: currentStreak,
        longest_streak: Math.max(currentStreak, longestStreak),
        is_active: isActive,
        total_contribution_days: activityDates.length
    };
}

// Helper function to calculate longest streak
function calculateLongestStreak(sortedDates: string[]): number {
    if (sortedDates.length === 0) return 0;

    // Sort dates ascending for this calculation
    const dates = [...sortedDates].sort();

    let longest = 1;
    let current = 1;

    for (let i = 1; i < dates.length; i++) {
        const today = new Date(dates[i]);
        const yesterday = new Date(dates[i - 1]);
        const diffDays = Math.floor((today.getTime() - yesterday.getTime()) / 86400000);

        if (diffDays === 1) {
            current++;
            longest = Math.max(longest, current);
        } else if (diffDays > 1) {
            current = 1;
        }
        // If diffDays === 0, same day, skip
    }

    return longest;
}

// =============================================================================
// Clean Calendar Data
// =============================================================================

export async function getUserCalendar(username: string, days: number = 365) {
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user[0]) return [];

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 86400000);
    const startDateStr = startDate.toISOString().substring(0, 10);

    // Aggregate issues created by day
    const activity = await db.select({
        date: sql<string>`substr(${issues.createdAt}, 1, 10)`,
        contributions: count()
    })
        .from(issues)
        .where(eq(issues.authorName, username))
        .groupBy(sql`substr(${issues.createdAt}, 1, 10)`)
        .orderBy(sql`substr(${issues.createdAt}, 1, 10)`);

    // Convert to heatmap format
    return activity.map(a => ({
        date: a.date,
        contributions: Number(a.contributions)
    }));
}
