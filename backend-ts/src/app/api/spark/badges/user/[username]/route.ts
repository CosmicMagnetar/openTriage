/**
 * User Badges Route
 * 
 * GET /api/spark/badges/user/{username}
 * Fetch user's badges/achievements
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { trophies, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Badge definitions - these are the possible badges a user can earn
const BADGE_DEFINITIONS = [
    { id: 'first_pr', name: 'First Pull Request', description: 'Opened your first pull request', icon: '🎯', category: 'contribution' },
    { id: 'first_issue', name: 'First Issue', description: 'Created your first issue', icon: '📝', category: 'contribution' },
    { id: 'merged_pr', name: 'PR Merged', description: 'Had a pull request merged', icon: '🎉', category: 'contribution' },
    { id: 'streak_7', name: '7 Day Streak', description: 'Contributed for 7 days in a row', icon: '🔥', category: 'streak' },
    { id: 'streak_30', name: '30 Day Streak', description: 'Contributed for 30 days in a row', icon: '💪', category: 'streak' },
    { id: 'contributor_10', name: '10 Contributions', description: 'Made 10 contributions', icon: '⭐', category: 'milestone' },
    { id: 'contributor_50', name: '50 Contributions', description: 'Made 50 contributions', icon: '🌟', category: 'milestone' },
    { id: 'contributor_100', name: '100 Contributions', description: 'Made 100 contributions', icon: '💯', category: 'milestone' },
    { id: 'mentor', name: 'Mentor', description: 'Helped another contributor', icon: '🧑‍🏫', category: 'community' },
    { id: 'reviewer', name: 'Code Reviewer', description: 'Reviewed pull requests', icon: '👀', category: 'contribution' },
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
            return NextResponse.json({ all_badges: BADGE_DEFINITIONS, earned_badges: [] });
        }

        // Get earned trophies/badges from database
        const earnedTrophies = await db.select()
            .from(trophies)
            .where(eq(trophies.userId, user[0].id))
            .orderBy(desc(trophies.awardedAt));

        // Map earned trophies to badge IDs
        const earnedBadgeIds = new Set(earnedTrophies.map(t => t.trophyType));

        // Mark badges as earned/not earned
        const allBadges = BADGE_DEFINITIONS.map(badge => ({
            ...badge,
            earned: earnedBadgeIds.has(badge.id),
            awardedAt: earnedTrophies.find(t => t.trophyType === badge.id)?.awardedAt || null,
        }));

        return NextResponse.json({
            all_badges: allBadges,
            earned_badges: allBadges.filter(b => b.earned),
            total_earned: earnedTrophies.length,
            total_possible: BADGE_DEFINITIONS.length,
        });
    } catch (error) {
        console.error("GET /api/spark/badges/user/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
