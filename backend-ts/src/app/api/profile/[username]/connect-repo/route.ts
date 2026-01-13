/**
 * Connect Repository Route
 * 
 * POST /api/profile/{userId}/connect-repo
 * Connect a GitHub repo for monitoring and import its issues
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { repositories, issues, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId, now } from "@/lib/utils";
import { createGitHubClient, fetchRepository } from "@/lib/github-client";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { username: userId } = await context.params;

        // Verify user owns this profile
        if (user.id !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { repo_name } = body;

        if (!repo_name) {
            return NextResponse.json({ error: "repo_name is required" }, { status: 400 });
        }

        // Parse owner/repo from full name
        const parts = repo_name.split('/');
        const owner = parts.length > 1 ? parts[0] : user.username;
        const repoName = parts.length > 1 ? parts[1] : parts[0];
        const fullName = `${owner}/${repoName}`;

        // Check if already connected
        const existing = await db.select()
            .from(repositories)
            .where(and(
                eq(repositories.name, fullName),
                eq(repositories.userId, userId)
            ))
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json({
                message: "Repository already connected",
                repository: existing[0]
            });
        }

        // Fetch repo info from GitHub
        let githubRepoId = null;
        if (user.githubAccessToken) {
            try {
                const octokit = createGitHubClient(user.githubAccessToken);
                const repoData = await fetchRepository(octokit, owner, repoName);
                githubRepoId = String(repoData.id);
            } catch (e) {
                console.warn("Could not fetch repo from GitHub:", e);
            }
        }

        // Create repository record
        const newRepo = {
            id: generateId(),
            githubRepoId: githubRepoId ? Number(githubRepoId) : Date.now(),
            name: fullName,
            owner,
            userId,
            createdAt: now(),
        };

        await db.insert(repositories).values(newRepo);

        // Fetch and import issues from the repo
        if (user.githubAccessToken) {
            try {
                const octokit = createGitHubClient(user.githubAccessToken);

                // Fetch open issues
                const { data: ghIssues } = await octokit.issues.listForRepo({
                    owner,
                    repo: repoName,
                    state: 'open',
                    per_page: 50,
                });

                // Import each issue
                for (const ghIssue of ghIssues) {
                    // Skip PRs in issues list
                    if (ghIssue.pull_request) continue;

                    const existingIssue = await db.select()
                        .from(issues)
                        .where(eq(issues.githubIssueId, ghIssue.id))
                        .limit(1);

                    if (existingIssue.length === 0) {
                        await db.insert(issues).values({
                            id: generateId(),
                            githubIssueId: ghIssue.id,
                            number: ghIssue.number,
                            title: ghIssue.title,
                            body: ghIssue.body || '',
                            authorName: ghIssue.user?.login || 'unknown',
                            repoId: newRepo.id,
                            repoName: fullName,
                            owner,
                            repo: repoName,
                            htmlUrl: ghIssue.html_url,
                            state: ghIssue.state,
                            isPR: false,
                            createdAt: now(),
                        });
                    }
                }

                // Fetch open PRs
                const { data: ghPRs } = await octokit.pulls.list({
                    owner,
                    repo: repoName,
                    state: 'open',
                    per_page: 50,
                });

                for (const ghPR of ghPRs) {
                    const existingPR = await db.select()
                        .from(issues)
                        .where(eq(issues.githubIssueId, ghPR.id))
                        .limit(1);

                    if (existingPR.length === 0) {
                        await db.insert(issues).values({
                            id: generateId(),
                            githubIssueId: ghPR.id,
                            number: ghPR.number,
                            title: ghPR.title,
                            body: ghPR.body || '',
                            authorName: ghPR.user?.login || 'unknown',
                            repoId: newRepo.id,
                            repoName: fullName,
                            owner,
                            repo: repoName,
                            htmlUrl: ghPR.html_url,
                            state: ghPR.state,
                            isPR: true,
                            createdAt: now(),
                        });
                    }
                }

                console.log(`Imported issues and PRs from ${fullName}`);
            } catch (e) {
                console.error("Error importing issues:", e);
                // Don't fail the request, repo is still connected
            }
        }

        return NextResponse.json({
            message: "Repository connected successfully",
            repository: newRepo
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/profile/:id/connect-repo error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
