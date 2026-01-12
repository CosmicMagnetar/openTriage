/**
 * MongoDB to Turso Data Migration Script
 * 
 * Migrates all data from MongoDB Atlas to Turso (SQLite).
 * MongoDB remains READ-ONLY - no deletions or modifications.
 * 
 * Usage:
 *   npm run migrate:data
 *   npm run migrate:data -- --dry-run
 * 
 * Required env vars:
 *   MONGO_URL, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */

import { MongoClient, ObjectId } from "mongodb";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// =============================================================================
// Types
// =============================================================================

interface MongoUser {
    _id?: ObjectId;
    id?: string;
    githubId: number;
    username: string;
    avatarUrl: string;
    role?: string;
    repositories?: string[];
    githubAccessToken?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

interface MongoRepository {
    _id?: ObjectId;
    id?: string;
    githubRepoId: number;
    name: string;
    owner: string;
    userId: string;
    createdAt?: Date | string;
}

interface MongoIssue {
    _id?: ObjectId;
    id?: string;
    githubIssueId: number;
    number: number;
    title: string;
    body?: string;
    authorName: string;
    repoId: string;
    repoName: string;
    owner?: string;
    repo?: string;
    htmlUrl?: string;
    state?: string;
    isPR?: boolean;
    createdAt?: Date | string;
}

interface MongoMessage {
    _id?: ObjectId;
    id?: string;
    senderId: string;
    receiverId: string;
    content: string;
    read?: boolean;
    timestamp?: Date | string;
}

interface MongoProfile {
    _id?: ObjectId;
    user_id: string;
    username: string;
    avatar_url?: string;
    bio?: string;
    skills?: string[];
    location?: string;
    website?: string;
    twitter?: string;
    available_for_mentoring?: boolean;
    mentoring_topics?: string[];
    connected_repos?: string[];
    profile_visibility?: string;
    show_email?: boolean;
    github_stats?: object;
    stats_updated_at?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

interface MongoTriageData {
    _id?: ObjectId;
    id?: string;
    issueId: string;
    classification: string;
    summary: string;
    suggestedLabel: string;
    sentiment: string;
    analyzedAt?: Date | string;
}

interface MongoTemplate {
    _id?: ObjectId;
    id?: string;
    name: string;
    body: string;
    ownerId: string;
    triggerClassification?: string;
    createdAt?: Date | string;
}

interface MongoChatMessage {
    role: string;
    content: string;
    timestamp?: Date | string;
    githubCommentId?: string;
    githubCommentUrl?: string;
}

interface MongoChatHistory {
    _id?: ObjectId;
    id?: string;
    userId: string;
    sessionId: string;
    messages?: MongoChatMessage[];
    createdAt?: Date | string;
}

// =============================================================================
// Utilities
// =============================================================================

function toIsoString(date: Date | string | undefined): string {
    if (!date) return new Date().toISOString();
    if (typeof date === "string") return date;
    return date.toISOString();
}

function extractId(doc: { _id?: ObjectId; id?: string }): string {
    if (doc.id) return doc.id;
    if (doc._id) return doc._id.toString();
    return uuidv4();
}

function log(message: string, type: "info" | "success" | "error" | "warn" = "info") {
    const icons = { info: "ℹ️", success: "✅", error: "❌", warn: "⚠️" };
    const time = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${time}] ${icons[type]} ${message}`);
}

// =============================================================================
// Migration Functions
// =============================================================================

async function migrateUsers(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    isDryRun: boolean
): Promise<Map<string, string>> {
    log("Migrating Users...");
    const userIdMap = new Map<string, string>();
    const users = await mongoDb.collection<MongoUser>("users").find().toArray();
    log(`Found ${users.length} users`);

    let success = 0, skipped = 0;
    for (const mongoUser of users) {
        const userId = extractId(mongoUser);
        const originalId = mongoUser._id?.toString() || mongoUser.id || "";
        userIdMap.set(originalId, userId);

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.users).values({
                    id: userId,
                    githubId: mongoUser.githubId,
                    username: mongoUser.username,
                    avatarUrl: mongoUser.avatarUrl,
                    role: mongoUser.role || null,
                    githubAccessToken: mongoUser.githubAccessToken || null,
                    createdAt: toIsoString(mongoUser.createdAt),
                    updatedAt: toIsoString(mongoUser.updatedAt),
                }).onConflictDoNothing();

                // Migrate user repositories array
                if (mongoUser.repositories?.length) {
                    for (const repoName of mongoUser.repositories) {
                        await tursoDb.insert(schema.userRepositories).values({
                            id: uuidv4(),
                            userId: userId,
                            repoFullName: repoName,
                            addedAt: toIsoString(mongoUser.createdAt),
                        }).onConflictDoNothing();
                    }
                }
                success++;
            } catch (e) {
                skipped++;
            }
        } else {
            log(`[DRY] User: ${mongoUser.username}`);
            success++;
        }
    }
    log(`Users: ${success} migrated, ${skipped} skipped`, "success");
    return userIdMap;
}

async function migrateRepositories(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    userIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<Map<string, string>> {
    log("Migrating Repositories...");
    const repoIdMap = new Map<string, string>();
    const repos = await mongoDb.collection<MongoRepository>("repositories").find().toArray();
    log(`Found ${repos.length} repositories`);

    let success = 0, skipped = 0;
    for (const repo of repos) {
        const repoId = extractId(repo);
        const originalId = repo._id?.toString() || repo.id || "";
        repoIdMap.set(originalId, repoId);

        const mappedUserId = userIdMap.get(repo.userId) || repo.userId;

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.repositories).values({
                    id: repoId,
                    githubRepoId: repo.githubRepoId,
                    name: repo.name,
                    owner: repo.owner,
                    userId: mappedUserId,
                    createdAt: toIsoString(repo.createdAt),
                }).onConflictDoNothing();
                success++;
            } catch (e) {
                skipped++;
            }
        } else {
            log(`[DRY] Repo: ${repo.owner}/${repo.name}`);
            success++;
        }
    }
    log(`Repositories: ${success} migrated, ${skipped} skipped`, "success");
    return repoIdMap;
}

async function migrateIssues(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    repoIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<Map<string, string>> {
    log("Migrating Issues...");
    const issueIdMap = new Map<string, string>();
    const issues = await mongoDb.collection<MongoIssue>("issues").find().toArray();
    log(`Found ${issues.length} issues`);

    let success = 0, skipped = 0;
    for (const issue of issues) {
        const issueId = extractId(issue);
        const originalId = issue._id?.toString() || issue.id || "";
        issueIdMap.set(originalId, issueId);

        const mappedRepoId = repoIdMap.get(issue.repoId) || issue.repoId;

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.issues).values({
                    id: issueId,
                    githubIssueId: issue.githubIssueId,
                    number: issue.number,
                    title: issue.title,
                    body: issue.body || null,
                    authorName: issue.authorName,
                    repoId: mappedRepoId,
                    repoName: issue.repoName,
                    owner: issue.owner || null,
                    repo: issue.repo || null,
                    htmlUrl: issue.htmlUrl || null,
                    state: issue.state || "open",
                    isPR: issue.isPR || false,
                    createdAt: toIsoString(issue.createdAt),
                }).onConflictDoNothing();
                success++;
            } catch (e) {
                skipped++;
            }
        } else {
            log(`[DRY] Issue: #${issue.number} - ${issue.title.substring(0, 30)}...`);
            success++;
        }
    }
    log(`Issues: ${success} migrated, ${skipped} skipped`, "success");
    return issueIdMap;
}

async function migrateMessages(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    userIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<void> {
    log("Migrating Messages...");
    const messages = await mongoDb.collection<MongoMessage>("messages").find().toArray();
    log(`Found ${messages.length} messages`);

    let success = 0, skipped = 0;
    for (const msg of messages) {
        const msgId = extractId(msg);
        const senderId = userIdMap.get(msg.senderId) || msg.senderId;
        const receiverId = userIdMap.get(msg.receiverId) || msg.receiverId;

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.messages).values({
                    id: msgId,
                    senderId: senderId,
                    receiverId: receiverId,
                    content: msg.content,
                    read: msg.read || false,
                    timestamp: toIsoString(msg.timestamp),
                }).onConflictDoNothing();
                success++;
            } catch (e) {
                skipped++;
            }
        } else {
            success++;
        }
    }
    log(`Messages: ${success} migrated, ${skipped} skipped`, "success");
}

async function migrateProfiles(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    userIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<void> {
    log("Migrating Profiles...");
    const profiles = await mongoDb.collection<MongoProfile>("profiles").find().toArray();
    log(`Found ${profiles.length} profiles`);

    let success = 0, skipped = 0;
    for (const profile of profiles) {
        const userId = userIdMap.get(profile.user_id) || profile.user_id;

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.profiles).values({
                    userId: userId,
                    username: profile.username,
                    avatarUrl: profile.avatar_url || null,
                    bio: profile.bio || null,
                    location: profile.location || null,
                    website: profile.website || null,
                    twitter: profile.twitter || null,
                    availableForMentoring: profile.available_for_mentoring || false,
                    profileVisibility: profile.profile_visibility || "public",
                    showEmail: profile.show_email || false,
                    githubStats: profile.github_stats ? JSON.stringify(profile.github_stats) : null,
                    statsUpdatedAt: profile.stats_updated_at ? toIsoString(profile.stats_updated_at) : null,
                    createdAt: toIsoString(profile.created_at),
                    updatedAt: toIsoString(profile.updated_at),
                }).onConflictDoNothing();

                // Migrate skills
                if (profile.skills?.length) {
                    for (const skill of profile.skills) {
                        await tursoDb.insert(schema.profileSkills).values({
                            profileId: userId,
                            skill: skill,
                        }).onConflictDoNothing();
                    }
                }

                // Migrate mentoring topics
                if (profile.mentoring_topics?.length) {
                    for (const topic of profile.mentoring_topics) {
                        await tursoDb.insert(schema.profileMentoringTopics).values({
                            profileId: userId,
                            topic: topic,
                        }).onConflictDoNothing();
                    }
                }

                // Migrate connected repos
                if (profile.connected_repos?.length) {
                    for (const repo of profile.connected_repos) {
                        await tursoDb.insert(schema.profileConnectedRepos).values({
                            profileId: userId,
                            repoName: repo,
                        }).onConflictDoNothing();
                    }
                }
                success++;
            } catch (e) {
                skipped++;
            }
        } else {
            success++;
        }
    }
    log(`Profiles: ${success} migrated, ${skipped} skipped`, "success");
}

async function migrateTriageData(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    issueIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<void> {
    log("Migrating Triage Data...");
    const triageData = await mongoDb.collection<MongoTriageData>("triageData").find().toArray();
    log(`Found ${triageData.length} triage records`);

    let success = 0, skipped = 0;
    for (const triage of triageData) {
        const triageId = extractId(triage);
        const issueId = issueIdMap.get(triage.issueId) || triage.issueId;

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.triageData).values({
                    id: triageId,
                    issueId: issueId,
                    classification: triage.classification,
                    summary: triage.summary,
                    suggestedLabel: triage.suggestedLabel,
                    sentiment: triage.sentiment,
                    analyzedAt: toIsoString(triage.analyzedAt),
                }).onConflictDoNothing();
                success++;
            } catch (e) {
                skipped++;
            }
        } else {
            success++;
        }
    }
    log(`Triage Data: ${success} migrated, ${skipped} skipped`, "success");
}

async function migrateTemplates(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    userIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<void> {
    log("Migrating Templates...");
    const templates = await mongoDb.collection<MongoTemplate>("templates").find().toArray();
    log(`Found ${templates.length} templates`);

    let success = 0, skipped = 0;
    for (const template of templates) {
        const templateId = extractId(template);
        const ownerId = userIdMap.get(template.ownerId) || template.ownerId;

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.templates).values({
                    id: templateId,
                    name: template.name,
                    body: template.body,
                    ownerId: ownerId,
                    triggerClassification: template.triggerClassification || null,
                    createdAt: toIsoString(template.createdAt),
                }).onConflictDoNothing();
                success++;
            } catch (e) {
                skipped++;
            }
        } else {
            success++;
        }
    }
    log(`Templates: ${success} migrated, ${skipped} skipped`, "success");
}

async function migrateChatHistory(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    userIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<void> {
    log("Migrating Chat History...");
    const chatHistories = await mongoDb.collection<MongoChatHistory>("chat_history").find().toArray();
    log(`Found ${chatHistories.length} chat histories`);

    let historySuccess = 0, historySkipped = 0;
    let messageSuccess = 0, messageSkipped = 0;

    for (const history of chatHistories) {
        const historyId = extractId(history);
        const userId = userIdMap.get(history.userId) || history.userId;

        if (!isDryRun) {
            try {
                // Insert chat history record
                await tursoDb.insert(schema.chatHistory).values({
                    id: historyId,
                    userId: userId,
                    sessionId: history.sessionId,
                    createdAt: toIsoString(history.createdAt),
                }).onConflictDoNothing();
                historySuccess++;

                // Insert related messages
                if (history.messages?.length) {
                    for (const msg of history.messages) {
                        const msgId = uuidv4();
                        try {
                            await tursoDb.insert(schema.chatHistoryMessages).values({
                                id: msgId,
                                chatHistoryId: historyId,
                                role: msg.role,
                                content: msg.content,
                                timestamp: toIsoString(msg.timestamp),
                                githubCommentId: msg.githubCommentId || null,
                                githubCommentUrl: msg.githubCommentUrl || null,
                            }).onConflictDoNothing();
                            messageSuccess++;
                        } catch (e) {
                            messageSkipped++;
                        }
                    }
                }
            } catch (e) {
                historySkipped++;
            }
        } else {
            log(`[DRY] Chat History: ${historyId} with ${history.messages?.length || 0} messages`);
            historySuccess++;
            messageSuccess += history.messages?.length || 0;
        }
    }
    log(`Chat History: ${historySuccess} migrated, ${historySkipped} skipped`, "success");
    log(`Chat Messages: ${messageSuccess} migrated, ${messageSkipped} skipped`, "success");
}

// =============================================================================
// Main
// =============================================================================

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes("--dry-run");

    if (isDryRun) {
        log("=== DRY RUN MODE ===", "warn");
    }

    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!mongoUri) {
        log("Missing MONGO_URL or MONGODB_URI", "error");
        process.exit(1);
    }
    if (!tursoUrl) {
        log("Missing TURSO_DATABASE_URL", "error");
        process.exit(1);
    }

    log("Connecting to MongoDB...");
    const mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const dbName = process.env.DB_NAME || "opentriage_db";
    const mongoDb = mongoClient.db(dbName);
    log(`Connected to MongoDB (${dbName})`, "success");

    log("Connecting to Turso...");
    const tursoClient = createClient({ url: tursoUrl, authToken: tursoToken });
    const tursoDb = drizzle(tursoClient, { schema });
    log("Connected to Turso", "success");

    try {
        // Migrate in order (respecting foreign keys)
        const userIdMap = await migrateUsers(mongoDb, tursoDb, isDryRun);
        const repoIdMap = await migrateRepositories(mongoDb, tursoDb, userIdMap, isDryRun);
        const issueIdMap = await migrateIssues(mongoDb, tursoDb, repoIdMap, isDryRun);
        await migrateMessages(mongoDb, tursoDb, userIdMap, isDryRun);
        await migrateProfiles(mongoDb, tursoDb, userIdMap, isDryRun);
        await migrateTriageData(mongoDb, tursoDb, issueIdMap, isDryRun);
        await migrateTemplates(mongoDb, tursoDb, userIdMap, isDryRun);
        await migrateChatHistory(mongoDb, tursoDb, userIdMap, isDryRun);

        log("=== Migration Complete ===", "success");
        if (isDryRun) {
            log("Run without --dry-run to perform actual migration", "info");
        }
    } finally {
        await mongoClient.close();
    }
}

main().catch(console.error);
