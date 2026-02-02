/**
 * Mentor Profiles API Route
 * 
 * GET /api/mentor/profiles
 * Lists all available mentors (users who have availableForMentoring=true in their profiles)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { profiles, users, mentors } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get("active_only") !== "false";
        const limit = parseInt(searchParams.get("limit") || "20");

        // Get all profiles that have availableForMentoring = true
        const availableMentors = await db
            .select({
                userId: profiles.userId,
                username: profiles.username,
                avatarUrl: profiles.avatarUrl,
                bio: profiles.bio,
                availableForMentoring: profiles.availableForMentoring,
            })
            .from(profiles)
            .where(eq(profiles.availableForMentoring, true))
            .limit(limit);

        // Also get mentors from the mentors table (legacy support)
        const legacyMentors = await db
            .select({
                id: mentors.id,
                userId: mentors.userId,
                username: mentors.username,
                avatarUrl: mentors.avatarUrl,
                bio: mentors.bio,
                expertiseLevel: mentors.expertiseLevel,
                isActive: mentors.isActive,
            })
            .from(mentors)
            .where(activeOnly ? eq(mentors.isActive, true) : undefined)
            .limit(limit);

        // Combine and deduplicate by username
        const mentorMap = new Map();
        
        // Add profile-based mentors
        for (const m of availableMentors) {
            if (m.username !== user.username) { // Exclude self
                mentorMap.set(m.username, {
                    id: m.userId,
                    user_id: m.userId,
                    username: m.username,
                    avatar_url: m.avatarUrl,
                    bio: m.bio || '',
                    expertise_level: 'intermediate',
                    is_active: true,
                    source: 'profile'
                });
            }
        }
        
        // Add legacy mentors (they take precedence for expertise_level)
        for (const m of legacyMentors) {
            if (m.username !== user.username) { // Exclude self
                const existing = mentorMap.get(m.username);
                mentorMap.set(m.username, {
                    id: m.id,
                    user_id: m.userId,
                    username: m.username,
                    avatar_url: m.avatarUrl || existing?.avatar_url,
                    bio: m.bio || existing?.bio || '',
                    expertise_level: m.expertiseLevel || 'intermediate',
                    is_active: m.isActive,
                    source: 'mentor_table'
                });
            }
        }

        const mentorList = Array.from(mentorMap.values());

        return NextResponse.json({
            mentors: mentorList,
            total: mentorList.length
        });
    } catch (error) {
        console.error("GET /api/mentor/profiles error:", error);
        return NextResponse.json({ 
            error: "Failed to fetch mentors",
            mentors: []
        }, { status: 500 });
    }
}
