/**
 * Add Repository API Route
 * 
 * POST /api/sync/add-repo - Add a specific repo and fetch user's PRs immediately
 * 
 * Body: { owner: string, repo: string }
 * 
 * This bypasses all search indexing delays by fetching directly from the Pulls API.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";
import { db } from "@/db";
import { issues, repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { AuthorAssociation } from "@/lib/types/github";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json({ error: "GitHub access token not found" }, { status: 400 });
        }

        const body = await request.json();
        const { owner, repo } = body;

        if (!owner || !repo) {
            return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
        }

        const repoName = `${owner}/${repo}`;
        const octokit = new Octokit({ auth: user.githubAccessToken });

        // Check if repo exists and is accessible
        try {
            await octokit.repos.get({ owner, repo });
        } catch (error: any) {
            if (error.status === 404) {
                return NextResponse.json({ error: `Repository ${repoName} not found or not accessible` }, { status: 404 });
            }
            throw error;
        }

        // Get or create repository entry for THIS USER
        // Important: Each user needs their own repository entry to show in their dashboard
        let repoId: string;
        const existingRepo = await db.select({ id: repositories.id })
            .from(repositories)
            .where(and(
                eq(repositories.name, repoName),
                eq(repositories.userId, user.id)
            ))
            .limit(1);

        if (existingRepo[0]) {
            repoId = existingRepo[0].id;
            // Mark as explicitly added by user if not already
            await db.update(repositories)
                .set({ addedByUser: true })
                .where(eq(repositories.id, repoId));
        } else {
            // Create a new repository entry for this user (explicitly added)
            repoId = uuidv4();
            await db.insert(repositories).values({
                id: repoId,
                githubRepoId: 0,
                name: repoName,
                owner: owner,
                userId: user.id,
                addedByUser: true, // Explicitly added by maintainer
                createdAt: new Date().toISOString(),
            }).onConflictDoNothing();
        }

        // Fetch ALL open PRs from this repo
        const prs = await octokit.pulls.list({
            owner,
            repo,
            state: 'open',
            per_page: 100,
        });

        // Filter to user's PRs
        const userPRs = prs.data.filter(pr => pr.user?.login === user.username);

        let added = 0;
        let updated = 0;

        for (const pr of userPRs) {
            // Check if PR already exists by number+repoId (true unique identifier)
            const existing = await db.select({ id: issues.id, state: issues.state, title: issues.title })
                .from(issues)
                .where(and(eq(issues.number, pr.number), eq(issues.repoId, repoId)))
                .limit(1);

            if (existing[0]) {
                // Update if changed
                if (existing[0].state !== pr.state || existing[0].title !== pr.title) {
                    await db.update(issues)
                        .set({ 
                            state: pr.state, 
                            title: pr.title, 
                            body: pr.body || null 
                        })
                        .where(eq(issues.id, existing[0].id));
                    updated++;
                }
            } else {
                // Create new
                const newId = uuidv4();
                await db.insert(issues).values({
                    id: newId,
                    githubIssueId: pr.id,
                    number: pr.number,
                    title: pr.title,
                    body: pr.body || null,
                    authorName: user.username,
                    repoId: repoId,
                    repoName,
                    owner,
                    repo,
                    htmlUrl: pr.html_url,
                    state: pr.state || 'open',
                    isPR: true,
                    authorAssociation: pr.author_association as AuthorAssociation,
                    createdAt: new Date().toISOString(),
                }).onConflictDoNothing();
                added++;
            }
        }

        console.log(`[AddRepo] ${user.username} added ${repoName}: ${added} new PRs, ${updated} updated`);

        return NextResponse.json({
            success: true,
            repo: repoName,
            prsFound: userPRs.length,
            added,
            updated,
            message: userPRs.length > 0 
                ? `Found ${userPRs.length} open PR(s) in ${repoName}` 
                : `No open PRs found for you in ${repoName}`,
        });

    } catch (error) {
        console.error("POST /api/sync/add-repo error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
