/**
 * User Queries - Drizzle ORM
 * 
 * All user-related database operations.
 */

import { db } from "@/db";
import { users, profiles, profileSkills, profileMentoringTopics, profileConnectedRepos, userRepositories, mentors, mentorTechStack } from "@/db/schema";
import { eq, and, like, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// =============================================================================
// User CRUD
// =============================================================================

export async function getUserById(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
}

export async function getUserByGithubId(githubId: number) {
    const result = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
    return result[0] || null;
}

export async function getUserByUsername(username: string) {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] || null;
}

export async function createUser(data: {
    githubId: number;
    username: string;
    avatarUrl: string;
    role?: string;
    githubAccessToken?: string;
}) {
    const now = new Date().toISOString();
    const id = uuidv4();

    await db.insert(users).values({
        id,
        githubId: data.githubId,
        username: data.username,
        avatarUrl: data.avatarUrl,
        role: data.role || null,
        githubAccessToken: data.githubAccessToken || null,
        createdAt: now,
        updatedAt: now,
    });

    return { id, ...data, createdAt: now, updatedAt: now };
}

export async function updateUser(id: string, data: Partial<{
    username: string;
    avatarUrl: string;
    role: string;
    githubAccessToken: string;
}>) {
    await db.update(users)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(users.id, id));
}

export async function updateUserRole(id: string, role: string) {
    await db.update(users)
        .set({ role, updatedAt: new Date().toISOString() })
        .where(eq(users.id, id));
}

// =============================================================================
// Profile Operations
// =============================================================================

export async function getProfile(userId: string) {
    const profile = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (!profile[0]) return null;

    const skills = await db.select().from(profileSkills).where(eq(profileSkills.profileId, userId));
    const topics = await db.select().from(profileMentoringTopics).where(eq(profileMentoringTopics.profileId, userId));
    const repos = await db.select().from(profileConnectedRepos).where(eq(profileConnectedRepos.profileId, userId));

    return {
        ...profile[0],
        skills: skills.map(s => s.skill),
        mentoringTopics: topics.map(t => t.topic),
        connectedRepos: repos.map(r => r.repoName),
    };
}

export async function getProfileByUsername(username: string) {
    const profile = await db.select().from(profiles).where(eq(profiles.username, username)).limit(1);
    if (!profile[0]) return null;

    const userId = profile[0].userId;
    const skills = await db.select().from(profileSkills).where(eq(profileSkills.profileId, userId));
    const topics = await db.select().from(profileMentoringTopics).where(eq(profileMentoringTopics.profileId, userId));

    return {
        ...profile[0],
        skills: skills.map(s => s.skill),
        mentoringTopics: topics.map(t => t.topic),
    };
}

export async function createOrUpdateProfile(userId: string, data: {
    username: string;
    avatarUrl?: string;
    bio?: string;
    location?: string;
    website?: string;
    twitter?: string;
    availableForMentoring?: boolean;
    profileVisibility?: string;
    showEmail?: boolean;
    skills?: string[];
    mentoringTopics?: string[];
}) {
    const now = new Date().toISOString();

    // Upsert profile
    await db.insert(profiles).values({
        userId,
        username: data.username,
        avatarUrl: data.avatarUrl || null,
        bio: data.bio || null,
        location: data.location || null,
        website: data.website || null,
        twitter: data.twitter || null,
        availableForMentoring: data.availableForMentoring || false,
        profileVisibility: data.profileVisibility || "public",
        showEmail: data.showEmail || false,
        createdAt: now,
        updatedAt: now,
    }).onConflictDoUpdate({
        target: profiles.userId,
        set: {
            bio: data.bio,
            location: data.location,
            website: data.website,
            twitter: data.twitter,
            availableForMentoring: data.availableForMentoring,
            profileVisibility: data.profileVisibility,
            showEmail: data.showEmail,
            updatedAt: now,
        }
    });

    // Update skills
    if (data.skills) {
        await db.delete(profileSkills).where(eq(profileSkills.profileId, userId));
        for (const skill of data.skills) {
            await db.insert(profileSkills).values({ profileId: userId, skill });
        }
    }

    // Update topics
    if (data.mentoringTopics) {
        await db.delete(profileMentoringTopics).where(eq(profileMentoringTopics.profileId, userId));
        for (const topic of data.mentoringTopics) {
            await db.insert(profileMentoringTopics).values({ profileId: userId, topic });
        }
    }

    // Sync to mentors table for discoverability
    // When availableForMentoring is true, create/update mentor entry so they appear in searches
    if (data.availableForMentoring !== undefined) {
        const existingMentor = await db.select().from(mentors).where(eq(mentors.userId, userId)).limit(1);

        if (data.availableForMentoring) {
            // User wants to be a mentor - create or update mentor entry
            if (existingMentor[0]) {
                // Update existing mentor entry
                await db.update(mentors)
                    .set({
                        isActive: true,
                        bio: data.bio || null,
                        avatarUrl: data.avatarUrl || null,
                        updatedAt: now,
                    })
                    .where(eq(mentors.userId, userId));
            } else {
                // Create new mentor entry
                const mentorId = uuidv4();
                await db.insert(mentors).values({
                    id: mentorId,
                    userId,
                    username: data.username,
                    bio: data.bio || null,
                    avatarUrl: data.avatarUrl || null,
                    isActive: true,
                    expertiseLevel: "intermediate",
                    maxMentees: 3,
                    createdAt: now,
                    updatedAt: now,
                });

                // Add skills as tech stack for mentor matching
                if (data.skills && data.skills.length > 0) {
                    for (const tech of data.skills) {
                        await db.insert(mentorTechStack).values({ mentorId, tech });
                    }
                }
            }
        } else {
            // User disabled mentoring - set isActive to false
            if (existingMentor[0]) {
                await db.update(mentors)
                    .set({ isActive: false, updatedAt: now })
                    .where(eq(mentors.userId, userId));
            }
        }
    }

    return getProfile(userId);
}

// =============================================================================
// User Stats
// =============================================================================

export async function getUserRepositories(userId: string) {
    return db.select().from(userRepositories).where(eq(userRepositories.userId, userId));
}

export async function addUserRepository(userId: string, repoFullName: string) {
    await db.insert(userRepositories).values({
        id: uuidv4(),
        userId,
        repoFullName,
        addedAt: new Date().toISOString(),
    }).onConflictDoNothing();
}

export async function removeUserRepository(userId: string, repoFullName: string) {
    await db.delete(userRepositories).where(
        and(
            eq(userRepositories.userId, userId),
            eq(userRepositories.repoFullName, repoFullName)
        )
    );
}
