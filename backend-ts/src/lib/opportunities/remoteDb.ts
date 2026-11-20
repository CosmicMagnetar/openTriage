/**
 * The daily sync writes directly to the remote Turso database instead of the
 * local embedded replica: the replica's WAL can be locked by its own periodic
 * sync, and a background job doesn't need local-read speed. The replica picks
 * the new rows up on its next sync (SYNC_INTERVAL, default 60s).
 */
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { db as replicaDb } from "@/db";

let remote: LibSQLDatabase<typeof schema> | null = null;

export function syncDb(): LibSQLDatabase<typeof schema> {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url || url.startsWith("file:")) return replicaDb;
    if (!remote) remote = drizzle(createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }), { schema });
    return remote;
}
