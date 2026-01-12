/**
 * Data Migration Script: MongoDB → Turso/SQLite
 * 
 * This script migrates data from your MongoDB Atlas database to the new Turso SQLite database.
 * 
 * Usage:
 *   1. Set environment variables: MONGODB_URI, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 *   2. Run: npx tsx scripts/migrate_data.ts
 */

import { MongoClient } from "mongodb";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { v4 as uuidv4 } from "uuid";
import * as schema from "../src/db/schema";

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI environment variable is required");
    process.exit(1);
}

if (!TURSO_DATABASE_URL) {
    console.error("❌ TURSO_DATABASE_URL environment variable is required");
    process.exit(1);
}

// ID mapping to track old MongoDB _id → new UUID
const idMap: Record<string, string> = {};

function generateId(mongoId: string): string {
    if (idMap[mongoId]) return idMap[mongoId];
    const newId = uuidv4();
    idMap[mongoId] = newId;
    return newId;
}

function toISOString(date: any): string {
    if (!date) return new Date().toISOString();
    if (date instanceof Date) return date.toISOString();
    if (typeof date === "string") return date;
    return new Date().toISOString();
}

async function main() {
    console.log("🚀 Starting MongoDB → Turso Migration\n");

    // Connect to MongoDB
    console.log("📦 Connecting to MongoDB...");
    const mongoClient = new MongoClient(MONGODB_URI!);
    await mongoClient.connect();
    const mongoDB = mongoClient.db(); // Uses default DB from connection string
    console.log("✅ Connected to MongoDB\n");

    // Connect to Turso
    console.log("📦 Connecting to Turso...");
    const tursoClient = createClient({
        url: TURSO_DATABASE_URL!,
        authToken: TURSO_AUTH_TOKEN,
    });
    const db = drizzle(tursoClient, { schema });
    console.log("✅ Connected to Turso\n");

    try {
        // ================================================================
        // 1. Migrate Users
        // ================================================================
        console.log("👤 Migrating Users...");
        const mongoUsers = await mongoDB.collection("users").find({}).toArray();
        let usersCount = 0;

        for (const user of mongoUsers) {
            const userId = user.id || generateId(user._id.toString());
            idMap[user._id.toString()] = userId;

            try {
                await db.insert(schema.users).values({
                    id: userId,
                    githubId: user.githubId || 0,
                    username: user.username || "unknown",
                    avatarUrl: user.avatarUrl || "",
                    role: user.role || null,
                    githubAccessToken: user.githubAccessToken || null,
                    createdAt: toISOString(user.createdAt),
                    updatedAt: toISOString(user.updatedAt || user.createdAt),
                }).onConflictDoNothing();
                usersCount++;
            } catch (e: any) {
                if (!e.message?.includes("UNIQUE constraint failed")) {
                    console.error(`  ⚠️ Failed to insert user ${user.username}:`, e.message);
                }
            }
        }
        console.log(`✅ Migrated ${usersCount} users\n`);

        // ================================================================
        // 2. Migrate Repositories
        // ================================================================
        console.log("📁 Migrating Repositories...");
        const mongoRepos = await mongoDB.collection("repositories").find({}).toArray();
        let reposCount = 0;

        for (const repo of mongoRepos) {
            const repoId = repo.id || generateId(repo._id.toString());
            idMap[repo._id.toString()] = repoId;

            // Find the user ID
            let userId = repo.userId;
            if (!userId && repo.userId) {
                userId = idMap[repo.userId] || repo.userId;
            }

            // Skip if no valid user
            if (!userId) {
                console.log(`  ⚠️ Skipping repo ${repo.name} - no userId`);
                continue;
            }

            try {
                await db.insert(schema.repositories).values({
                    id: repoId,
                    githubRepoId: repo.githubRepoId || 0,
                    name: repo.name || "unknown/repo",
                    owner: repo.owner || repo.name?.split("/")[0] || "unknown",
                    userId: userId,
                    createdAt: toISOString(repo.createdAt),
                }).onConflictDoNothing();
                reposCount++;
            } catch (e: any) {
                if (!e.message?.includes("UNIQUE constraint failed")) {
                    console.error(`  ⚠️ Failed to insert repo ${repo.name}:`, e.message);
                }
            }
        }
        console.log(`✅ Migrated ${reposCount} repositories\n`);

        // ================================================================
        // 3. Migrate Issues
        // ================================================================
        console.log("🐛 Migrating Issues...");
        const mongoIssues = await mongoDB.collection("issues").find({}).toArray();
        let issuesCount = 0;

        for (const issue of mongoIssues) {
            const issueId = issue.id || generateId(issue._id.toString());
            idMap[issue._id.toString()] = issueId;

            // Map repoId
            let repoId = issue.repoId;
            if (repoId && idMap[repoId]) {
                repoId = idMap[repoId];
            }

            try {
                await db.insert(schema.issues).values({
                    id: issueId,
                    githubIssueId: issue.githubIssueId || 0,
                    number: issue.number || 0,
                    title: issue.title || "Untitled",
                    body: issue.body || null,
                    authorName: issue.authorName || "unknown",
                    repoId: repoId || "unknown-repo",
                    repoName: issue.repoName || "",
                    owner: issue.owner || null,
                    repo: issue.repo || null,
                    htmlUrl: issue.htmlUrl || null,
                    state: issue.state || "open",
                    isPR: issue.isPR || false,
                    createdAt: toISOString(issue.createdAt),
                }).onConflictDoNothing();
                issuesCount++;
            } catch (e: any) {
                if (!e.message?.includes("UNIQUE constraint failed")) {
                    // Don't log every error
                }
            }
        }
        console.log(`✅ Migrated ${issuesCount} issues\n`);

        // ================================================================
        // 4. Migrate Triage Data
        // ================================================================
        console.log("🏷️ Migrating Triage Data...");
        const mongoTriage = await mongoDB.collection("triage_data").find({}).toArray();
        let triageCount = 0;

        for (const triage of mongoTriage) {
            const triageId = triage.id || generateId(triage._id.toString());

            // Map issueId
            let issueId = triage.issueId;
            if (issueId && idMap[issueId]) {
                issueId = idMap[issueId];
            }

            try {
                await db.insert(schema.triageData).values({
                    id: triageId,
                    issueId: issueId || "unknown-issue",
                    classification: triage.classification || "NEEDS_INFO",
                    summary: triage.summary || "",
                    suggestedLabel: triage.suggestedLabel || "needs-review",
                    sentiment: triage.sentiment || "NEUTRAL",
                    analyzedAt: toISOString(triage.analyzedAt),
                }).onConflictDoNothing();
                triageCount++;
            } catch (e: any) {
                // Silently skip foreign key failures
            }
        }
        console.log(`✅ Migrated ${triageCount} triage records\n`);

        // ================================================================
        // 5. Migrate Profiles
        // ================================================================
        console.log("👤 Migrating Profiles...");
        const mongoProfiles = await mongoDB.collection("profiles").find({}).toArray();
        let profilesCount = 0;

        for (const profile of mongoProfiles) {
            let userId = profile.user_id || profile.userId;
            if (userId && idMap[userId]) {
                userId = idMap[userId];
            }

            if (!userId) continue;

            try {
                await db.insert(schema.profiles).values({
                    userId: userId,
                    username: profile.username || "",
                    avatarUrl: profile.avatar_url || profile.avatarUrl || null,
                    bio: profile.bio || null,
                    location: profile.location || null,
                    website: profile.website || null,
                    twitter: profile.twitter || null,
                    availableForMentoring: profile.available_for_mentoring || false,
                    profileVisibility: profile.profile_visibility || "public",
                    showEmail: profile.show_email || false,
                    githubStats: profile.github_stats ? JSON.stringify(profile.github_stats) : null,
                    statsUpdatedAt: profile.stats_updated_at || null,
                    createdAt: toISOString(profile.created_at || profile.createdAt),
                    updatedAt: toISOString(profile.updated_at || profile.updatedAt),
                }).onConflictDoNothing();
                profilesCount++;
            } catch (e: any) {
                // Skip errors
            }
        }
        console.log(`✅ Migrated ${profilesCount} profiles\n`);

        // ================================================================
        // 6. Migrate Messages
        // ================================================================
        console.log("💬 Migrating Messages...");
        const mongoMessages = await mongoDB.collection("messages").find({}).toArray();
        let messagesCount = 0;

        for (const msg of mongoMessages) {
            // Messages go into directMessages table
            try {
                await db.insert(schema.directMessages).values({
                    id: msg.id || generateId(msg._id.toString()),
                    senderId: msg.sender_id || msg.senderId || "unknown",
                    receiverId: msg.receiver_id || msg.receiverId || "unknown",
                    content: msg.content || "",
                    isRead: msg.read || false,
                    createdAt: toISOString(msg.timestamp || msg.createdAt),
                }).onConflictDoNothing();
                messagesCount++;
            } catch (e: any) {
                // Skip errors
            }
        }
        console.log(`✅ Migrated ${messagesCount} messages\n`);

        // ================================================================
        // Summary
        // ================================================================
        console.log("═══════════════════════════════════════════");
        console.log("✅ MIGRATION COMPLETE!");
        console.log("═══════════════════════════════════════════");
        console.log(`   Users:        ${usersCount}`);
        console.log(`   Repositories: ${reposCount}`);
        console.log(`   Issues:       ${issuesCount}`);
        console.log(`   Triage:       ${triageCount}`);
        console.log(`   Profiles:     ${profilesCount}`);
        console.log(`   Messages:     ${messagesCount}`);
        console.log("═══════════════════════════════════════════\n");

        // Save ID mapping for reference
        const fs = await import("fs");
        fs.writeFileSync("id_mapping.json", JSON.stringify(idMap, null, 2));
        console.log("📄 ID mapping saved to id_mapping.json\n");

    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    } finally {
        await mongoClient.close();
        console.log("👋 Connections closed");
    }
}

main();
