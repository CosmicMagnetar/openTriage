/**
 * Quick cleanup: Delete requests with null usernames (test data)
 * 
 * Run with: npx tsx scripts/delete-null-requests.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mentorshipRequests } from "../src/db/schema";
import { isNull, or } from "drizzle-orm";

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

async function deleteNullRequests() {
    console.log("🧹 Deleting requests with null usernames...\n");

    // Delete requests where menteeUsername or mentorUsername is null
    const result = await db.delete(mentorshipRequests)
        .where(or(
            isNull(mentorshipRequests.menteeUsername),
            isNull(mentorshipRequests.mentorUsername)
        ));

    console.log("✅ Deleted requests with null usernames");

    // Show remaining
    const remaining = await db.select().from(mentorshipRequests);
    console.log(`\n📊 Remaining requests: ${remaining.length}`);
    remaining.forEach(req => {
        console.log(`  ${req.menteeUsername} -> ${req.mentorUsername} (${req.status}) - ID: ${req.id}`);
    });
}

deleteNullRequests()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
