import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import os from "os";

/**
 * Turso Embedded Replicas Setup
 *
 * Architecture:
 * - Local reads: All SELECT queries are served from replica.db (instant, no network latency)
 * - Remote writes: INSERT/UPDATE/DELETE queries go to the remote Turso database
 * - Auto-sync: Replica syncs with remote every N seconds (configurable)
 *
 * Benefits:
 * ✅ Fast reads (local SQLite file)
 * ✅ Automatic background sync
 * ✅ Works offline for READ operations
 * ✅ Zero extra cost (just libsql, not a separate database)
 *
 * Environment Variables:
 * - TURSO_DATABASE_URL: Remote Turso database URL (required)
 * - TURSO_AUTH_TOKEN: Auth token for Turso (required)
 * - REPLICA_DB_PATH: Local path for replica.db (optional, defaults to ./replica.db)
 * - SYNC_INTERVAL: Seconds between syncs (optional, defaults to 60)
 * - REPLICA_ENCRYPTION_KEY: Encryption key for replica (optional)
 */

// Lazy-initialise so the build doesn't crash when env vars are missing
let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
    if (!_client) {
        // Determine replica path (works on Hugging Face Spaces and local)
        const replicaPath = process.env.REPLICA_DB_PATH || path.join(process.cwd(), "replica.db");
        
        console.log(`[DB] Setting up Turso Embedded Replicas:`);
        console.log(`  • Local replica: ${replicaPath}`);
        console.log(`  • Remote sync: ${process.env.TURSO_DATABASE_URL?.slice(0, 30)}...`);
        console.log(`  • Sync interval: ${process.env.SYNC_INTERVAL || "60"}s`);
        
        _client = createClient({
            // Local embedded replica for fast reads
            url: `file:${replicaPath}`,
            // Remote Turso database for syncing
            syncUrl: process.env.TURSO_DATABASE_URL!,
            authToken: process.env.TURSO_AUTH_TOKEN,
            // Sync interval: 60 seconds (adjust as needed)
            syncInterval: parseInt(process.env.SYNC_INTERVAL || "60"),
            // Optional: Encryption key for replica (if you want encrypted local storage)
            encryptionKey: process.env.REPLICA_ENCRYPTION_KEY,
        });
    }
    return _client;
}

/**
 * Manually trigger a sync between local replica and remote Turso database.
 * Useful for ensuring fresh data when needed.
 */
export async function syncReplica(): Promise<void> {
    const client = getClient();
    if ("sync" in client && typeof client.sync === "function") {
        console.log("[DB] Syncing replica with remote Turso database...");
        await (client as any).sync();
        console.log("[DB] ✅ Replica synced successfully");
    }
}

/**
 * Get the status of the embedded replica.
 * Returns info about the local replica file and last sync time.
 */
export async function getReplicaStatus(): Promise<{
    replicaPath: string;
    syncUrl: string;
    syncIntervalSeconds: number;
    replicaInitialized: boolean;
}> {
    const replicaPath = process.env.REPLICA_DB_PATH || path.join(process.cwd(), "replica.db");
    const fs = await import("fs/promises");
    
    let replicaInitialized = false;
    try {
        const stats = await fs.stat(replicaPath);
        replicaInitialized = stats.size > 0;
    } catch {
        // File doesn't exist yet (will be created on first sync)
    }
    
    return {
        replicaPath,
        syncUrl: process.env.TURSO_DATABASE_URL?.slice(0, 50) + "..." || "unknown",
        syncIntervalSeconds: parseInt(process.env.SYNC_INTERVAL || "60"),
        replicaInitialized,
    };
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
    get(_target, prop, receiver) {
        if (!_db) {
            _db = drizzle(getClient(), { schema });
        }
        return Reflect.get(_db, prop, receiver);
    },
});
