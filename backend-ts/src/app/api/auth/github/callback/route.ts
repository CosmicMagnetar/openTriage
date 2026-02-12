import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createJwtToken } from "@/lib/auth";
import { generateId, now } from "@/lib/utils";
import { eq } from "drizzle-orm";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * GET /api/auth/github/callback
 * Handle GitHub OAuth callback and create user session.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.redirect(`${FRONTEND_URL}/?error=no_code`);
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch(
            "https://github.com/login/oauth/access_token",
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    client_id: GITHUB_CLIENT_ID,
                    client_secret: GITHUB_CLIENT_SECRET,
                    code,
                }),
            }
        );

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            console.error("No access token:", tokenData);
            return NextResponse.redirect(`${FRONTEND_URL}/?error=no_token`);
        }

        // Get user info from GitHub
        const userResponse = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const githubUser = await userResponse.json();

        // Check if user exists
        const existingUsers = await db
            .select({
                id: users.id,
                githubId: users.githubId,
                username: users.username,
                avatarUrl: users.avatarUrl,
                role: users.role,
                githubAccessToken: users.githubAccessToken,
                syncStatus: users.syncStatus,
                lastSyncAt: users.lastSyncAt,
                syncError: users.syncError,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            })
            .from(users)
            .where(eq(users.githubId, githubUser.id))
            .limit(1);

        let userData;

        if (existingUsers.length > 0) {
            // Update existing user with new GitHub token
            await db
                .update(users)
                .set({ githubAccessToken: accessToken, updatedAt: now() })
                .where(eq(users.githubId, githubUser.id));

            userData = { ...existingUsers[0], githubAccessToken: accessToken };
        } else {
            // Create new user
            const newUser = {
                id: generateId(),
                githubId: githubUser.id,
                username: githubUser.login,
                avatarUrl: githubUser.avatar_url,
                role: null,
                githubAccessToken: accessToken,
                createdAt: now(),
                updatedAt: now(),
            };

            await db.insert(users).values(newUser);
            userData = newUser;
        }

        // Create JWT token
        const token = createJwtToken(userData.id, userData.role);

        return NextResponse.redirect(`${FRONTEND_URL}/?token=${token}`);
    } catch (error) {
        console.error("GitHub auth error:", error);
        return NextResponse.redirect(`${FRONTEND_URL}/?error=auth_failed`);
    }
}
