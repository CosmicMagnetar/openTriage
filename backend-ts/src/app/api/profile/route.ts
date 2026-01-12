/**
 * Profile Route
 * 
 * Get and update user profiles.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfileByUsername, createOrUpdateProfile } from "@/lib/db/queries/users";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get("username");

        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        const profile = await getProfileByUsername(username);
        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error("Profile fetch error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { bio, location, website, twitter, skills, availableForMentoring, mentoringTopics } = body;

        const profile = await createOrUpdateProfile(user.id, {
            username: user.username,
            avatarUrl: user.avatarUrl,
            bio,
            location,
            website,
            twitter,
            skills,
            availableForMentoring,
            mentoringTopics,
        });

        return NextResponse.json(profile);
    } catch (error) {
        console.error("Profile update error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
