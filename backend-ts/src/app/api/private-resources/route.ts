/**
 * Private Resources API Route
 * 
 * GET /api/private-resources?issueId=xxx - Get private resources for an issue
 * POST /api/private-resources - Create a private resource
 * DELETE /api/private-resources/[id] - Delete a private resource
 * 
 * Access Control:
 * - Only the repo owner (mentor) and PR author (contributor) can see/create resources
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { privateResources, issues } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Check if user has access to the private resources for this issue
async function hasAccess(issueId: string, username: string): Promise<{ allowed: boolean; issue?: any }> {
    const issue = await db.select()
        .from(issues)
        .where(eq(issues.id, issueId))
        .limit(1);
    
    if (!issue[0]) {
        return { allowed: false };
    }
    
    const i = issue[0];
    // User must be either the repo owner OR the PR/issue author
    const isOwner = i.owner?.toLowerCase() === username.toLowerCase();
    const isAuthor = i.authorName?.toLowerCase() === username.toLowerCase();
    
    return { 
        allowed: isOwner || isAuthor,
        issue: i
    };
}

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const issueId = searchParams.get("issueId");

        if (!issueId) {
            return NextResponse.json({ error: "issueId is required" }, { status: 400 });
        }

        // Check access
        const { allowed, issue } = await hasAccess(issueId, user.username);
        if (!allowed) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Get private resources for this issue
        const resources = await db.select()
            .from(privateResources)
            .where(eq(privateResources.issueId, issueId))
            .orderBy(privateResources.createdAt);

        return NextResponse.json({
            resources,
            issue: {
                id: issue.id,
                number: issue.number,
                title: issue.title,
                repoName: issue.repoName,
                owner: issue.owner,
                authorName: issue.authorName,
            }
        });
    } catch (error) {
        console.error("GET /api/private-resources error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { issueId, resourceType, title, content, description, language } = body;

        if (!issueId || !resourceType || !title || !content) {
            return NextResponse.json({ 
                error: "Missing required fields: issueId, resourceType, title, content" 
            }, { status: 400 });
        }

        // Check access
        const { allowed, issue } = await hasAccess(issueId, user.username);
        if (!allowed) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const now = new Date().toISOString();
        const resourceId = uuidv4();

        await db.insert(privateResources).values({
            id: resourceId,
            issueId,
            repoOwner: issue.owner || '',
            prAuthor: issue.authorName || '',
            resourceType,
            title,
            content,
            description: description || null,
            language: language || null,
            sharedBy: user.username,
            sharedById: user.id,
            createdAt: now,
            updatedAt: now,
        });

        const newResource = await db.select()
            .from(privateResources)
            .where(eq(privateResources.id, resourceId))
            .limit(1);

        return NextResponse.json({
            success: true,
            resource: newResource[0]
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/private-resources error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const resourceId = searchParams.get("id");

        if (!resourceId) {
            return NextResponse.json({ error: "Resource ID is required" }, { status: 400 });
        }

        // Get the resource
        const resource = await db.select()
            .from(privateResources)
            .where(eq(privateResources.id, resourceId))
            .limit(1);

        if (!resource[0]) {
            return NextResponse.json({ error: "Resource not found" }, { status: 404 });
        }

        // Only the person who shared it can delete it
        if (resource[0].sharedById !== user.id) {
            return NextResponse.json({ error: "Only the sharer can delete this resource" }, { status: 403 });
        }

        await db.delete(privateResources).where(eq(privateResources.id, resourceId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/private-resources error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
