/**
 * Contributor Track Repo Route
 * 
 * POST /api/contributor/track-repo
 * Allow contributors to track a repository by URL or name
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addUserRepository, getUserRepositories } from "@/lib/db/queries/users";

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

        return NextResponse.json({
            message: "Repository tracked successfully!",
            repoFullName,
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
