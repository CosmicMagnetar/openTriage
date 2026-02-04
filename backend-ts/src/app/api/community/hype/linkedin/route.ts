/**
 * LinkedIn Hype Generator Route
 * 
 * POST /api/community/hype/linkedin
 * Generates a LinkedIn-style celebratory post for milestones
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

// Default hashtags for LinkedIn
const LINKEDIN_HASHTAGS = ["#OpenSource", "#Developer", "#GitHub", "#Coding", "#TechCommunity"];

// Templates for different milestone types
const TEMPLATES: Record<string, (data: MilestoneRequest) => string> = {
    overall: (data) => `🌟 Celebrating Open Source Impact!

I'm thrilled to share my open source journey. With ${data.value || 0} contributions across various projects, I've been actively participating in the developer community.

${data.description || 'Making an impact one commit at a time!'}

Open source isn't just about code—it's about collaboration, learning, and building together.

What's your open source story?`,

    contributions: (data) => `💪 ${data.value?.toLocaleString() || 0} Contributions Milestone!

Every contribution counts. From small bug fixes to major features, I've been pushing code and making a difference in the open source community.

${data.description || ''}

The best part? Being part of a community that builds amazing things together.

Keep shipping! 🚀`,

    prs: (data) => `🚀 ${data.value || 0} Pull Requests Merged!

Proud to announce I've had ${data.value || 0} pull requests merged across open source projects!

${data.description || ''}

Each PR is a learning opportunity and a chance to give back to the community.

What PRs are you working on?`,

    streak: (data) => `🔥 ${data.value || 0}-Day Contribution Streak!

Consistency is key! I've maintained a ${data.value || 0}-day streak of contributing to open source.

${data.description || ''}

Building good habits, one commit at a time. 

Who else is on a streak? Let's keep the momentum going!`,

    badges: (data) => `🏆 ${data.value || 0} Achievement Badges Earned!

Just unlocked my ${data.value || 0}${data.value === 1 ? 'st' : data.value === 2 ? 'nd' : data.value === 3 ? 'rd' : 'th'} badge on my open source journey!

${data.description || ''}

Gamification makes contributing even more rewarding.

What badges are you chasing?`
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
            platform: "linkedin",
            content,
            hashtags: LINKEDIN_HASHTAGS,
            mentioned_users: [data.username],
            generated_at: new Date().toISOString(),
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("LinkedIn hype generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate LinkedIn post" },
            { status: 500 }
        );
    }
}
