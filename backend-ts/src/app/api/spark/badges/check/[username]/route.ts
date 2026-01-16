import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, issues, trophies } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getUserStreak } from "@/lib/db/queries/gamification";
import { v4 as uuid } from "uuid";

// Badge criteria definitions
const BADGE_CRITERIA = [
    { id: 'first_pr', name: 'First Pull Request', check: (stats: any) => stats.prCount >= 1 },
    { id: 'pr_champion', name: 'PR Champion', check: (stats: any) => stats.prCount >= 10 },
    { id: 'pr_veteran', name: 'PR Veteran', check: (stats: any) => stats.prCount >= 50 },
    { id: 'pr_legend', name: 'PR Legend', check: (stats: any) => stats.prCount >= 100 },
    { id: 'bug_hunter', name: 'Bug Hunter', check: (stats: any) => stats.bugCount >= 1 },
    { id: 'streak_starter', name: 'Streak Starter', check: (stats: any) => stats.longestStreak >= 7 },
    { id: 'streak_warrior', name: 'Streak Warrior', check: (stats: any) => stats.longestStreak >= 30 },
    { id: 'streak_master', name: 'Streak Master', check: (stats: any) => stats.longestStreak >= 100 },
];

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;

        // Get user
        const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!user[0]) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const userId = user[0].id;

        // Get user stats for badge checking
        const prCountResult = await db.select({ count: count() })
            .from(issues)
            .where(and(eq(issues.authorName, username), eq(issues.isPR, true)));

        const bugCountResult = await db.select({ count: count() })
            .from(issues)
            .where(and(eq(issues.authorName, username), eq(issues.isPR, false)));

        const streak = await getUserStreak(username);

        const stats = {
            prCount: prCountResult[0]?.count || 0,
            bugCount: bugCountResult[0]?.count || 0,
            longestStreak: streak.longest_streak || 0,
        };

        // Get existing badges
        const existingBadges = await db.select()
            .from(trophies)
            .where(eq(trophies.userId, userId));

        const existingBadgeIds = new Set(existingBadges.map(b => b.trophyType));

        // Check and award new badges
        const newBadges: string[] = [];
        const now = new Date().toISOString();

        for (const badge of BADGE_CRITERIA) {
            if (!existingBadgeIds.has(badge.id) && badge.check(stats)) {
                // Award the badge
                await db.insert(trophies).values({
                    id: uuid(),
                    userId: userId,
                    username: username,
                    trophyType: badge.id,
                    name: badge.name,
                    description: `Earned: ${badge.name}`,
                    icon: '🏆',
                    color: '#FFD700',
                    rarity: 'common',
                    awardedAt: now,
                });
                newBadges.push(badge.id);
            }
        }

        // Get updated badges
        const currentBadges = await db.select()
            .from(trophies)
            .where(eq(trophies.userId, userId));

        return NextResponse.json({
            message: newBadges.length > 0
                ? `Congrats! You earned ${newBadges.length} new badge(s)!`
                : "Badges checked - no new badges earned",
            newBadges,
            currentBadges,
            stats
        });

    } catch (error) {
        console.error("GET /api/spark/badges/check/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    return GET(request, context);
}

