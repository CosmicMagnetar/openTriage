import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { repositories, issues, triageData } from "@/db/schema";
import { generateId, now } from "@/lib/utils";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { Octokit } from "@octokit/rest";
import { v4 as uuidv4 } from "uuid";

// =============================================================================
// GET /api/repositories - Get user's repositories
// =============================================================================
//
// Python equivalent (from routes/repository.py):
//   repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
//
import { getCurrentUser } from "@/lib/auth";

// ...

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        let userId = searchParams.get("userId");

        // If no userId provided, try to get the current authenticated user
        if (!userId) {
            const currentUser = await getCurrentUser(request);
            if (currentUser) {
                userId = currentUser.id;
            } else {
                return NextResponse.json(
                    { error: "userId is required or you must be logged in" },
                    { status: 401 }
                );
            }
        }

        const repos = await db
            .select()
            .from(repositories)
            .where(eq(repositories.userId, userId))
            .orderBy(desc(repositories.createdAt));

        // Add fullName for consistency with other endpoints
        const reposWithFullName = repos.map(repo => ({
            ...repo,
            fullName: `${repo.owner}/${repo.name}`
        }));

        return NextResponse.json(reposWithFullName, { status: 200 });
    } catch (error) {
        console.error("GET /api/repositories error:", error);
        return NextResponse.json(
            { error: "Failed to fetch repositories" },
            { status: 500 }
        );
    }
}

// =============================================================================
// POST /api/repositories - Add a new repository (Maintainer flow)
// =============================================================================
//
// Accepts either:
//   { repoFullName: "owner/repo" } - Frontend format for maintainers
//   { githubRepoId, name, owner, userId } - Legacy format
//
// For maintainers: Fetches ALL open PRs from the repo (not just the user's own)
//
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        
        // Support both formats: { repoFullName } or { githubRepoId, name, owner, userId }
        let owner: string;
        let repoName: string;
        let fullName: string;
        let githubRepoId: number = 0;

        if (body.repoFullName) {
            // Frontend format: "owner/repo"
            const parts = body.repoFullName.split('/');
            if (parts.length !== 2) {
                return NextResponse.json(
                    { error: "Invalid repository format. Use owner/repo" },
                    { status: 400 }
                );
            }
            owner = parts[0];
            repoName = parts[1];
            fullName = body.repoFullName;
        } else if (body.githubRepoId && body.name && body.owner) {
            // Legacy format
            githubRepoId = body.githubRepoId;
            owner = body.owner;
            repoName = body.name.includes('/') ? body.name.split('/')[1] : body.name;
            fullName = body.name.includes('/') ? body.name : `${owner}/${body.name}`;
        } else {
            return NextResponse.json(
                { error: "Missing required fields: repoFullName or (githubRepoId, name, owner)" },
                { status: 400 }
            );
        }

        // Check if this user already has this repository
        const existing = await db
            .select()
            .from(repositories)
            .where(
                and(
                    eq(repositories.name, fullName),
                    eq(repositories.userId, user.id)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "Repository already added", repository: existing[0] },
                { status: 409 }
            );
        }

        // If user has GitHub token, verify repo exists and fetch PRs
        let prsAdded = 0;
        let repoId = generateId();

        if (user.githubAccessToken) {
            const octokit = new Octokit({ auth: user.githubAccessToken });
            
            try {
                // Verify repo exists
                const repoData = await octokit.repos.get({ owner, repo: repoName });
                githubRepoId = repoData.data.id;
            } catch (error: any) {
                if (error.status === 404) {
                    return NextResponse.json(
                        { error: `Repository ${fullName} not found or not accessible` },
                        { status: 404 }
                    );
                }
                console.error("GitHub API error:", error);
            }

            // Create repository entry first
            await db.insert(repositories).values({
                id: repoId,
                githubRepoId,
                name: fullName,
                owner,
                userId: user.id,
                createdAt: now(),
            });

            // For maintainers, fetch ALL open PRs (not just their own)
            try {
                const prs = await octokit.pulls.list({
                    owner,
                    repo: repoName,
                    state: 'open',
                    per_page: 100,
                });

                for (const pr of prs.data) {
                    // Check if PR already exists
                    const existingPR = await db.select({ id: issues.id })
                        .from(issues)
                        .where(eq(issues.githubIssueId, pr.id))
                        .limit(1);

                    if (!existingPR[0]) {
                        // Create new PR entry
                        await db.insert(issues).values({
                            id: uuidv4(),
                            githubIssueId: pr.id,
                            number: pr.number,
                            title: pr.title,
                            body: pr.body || null,
                            authorName: pr.user?.login || 'unknown',
                            repoId: repoId,
                            repoName: fullName,
                            owner,
                            repo: repoName,
                            htmlUrl: pr.html_url,
                            state: pr.state || 'open',
                            isPR: true,
                            authorAssociation: pr.author_association,
                            createdAt: new Date().toISOString(),
                        }).onConflictDoNothing();
                        prsAdded++;
                    }
                }

                // Also fetch open issues
                const issuesRes = await octokit.issues.listForRepo({
                    owner,
                    repo: repoName,
                    state: 'open',
                    per_page: 100,
                });

                for (const issue of issuesRes.data) {
                    // Skip PRs (they come through issues API too)
                    if (issue.pull_request) continue;

                    const existingIssue = await db.select({ id: issues.id })
                        .from(issues)
                        .where(eq(issues.githubIssueId, issue.id))
                        .limit(1);

                    if (!existingIssue[0]) {
                        await db.insert(issues).values({
                            id: uuidv4(),
                            githubIssueId: issue.id,
                            number: issue.number,
                            title: issue.title,
                            body: issue.body || null,
                            authorName: issue.user?.login || 'unknown',
                            repoId: repoId,
                            repoName: fullName,
                            owner,
                            repo: repoName,
                            htmlUrl: issue.html_url,
                            state: issue.state || 'open',
                            isPR: false,
                            authorAssociation: issue.author_association,
                            createdAt: new Date().toISOString(),
                        }).onConflictDoNothing();
                    }
                }

                console.log(`[AddRepo] ${user.username} added ${fullName}: ${prsAdded} PRs imported`);
            } catch (error) {
                console.error("Error fetching PRs:", error);
                // Continue even if PR fetch fails - repo is still added
            }
        } else {
            // No GitHub token, just add the repository entry
            await db.insert(repositories).values({
                id: repoId,
                githubRepoId,
                name: fullName,
                owner,
                userId: user.id,
                createdAt: now(),
            });
        }

        const newRepo = await db.select()
            .from(repositories)
            .where(eq(repositories.id, repoId))
            .limit(1);

        return NextResponse.json(
            { 
                message: "Repository added!", 
                repository: newRepo[0],
                prsImported: prsAdded
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/repositories error:", error);
        return NextResponse.json(
            { error: "Failed to add repository" },
            { status: 500 }
        );
    }
}
