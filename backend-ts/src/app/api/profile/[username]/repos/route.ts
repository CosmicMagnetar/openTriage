/**
 * User Repositories Route
 * 
 * GET /api/profile/{username}/repos
 * Fetch user's GitHub repositories
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createGitHubClient, fetchAllUserRepositories } from "@/lib/github-client";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;

        // Find user to get their GitHub token
        const user = await db.select().from(users).where(eq(users.username, username)).limit(1);

        if (!user[0]) {
            return NextResponse.json({ repos: [] });
        }

        // If user has a GitHub token, fetch their repos from GitHub
        if (user[0].githubAccessToken) {
            try {
                const octokit = createGitHubClient(user[0].githubAccessToken);
                const repos = await fetchAllUserRepositories(octokit, username);

                return NextResponse.json({
                    repos: repos.map(repo => ({
                        name: repo.full_name,
                        description: repo.description,
                        language: repo.language,
                        stars: repo.stargazers_count,
                        forks: repo.forks_count,
                        url: repo.html_url,
                        private: repo.private,
                        updatedAt: repo.updated_at,
                    }))
                });
            } catch (githubError) {
                console.error("GitHub API error:", githubError);
                // Fall through to return empty on error
            }
        }

        return NextResponse.json({ repos: [] });
    } catch (error) {
        console.error("GET /api/profile/:username/repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
