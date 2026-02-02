/**
 * GitHub User Lookup API Route
 * 
 * GET /api/user/github/[username]
 * Fetches GitHub user profile data using server-side token to avoid client rate limits
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { username } = await context.params;

        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        // Use the authenticated user's GitHub token to fetch the profile
        // This avoids rate limits that affect unauthenticated requests
        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub token not available" }, { status: 400 });
        }

        const octokit = new Octokit({ auth: user.githubAccessToken });

        try {
            const { data: githubUser } = await octokit.users.getByUsername({
                username: username,
            });

            return NextResponse.json({
                login: githubUser.login,
                username: githubUser.login,
                name: githubUser.name,
                avatar_url: githubUser.avatar_url,
                avatarUrl: githubUser.avatar_url,
                bio: githubUser.bio,
                location: githubUser.location,
                company: githubUser.company,
                blog: githubUser.blog,
                twitter_username: githubUser.twitter_username,
                public_repos: githubUser.public_repos,
                public_gists: githubUser.public_gists,
                followers: githubUser.followers,
                following: githubUser.following,
                created_at: githubUser.created_at,
                html_url: githubUser.html_url,
            });
        } catch (githubError: any) {
            if (githubError.status === 404) {
                return NextResponse.json({ error: "GitHub user not found" }, { status: 404 });
            }
            throw githubError;
        }
    } catch (error) {
        console.error("GET /api/user/github/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
