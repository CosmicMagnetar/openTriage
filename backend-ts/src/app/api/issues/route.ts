import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { issues, triageData, repositories } from "@/db/schema";
import { generateId, now } from "@/lib/utils";
import { eq, and, desc } from "drizzle-orm";

// =============================================================================
// GET /api/issues - Get issues for a repository
// =============================================================================
// 
// Python equivalent (from routes/repository.py):
//   repos = await db.issues.find({"repoId": repo_id}, {"_id": 0}).to_list(1000)
//
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const repoId = searchParams.get("repoId");
        const state = searchParams.get("state"); // open, closed, all
        const isPR = searchParams.get("isPR"); // true, false

        // Build query conditions
        const conditions = [];
        if (repoId) {
            conditions.push(eq(issues.repoId, repoId));
        }
        if (state && state !== "all") {
            conditions.push(eq(issues.state, state));
        }
        if (isPR !== null && isPR !== undefined) {
            conditions.push(eq(issues.isPR, isPR === "true"));
        }

        // Execute query with Drizzle
        const result = await db
            .select()
            .from(issues)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(issues.createdAt))
            .limit(100);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("GET /api/issues error:", error);
        return NextResponse.json(
            { error: "Failed to fetch issues" },
            { status: 500 }
        );
    }
}

// =============================================================================
// POST /api/issues - Create a new issue
// =============================================================================
//
// Python equivalent (from routes/repository.py):
//   issue = Issue(
//       githubIssueId=gh_issue['id'],
//       number=gh_issue['number'],
//       title=gh_issue['title'],
//       body=gh_issue.get('body') or '',
//       authorName=gh_issue['user']['login'],
//       repoId=repository.id,
//       repoName=repository.name,
//       ...
//   )
//   issue_dict = issue.model_dump()
//   issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
//   await db.issues.insert_one(issue_dict)
//
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const { githubIssueId, number, title, authorName, repoId, repoName } = body;
        if (!githubIssueId || !number || !title || !authorName || !repoId || !repoName) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Check if repository exists
        const repo = await db
            .select()
            .from(repositories)
            .where(eq(repositories.id, repoId))
            .limit(1);

        if (repo.length === 0) {
            return NextResponse.json(
                { error: "Repository not found" },
                { status: 404 }
            );
        }

        // Check if issue already exists
        const existingIssue = await db
            .select()
            .from(issues)
            .where(eq(issues.githubIssueId, githubIssueId))
            .limit(1);

        if (existingIssue.length > 0) {
            return NextResponse.json(
                { error: "Issue already exists", issue: existingIssue[0] },
                { status: 409 }
            );
        }

        // Create new issue
        const newIssue = {
            id: generateId(),
            githubIssueId,
            number,
            title,
            body: body.body || "",
            authorName,
            repoId,
            repoName,
            owner: body.owner || "",
            repo: body.repo || "",
            htmlUrl: body.htmlUrl || "",
            state: body.state || "open",
            isPR: body.isPR || false,
            createdAt: now(),
        };

        await db.insert(issues).values(newIssue);

        return NextResponse.json(
            { message: "Issue created", issue: newIssue },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/issues error:", error);
        return NextResponse.json(
            { error: "Failed to create issue" },
            { status: 500 }
        );
    }
}
