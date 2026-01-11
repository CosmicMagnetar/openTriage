import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { repositories, issues, triageData } from "@/db/schema";
import { generateId, now } from "@/lib/utils";
import { eq, and, desc, count, sql } from "drizzle-orm";

// =============================================================================
// GET /api/repositories - Get user's repositories
// =============================================================================
//
// Python equivalent (from routes/repository.py):
//   repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
//
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 }
            );
        }

        const repos = await db
            .select()
            .from(repositories)
            .where(eq(repositories.userId, userId))
            .orderBy(desc(repositories.createdAt));

        return NextResponse.json(repos, { status: 200 });
    } catch (error) {
        console.error("GET /api/repositories error:", error);
        return NextResponse.json(
            { error: "Failed to fetch repositories" },
            { status: 500 }
        );
    }
}

// =============================================================================
// POST /api/repositories - Add a new repository
// =============================================================================
//
// Python equivalent (from routes/repository.py):
//   repository = Repository(
//       githubRepoId=repo_data['id'],
//       name=request.repoFullName,
//       owner=owner,
//       userId=user['id']
//   )
//   repo_dict = repository.model_dump()
//   repo_dict['createdAt'] = repo_dict['createdAt'].isoformat()
//   await db.repositories.insert_one(repo_dict)
//
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { githubRepoId, name, owner, userId } = body;

        // Validate required fields
        if (!githubRepoId || !name || !owner || !userId) {
            return NextResponse.json(
                { error: "Missing required fields: githubRepoId, name, owner, userId" },
                { status: 400 }
            );
        }

        // Check if repository already exists for this user
        const existing = await db
            .select()
            .from(repositories)
            .where(
                and(
                    eq(repositories.githubRepoId, githubRepoId),
                    eq(repositories.userId, userId)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "Repository already added", repository: existing[0] },
                { status: 409 }
            );
        }

        // Create new repository
        const newRepo = {
            id: generateId(),
            githubRepoId,
            name,
            owner,
            userId,
            createdAt: now(),
        };

        await db.insert(repositories).values(newRepo);

        return NextResponse.json(
            { message: "Repository added!", repository: newRepo },
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
