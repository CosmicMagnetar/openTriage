/**
 * Twitter Hype Generator Route
 * 
 * POST /api/community/hype/twitter
 * Generates a Twitter/X-style celebratory post for milestones
 */

import { NextRequest, NextResponse } from "next/server";

interface MilestoneRequest {
    milestone_type: string;
    user_id: string;
    username: string;
    value?: number;
    description?: string;
    repo_name?: string;
}

// Default hashtags for Twitter (shorter list due to character limits)
const TWITTER_HASHTAGS = ["#OpenSource", "#100DaysOfCode", "#GitHub", "#DevCommunity"];

// Templates for different milestone types (short for Twitter's 280 char limit)
const TEMPLATES: Record<string, (data: MilestoneRequest) => string> = {
    overall: (data) => `🌟 Making waves in open source!

${data.value || 0} contributions and counting. Every commit matters!

Building in public 🚀`,

    contributions: (data) => `💪 ${data.value?.toLocaleString() || 0} contributions milestone!

Open source isn't just code—it's community. Keep shipping! 🚀`,

    prs: (data) => `🚀 ${data.value || 0} PRs merged!

From small fixes to big features, every contribution counts. What are you building?`,

    streak: (data) => `🔥 ${data.value || 0}-day contribution streak!

Consistency > intensity. One commit at a time.

Who else is on a streak?`,

    badges: (data) => `🏆 Badge unlocked! ${data.value || 1} achievement${data.value !== 1 ? 's' : ''} earned.

Gamifying open source contributions makes it even better!`
};

export async function POST(request: NextRequest) {
    try {
        const data: MilestoneRequest = await request.json();

        if (!data.username) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            );
        }

        // Generate content from template
        const templateFn = TEMPLATES[data.milestone_type] || TEMPLATES.overall;
        const content = templateFn(data);

        const response = {
            platform: "twitter",
            content,
            hashtags: TWITTER_HASHTAGS,
            mentioned_users: [data.username],
            generated_at: new Date().toISOString(),
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Twitter hype generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate Twitter post" },
            { status: 500 }
        );
    }
}
