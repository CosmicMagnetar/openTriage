import { NextRequest, NextResponse } from "next/server";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const API_URL = process.env.API_URL || "http://localhost:3000";

/**
 * GET /api/auth/github
 * Redirect to GitHub OAuth authorization page.
 */
export async function GET(request: NextRequest) {
    const callbackUrl = `${API_URL}/api/auth/github/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${callbackUrl}&scope=user:email,repo`;

    return NextResponse.redirect(githubUrl);
}
