/**
 * Contributor Track Repo Route
 * 
 * POST /api/contributor/track-repo
 * Allow contributors to track a repository by URL or name
 * Also immediately fetches their PRs from the repo (no search indexing delay)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addUserRepository, getUserRepositories } from "@/lib/db/queries/users";
import { Octokit } from "@octokit/rest";
import { db } from "@/db";
import { issues, repositories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { AuthorAssociation } from "@/lib/types/github";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        let { repoUrl, repoFullName } = body;

        // Parse repo from URL if provided
        if (repoUrl && !repoFullName) {
            // Handle various GitHub URL formats:
            // - https://github.com/owner/repo
            // - github.com/owner/repo
            // - https://github.com/owner/repo/issues
            // - https://github.com/owner/repo/pull/123
            const urlPatterns = [
                /github\.com\/([^\/]+)\/([^\/]+)/,
            ];

            for (const pattern of urlPatterns) {
                const match = repoUrl.match(pattern);
                if (match) {
                    const owner = match[1];
                    const repo = match[2].replace(/\.git$/, '').split('/')[0].split('?')[0].split('#')[0];
                    repoFullName = `${owner}/${repo}`;
                    break;
                }
            }
        }

        if (!repoFullName || !repoFullName.includes('/')) {
            return NextResponse.json({
                error: "Invalid repository. Please provide a valid GitHub URL or owner/repo format"
            }, { status: 400 });
        }

        // Check if already tracking
        const existingRepos = await getUserRepositories(user.id);
        if (existingRepos.some(r => r.repoFullName === repoFullName)) {
            return NextResponse.json({
                error: "You're already tracking this repository"
            }, { status: 409 });
        }

        // Optionally verify the repo exists on GitHub
        try {
            const response = await fetch(`https://api.github.com/repos/${repoFullName}`, {
                headers: {
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "OpenTriage"
                }
            });

            if (!response.ok) {
                return NextResponse.json({
                    error: "Repository not found on GitHub. Please check the URL."
                }, { status: 404 });
            }
        } catch (err) {
            // Continue even if verification fails
            console.warn("Could not verify repo on GitHub:", err);
        }

        // Add to user's tracked repos
        await addUserRepository(user.id, repoFullName);

        // Immediately fetch user's PRs from this repo (bypasses search indexing delay)
        let prsFound = 0;
        let prsAdded = 0;

        if (user.githubAccessToken) {
            try {
                const [owner, repo] = repoFullName.split('/');
                const octokit = new Octokit({ auth: user.githubAccessToken });

                // Get or create repository entry
                let repoId: string;
                const existingRepoEntry = await db.select({ id: repositories.id })
                    .from(repositories)
                    .where(eq(repositories.name, repoFullName))
                    .limit(1);

                if (existingRepoEntry[0]) {
                    repoId = existingRepoEntry[0].id;
                } else {
                    repoId = uuidv4();
                    await db.insert(repositories).values({
                        id: repoId,
                        githubRepoId: 0,
                        name: repoFullName,
                        owner: owner,
                        userId: user.id,
                        createdAt: new Date().toISOString(),
                    }).onConflictDoNothing();
                }

                // Fetch open PRs from this repo
                const prs = await octokit.pulls.list({
                    owner,
                    repo,
                    state: 'open',
                    per_page: 100,
                });

                // Filter to user's PRs and add them
                const userPRs = prs.data.filter(pr => pr.user?.login === user.username);
                prsFound = userPRs.length;

                for (const pr of userPRs) {
                    const existing = await db.select({ id: issues.id })
                        .from(issues)
                        .where(eq(issues.githubIssueId, pr.id))
                        .limit(1);

                    if (!existing[0]) {
                        const newId = uuidv4();
                        await db.insert(issues).values({
                            id: newId,
                            githubIssueId: pr.id,
                            number: pr.number,
                            title: pr.title,
                            body: pr.body || null,
                            authorName: user.username,
                            repoId: repoId,
                            repoName: repoFullName,
                            owner,
                            repo,
                            htmlUrl: pr.html_url,
                            state: pr.state || 'open',
                            isPR: true,
                            authorAssociation: pr.author_association as AuthorAssociation,
                            createdAt: new Date().toISOString(),
                        }).onConflictDoNothing();
                        prsAdded++;
                    }
                }

                console.log(`[TrackRepo] ${user.username} tracked ${repoFullName}: ${prsFound} PRs found, ${prsAdded} added`);
            } catch (prError) {
                console.error("Error fetching PRs for tracked repo:", prError);
                // Don't fail the request - repo is still tracked
            }
        }

        return NextResponse.json({
            message: prsFound > 0 
                ? `Repository tracked! Found ${prsFound} open PR(s).`
                : "Repository tracked successfully!",
            repoFullName,
            prsFound,
            prsAdded,
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/contributor/track-repo error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET - List tracked repos
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const repos = await getUserRepositories(user.id);
        return NextResponse.json({ repos });
    } catch (error) {
        console.error("GET /api/contributor/track-repo error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
