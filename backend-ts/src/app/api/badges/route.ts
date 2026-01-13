/**
 * GitHub Badge Redirect API Route
 * 
 * GET /api/badges?type=stars&repo=owner/name
 * Redirects to shields.io SVG badge URLs
 */

import { NextRequest, NextResponse } from "next/server";

type BadgeType = 'stars' | 'forks' | 'license' | 'issues' | 'prs' | 'watchers';

const BADGE_CONFIGS: Record<BadgeType, (owner: string, repo: string) => string> = {
    stars: (owner, repo) =>
        `https://img.shields.io/github/stars/${owner}/${repo}?style=for-the-badge&logo=github&logoColor=white&labelColor=24292e&color=ffc107`,

    forks: (owner, repo) =>
        `https://img.shields.io/github/forks/${owner}/${repo}?style=for-the-badge&logo=github&logoColor=white&labelColor=24292e&color=17a2b8`,

    license: (owner, repo) =>
        `https://img.shields.io/github/license/${owner}/${repo}?style=for-the-badge&logo=github&logoColor=white&labelColor=24292e&color=28a745`,

    issues: (owner, repo) =>
        `https://img.shields.io/github/issues/${owner}/${repo}?style=for-the-badge&logo=github&logoColor=white&labelColor=24292e&color=dc3545`,

    prs: (owner, repo) =>
        `https://img.shields.io/github/issues-pr/${owner}/${repo}?style=for-the-badge&logo=github&logoColor=white&labelColor=24292e&color=6f42c1`,

    watchers: (owner, repo) =>
        `https://img.shields.io/github/watchers/${owner}/${repo}?style=for-the-badge&logo=github&logoColor=white&labelColor=24292e&color=007bff`,
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as BadgeType | null;
    const repo = searchParams.get("repo");

    // Validate params
    if (!type || !repo) {
        return NextResponse.json(
            { error: "Missing required params: type, repo" },
            { status: 400 }
        );
    }

    if (!BADGE_CONFIGS[type]) {
        return NextResponse.json(
            { error: `Invalid badge type. Valid types: ${Object.keys(BADGE_CONFIGS).join(", ")}` },
            { status: 400 }
        );
    }

    // Parse owner/repo
    const parts = repo.split("/");
    if (parts.length !== 2) {
        return NextResponse.json(
            { error: "Invalid repo format. Expected 'owner/repo'" },
            { status: 400 }
        );
    }

    const [owner, repoName] = parts;
    const badgeUrl = BADGE_CONFIGS[type](owner, repoName);

    // Return redirect to shields.io
    return NextResponse.redirect(badgeUrl, { status: 302 });
}
