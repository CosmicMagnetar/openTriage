import { NextRequest, NextResponse } from "next/server";
import { getProfileByUsername, createOrUpdateProfile, getUserByUsername } from "@/lib/db/queries/users";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        
        // First, try to get profile from our database
        let profile = await getProfileByUsername(username);
        
        if (profile) {
            return NextResponse.json(profile);
        }
        
        // If no profile in DB, check if user exists in users table
        const user = await getUserByUsername(username);
        if (user) {
            // User exists but has no profile - return basic info
            return NextResponse.json({
                userId: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl,
                bio: null,
                location: null,
                website: null,
                twitter: null,
                skills: [],
                mentoringTopics: [],
                connectedRepos: [],
                availableForMentoring: false,
            });
        }
        
        // If user doesn't exist in our DB, try to fetch from GitHub
        try {
            const octokit = new Octokit({ 
                auth: process.env.GITHUB_TOKEN 
            });
            
            const { data: githubUser } = await octokit.users.getByUsername({ 
                username 
            });
            
            // Return GitHub data as a minimal profile (user not registered with us)
            return NextResponse.json({
                userId: null,
                username: githubUser.login,
                avatarUrl: githubUser.avatar_url,
                bio: githubUser.bio,
                location: githubUser.location,
                website: githubUser.blog,
                twitter: githubUser.twitter_username,
                skills: [],
                mentoringTopics: [],
                connectedRepos: [],
                availableForMentoring: false,
                isExternalUser: true, // Flag to indicate this user hasn't signed up
                github: {
                    name: githubUser.name,
                    company: githubUser.company,
                    followers: githubUser.followers,
                    following: githubUser.following,
                    public_repos: githubUser.public_repos,
                    created_at: githubUser.created_at,
                }
            });
        } catch (githubError: any) {
            // GitHub user doesn't exist either
            if (githubError.status === 404) {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
            throw githubError;
        }
    } catch (error) {
        console.error("GET /api/profile/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { username } = await context.params;

        // Ensure user is updating their own profile
        if (user.username !== username) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        // Support both camelCase and snake_case for compatibility
        const { 
            bio, 
            location, 
            website, 
            twitter, 
            skills, 
            availableForMentoring, 
            available_for_mentoring,
            mentoringTopics 
        } = body;

        const updatedProfile = await createOrUpdateProfile(user.id, {
            username: user.username,
            avatarUrl: user.avatarUrl,
            bio,
            location,
            website,
            twitter,
            availableForMentoring: availableForMentoring ?? available_for_mentoring,
            skills,
            mentoringTopics,
        });

        return NextResponse.json(updatedProfile);
    } catch (error) {
        console.error("PUT /api/profile/:username error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
