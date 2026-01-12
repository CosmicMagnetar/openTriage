/**
 * MongoDB to Turso Migration Script
 * 
 * One-way data migration from MongoDB Atlas to Turso (SQLite).
 * MongoDB data remains unchanged as a read-only backup.
 * 
 * Usage:
 *   npm run migrate:mongo
 *   npm run migrate:mongo -- --dry-run    (preview only)
 * 
 * Required environment variables:
 *   MONGODB_URI - MongoDB Atlas connection string
 *   TURSO_DATABASE_URL - Turso database URL
 *   TURSO_AUTH_TOKEN - Turso auth token
 */

import { MongoClient } from "mongodb";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// ============================================================================
// Types for MongoDB Documents
// ============================================================================

interface MongoUser {
    _id?: { toString(): string };
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
    _id?: { toString(): string };
    id?: string;
    githubRepoId: number;
    name: string;
    owner: string;
    userId: string;
    createdAt?: Date | string;
}

interface MongoIssue {
    _id?: { toString(): string };
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

// ============================================================================
// Utility Functions
// ============================================================================

function toIsoString(date: Date | string | undefined): string {
    if (!date) return new Date().toISOString();
    if (typeof date === "string") return date;
    return date.toISOString();
}

function extractId(doc: { _id?: { toString(): string }; id?: string }): string {
    // Prefer existing UUID id, otherwise convert ObjectId
    if (doc.id) return doc.id;
    if (doc._id) return doc._id.toString();
    return uuidv4();
}

function log(message: string, type: "info" | "success" | "error" | "warn" = "info") {
    const icons = { info: "ℹ️", success: "✅", error: "❌", warn: "⚠️" };
    console.log(`${icons[type]} ${message}`);
}

// ============================================================================
// Migration Functions
// ============================================================================

async function migrateUsers(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    isDryRun: boolean
): Promise<Map<string, string>> {
    log("Migrating Users...");
    const userIdMap = new Map<string, string>();

    const users = await mongoDb.collection<MongoUser>("users").find().toArray();
    log(`Found ${users.length} users to migrate`);

    for (const mongoUser of users) {
        const userId = extractId(mongoUser);
        userIdMap.set(mongoUser._id?.toString() || mongoUser.id || "", userId);

        const tursoUser = {
            id: userId,
            githubId: mongoUser.githubId,
            username: mongoUser.username,
            avatarUrl: mongoUser.avatarUrl,
            role: mongoUser.role || null,
            githubAccessToken: mongoUser.githubAccessToken || null,
            createdAt: toIsoString(mongoUser.createdAt),
            updatedAt: toIsoString(mongoUser.updatedAt),
        };

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.users).values(tursoUser).onConflictDoNothing();

                // Migrate user repositories array to junction table
                if (mongoUser.repositories && mongoUser.repositories.length > 0) {
                    for (const repoFullName of mongoUser.repositories) {
                        await tursoDb.insert(schema.userRepositories).values({
                            id: uuidv4(),
                            userId: userId,
                            repoFullName: repoFullName,
                            addedAt: toIsoString(mongoUser.createdAt),
                        }).onConflictDoNothing();
                    }
                }
            } catch (error) {
                log(`Failed to insert user ${mongoUser.username}: ${error}`, "error");
            }
        } else {
            log(`[DRY RUN] Would insert user: ${mongoUser.username} (${userId})`);
        }
    }

    log(`Migrated ${users.length} users`, "success");
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
    log(`Found ${repos.length} repositories to migrate`);

    for (const mongoRepo of repos) {
        const repoId = extractId(mongoRepo);
        repoIdMap.set(mongoRepo._id?.toString() || mongoRepo.id || "", repoId);

        // Map old userId to new userId
        const mappedUserId = userIdMap.get(mongoRepo.userId) || mongoRepo.userId;

        const tursoRepo = {
            id: repoId,
            githubRepoId: mongoRepo.githubRepoId,
            name: mongoRepo.name,
            owner: mongoRepo.owner,
            userId: mappedUserId,
            createdAt: toIsoString(mongoRepo.createdAt),
        };

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.repositories).values(tursoRepo).onConflictDoNothing();
            } catch (error) {
                log(`Failed to insert repo ${mongoRepo.owner}/${mongoRepo.name}: ${error}`, "error");
            }
        } else {
            log(`[DRY RUN] Would insert repo: ${mongoRepo.owner}/${mongoRepo.name} (${repoId})`);
        }
    }

    log(`Migrated ${repos.length} repositories`, "success");
    return repoIdMap;
}

async function migrateIssues(
    mongoDb: ReturnType<MongoClient["db"]>,
    tursoDb: ReturnType<typeof drizzle>,
    repoIdMap: Map<string, string>,
    isDryRun: boolean
): Promise<void> {
    log("Migrating Issues...");

    const issues = await mongoDb.collection<MongoIssue>("issues").find().toArray();
    log(`Found ${issues.length} issues to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const mongoIssue of issues) {
        const issueId = extractId(mongoIssue);

        // Map old repoId to new repoId
        const mappedRepoId = repoIdMap.get(mongoIssue.repoId) || mongoIssue.repoId;

        const tursoIssue = {
            id: issueId,
            githubIssueId: mongoIssue.githubIssueId,
            number: mongoIssue.number,
            title: mongoIssue.title,
            body: mongoIssue.body || null,
            authorName: mongoIssue.authorName,
            repoId: mappedRepoId,
            repoName: mongoIssue.repoName,
            owner: mongoIssue.owner || null,
            repo: mongoIssue.repo || null,
            htmlUrl: mongoIssue.htmlUrl || null,
            state: mongoIssue.state || "open",
            isPR: mongoIssue.isPR || false,
            createdAt: toIsoString(mongoIssue.createdAt),
        };

        if (!isDryRun) {
            try {
                await tursoDb.insert(schema.issues).values(tursoIssue).onConflictDoNothing();
                successCount++;
            } catch (error) {
                log(`Failed to insert issue #${mongoIssue.number}: ${error}`, "error");
                errorCount++;
            }
        } else {
            log(`[DRY RUN] Would insert issue: #${mongoIssue.number} - ${mongoIssue.title.substring(0, 40)}...`);
            successCount++;
        }
    }

    log(`Migrated ${successCount} issues (${errorCount} errors)`, successCount > 0 ? "success" : "warn");
}

// ============================================================================
// Main Migration Entry Point
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes("--dry-run");

    if (isDryRun) {
        log("Running in DRY RUN mode - no data will be written", "warn");
    }

    // Validate environment variables
    const mongoUri = process.env.MONGODB_URI;
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (!mongoUri) {
        log("Missing MONGODB_URI environment variable", "error");
        process.exit(1);
    }
    if (!tursoUrl) {
        log("Missing TURSO_DATABASE_URL environment variable", "error");
        process.exit(1);
    }

    log("Starting MongoDB to Turso migration...");
    log(`MongoDB URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
    log(`Turso URL: ${tursoUrl}`);

    // Connect to MongoDB
    log("Connecting to MongoDB Atlas...");
    const mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();
    log("Connected to MongoDB", "success");

    // Connect to Turso
    log("Connecting to Turso...");
    const tursoClient = createClient({
        url: tursoUrl,
        authToken: tursoToken,
    });
    const tursoDb = drizzle(tursoClient, { schema });
    log("Connected to Turso", "success");

    try {
        // Run migrations in order (respecting foreign key relationships)
        const userIdMap = await migrateUsers(mongoDb, tursoDb, isDryRun);
        const repoIdMap = await migrateRepositories(mongoDb, tursoDb, userIdMap, isDryRun);
        await migrateIssues(mongoDb, tursoDb, repoIdMap, isDryRun);

        log("Migration completed successfully!", "success");

        if (isDryRun) {
            log("This was a dry run. Run without --dry-run to perform actual migration.", "info");
        }
    } catch (error) {
        log(`Migration failed: ${error}`, "error");
        process.exit(1);
    } finally {
        await mongoClient.close();
        log("Closed MongoDB connection");
    }
}

main().catch(console.error);
