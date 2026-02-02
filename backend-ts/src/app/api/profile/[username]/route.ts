import { NextRequest, NextResponse } from "next/server";
import { getProfileByUsername, createOrUpdateProfile } from "@/lib/db/queries/users";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const profile = await getProfileByUsername(username);
        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }
        return NextResponse.json(profile);
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
