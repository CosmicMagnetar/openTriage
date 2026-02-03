/**
 * Maintainer GitHub Repos Route
 * 
 * GET /api/maintainer/github/repos
 * Fetch user's owned GitHub repositories for Add Repo dropdown
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub token not available" }, { status: 400 });
        }

        // Fetch user's repos from GitHub (owned and where they have push/admin access)
        const response = await fetch("https://api.github.com/user/repos?affiliation=owner,collaborator&per_page=100&sort=updated", {
            headers: {
                "Authorization": `Bearer ${user.githubAccessToken}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "OpenTriage"
            }
        });

        if (!response.ok) {
            console.error("GitHub API error:", response.status, await response.text());
            return NextResponse.json({ error: "Failed to fetch repos from GitHub" }, { status: 502 });
        }

        const githubRepos = await response.json();

        // Get already-added repos to filter them out (by name since githubRepoId might be 0)
        const existingRepos = await db.select({ name: repositories.name })
            .from(repositories)
            .where(eq(repositories.userId, user.id));

        const existingNames = new Set(existingRepos.map(r => r.name));

        // Filter and format repos - filter by fullName
        const availableRepos = githubRepos
            .filter((repo: any) => !existingNames.has(repo.full_name))
            // Only include repos where user has admin or push permissions
            .filter((repo: any) => repo.permissions?.admin || repo.permissions?.push || repo.permissions?.maintain)
            .map((repo: any) => ({
                id: repo.id,
                name: repo.name,
                fullName: repo.full_name,
                owner: repo.owner.login,
                description: repo.description,
                language: repo.language,
                stars: repo.stargazers_count,
                updatedAt: repo.updated_at,
                isPrivate: repo.private,
            }));

        return NextResponse.json({
            repos: availableRepos,
            total: availableRepos.length,
        });
    } catch (error) {
        console.error("GET /api/maintainer/github/repos error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
