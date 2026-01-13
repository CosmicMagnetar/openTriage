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

// Badge definitions using images from public/badges folder
const BADGE_DEFINITIONS = [
    { id: 'first_pr', name: 'First Pull Request', description: 'Opened your first pull request', image_url: 'https://img.shields.io/badge/First_PR-Contribution-blue', category: 'contribution', rarity: 'common' },
    { id: 'first_review', name: 'First Review', description: 'Received your first code review', image_url: 'https://img.shields.io/badge/First_Review-Contribution-blue', category: 'contribution', rarity: 'common' },
    { id: 'bug_hunter', name: 'Bug Hunter', description: 'Found and reported a bug', image_url: 'https://img.shields.io/badge/Bug_Hunter-Quality-orange', category: 'contribution', rarity: 'uncommon' },
    { id: 'code_reviewer', name: 'Code Reviewer', description: 'Reviewed pull requests', image_url: 'https://img.shields.io/badge/Code_Reviewer-Quality-orange', category: 'contribution', rarity: 'uncommon' },
    { id: 'helpful_contributor', name: 'Helpful Contributor', description: 'Helped other contributors', image_url: 'https://img.shields.io/badge/Helpful_Contributor-Community-green', category: 'community', rarity: 'uncommon' },
    { id: 'mentor', name: 'Mentor', description: 'Helped another contributor learn', image_url: 'https://img.shields.io/badge/Mentor-Community-purple', category: 'community', rarity: 'rare' },
    { id: 'pr_champion', name: 'PR Champion', description: 'Merged 10 pull requests', image_url: 'https://img.shields.io/badge/PR_Champion-Milestone-yellow', category: 'milestone', rarity: 'uncommon' },
    { id: 'pr_veteran', name: 'PR Veteran', description: 'Merged 50 pull requests', image_url: 'https://img.shields.io/badge/PR_Veteran-Milestone-red', category: 'milestone', rarity: 'rare' },
    { id: 'pr_legend', name: 'PR Legend', description: 'Merged 100 pull requests', image_url: 'https://img.shields.io/badge/PR_Legend-Milestone-gold', category: 'milestone', rarity: 'legendary' },
    { id: 'review_champion', name: 'Review Champion', description: 'Reviewed 25 pull requests', image_url: 'https://img.shields.io/badge/Review_Champion-Contribution-red', category: 'contribution', rarity: 'rare' },
    { id: 'streak_starter', name: 'Streak Starter', description: 'Contributed for 7 days in a row', image_url: 'https://img.shields.io/badge/Streak_Starter-Streak-blue', category: 'streak', rarity: 'common' },
    { id: 'streak_warrior', name: 'Streak Warrior', description: 'Contributed for 30 days in a row', image_url: 'https://img.shields.io/badge/Streak_Warrior-Streak-red', category: 'streak', rarity: 'rare' },
    { id: 'streak_master', name: 'Streak Master', description: 'Contributed for 100 days in a row', image_url: 'https://img.shields.io/badge/Streak_Master-Streak-gold', category: 'streak', rarity: 'legendary' },
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
            return NextResponse.json({
                all_badges: BADGE_DEFINITIONS.map(b => ({ ...b, earned: false })),
                earned_badges: [],
                stats: { total_earned: 0, common: 0, uncommon: 0, rare: 0, legendary: 0 }
            });
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

        // Calculate stats
        const earnedBadges = allBadges.filter(b => b.earned);
        const stats = {
            total_earned: earnedBadges.length,
            common: earnedBadges.filter(b => b.rarity === 'common').length,
            uncommon: earnedBadges.filter(b => b.rarity === 'uncommon').length,
            rare: earnedBadges.filter(b => b.rarity === 'rare').length,
            legendary: earnedBadges.filter(b => b.rarity === 'legendary').length,
        };

        return NextResponse.json({
            all_badges: allBadges,
            earned_badges: earnedBadges,
            stats,
        });
    } catch (error) {
        console.error("GET /api/spark/badges/user/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
