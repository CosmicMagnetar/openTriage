import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { issues, repositories } from "@/db/schema";
import { eq, and, ne, desc, sql, count, max, inArray } from "drizzle-orm";

// =============================================================================
// GET /api/repositories/contributor - Get repos where user has PRs
// =============================================================================
//
// This is the most complex query in the original Python backend.
// It uses a MongoDB aggregation pipeline to find unique repos where
// the user has contributed PRs but is NOT the owner.
//
// Original Python aggregation pipeline (from routes/repository.py):
// 
//   pipeline = [
//       {"$match": {"authorName": username, "isPR": True}},
//       {"$group": {
//           "_id": {"repoId": "$repoId", "repoName": "$repoName", "owner": "$owner", "repo": "$repo"},
//           "pr_count": {"$sum": 1},
//           "last_pr_at": {"$max": "$createdAt"}
//       }},
//       {"$project": {...}},
//       {"$sort": {"pr_count": -1}}
//   ]
//   contributed_repos = await db.issues.aggregate(pipeline).to_list(1000)
//
// Drizzle SQL equivalent using GROUP BY:
//
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username");
        const userId = searchParams.get("userId");

        if (!username || !userId) {
            return NextResponse.json(
                { error: "username and userId are required" },
                { status: 400 }
            );
        }

        // Step 1: Get user's own repo IDs to exclude
        const ownRepos = await db
            .select({ id: repositories.id })
            .from(repositories)
            .where(eq(repositories.userId, userId));

        const ownRepoIds = ownRepos.map(r => r.id);

        // Step 2: Aggregate PRs by repo - equivalent to MongoDB $group
        // SQL: SELECT repo_id, repo_name, COUNT(*) as pr_count, MAX(created_at) as last_pr_at
        //      FROM issues WHERE author_name = ? AND is_pr = 1 GROUP BY repo_id, repo_name, owner, repo
        const contributedRepos = await db
            .select({
                repoId: issues.repoId,
                repoName: issues.repoName,
                owner: issues.owner,
                repo: issues.repo,
                prCount: count().as("pr_count"),
                lastPrAt: max(issues.createdAt).as("last_pr_at"),
            })
            .from(issues)
            .where(
                and(
                    eq(issues.authorName, username),
                    eq(issues.isPR, true)
                )
            )
            .groupBy(issues.repoId, issues.repoName, issues.owner, issues.repo)
            .orderBy(desc(sql`pr_count`));

        // Step 3: Filter out user's own repos
        const result = contributedRepos
            .filter(repo => !ownRepoIds.includes(repo.repoId))
            .map(repo => ({
                repoId: repo.repoId,
                repoName: repo.repoName,
                owner: repo.owner,
                repo: repo.repo,
                pr_count: repo.prCount,
                last_pr_at: repo.lastPrAt,
                role: "contributor",
                name: repo.repoName || `${repo.owner}/${repo.repo}`,
            }));

        return NextResponse.json(
            { repos: result, count: result.length },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET /api/repositories/contributor error:", error);
        return NextResponse.json(
            { error: "Failed to fetch contributor repositories" },
            { status: 500 }
        );
    }
}
