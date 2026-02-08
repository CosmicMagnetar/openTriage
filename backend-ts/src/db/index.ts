import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Lazy-initialise so the build doesn't crash when env vars are missing
let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
    if (!_client) {
        _client = createClient({
            url: process.env.TURSO_DATABASE_URL!,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
    }
    return _client;
}

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
    get(_target, prop, receiver) {
        if (!_db) {
            _db = drizzle(getClient(), { schema });
        }
        return Reflect.get(_db, prop, receiver);
    },
});
