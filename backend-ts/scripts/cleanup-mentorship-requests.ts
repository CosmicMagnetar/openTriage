/**
 * Cleanup Script: Remove duplicate mentorship requests
 * Keeps only the latest request per mentor-mentee pair
 * 
 * Run with: npx tsx scripts/cleanup-mentorship-requests.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mentorshipRequests } from "../src/db/schema";
import { sql, desc, eq } from "drizzle-orm";

// Create client with env loaded
const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

async function cleanupMentorshipRequests() {
    console.log("🧹 Cleaning up mentorship requests...\n");

    // Get all mentorship requests
    const allRequests = await db.select()
        .from(mentorshipRequests)
        .orderBy(desc(mentorshipRequests.createdAt));

    console.log(`Found ${allRequests.length} total requests:\n`);

    allRequests.forEach(req => {
        console.log(`  ID: ${req.id}`);
        console.log(`  From: ${req.menteeUsername} -> To: ${req.mentorUsername}`);
        console.log(`  Status: ${req.status}`);
        console.log(`  Created: ${req.createdAt}`);
        console.log(`  Message: ${req.message?.substring(0, 50)}...`);
        console.log("");
    });

    // Group by mentor-mentee pair
    const pairs = new Map<string, typeof allRequests>();

    allRequests.forEach(req => {
        const key = `${req.menteeId}-${req.mentorId}`;
        if (!pairs.has(key)) {
            pairs.set(key, []);
        }
        pairs.get(key)!.push(req);
    });

    console.log(`\nFound ${pairs.size} unique mentor-mentee pairs`);

    // Find duplicates to delete (keep only the most recent)
    const toDelete: string[] = [];

    pairs.forEach((requests, key) => {
        if (requests.length > 1) {
            // Sort by createdAt descending, keep first (most recent)
            const sorted = requests.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            console.log(`\n📋 Pair: ${sorted[0].menteeUsername} -> ${sorted[0].mentorUsername}`);
            console.log(`   Keeping: ${sorted[0].id} (${sorted[0].createdAt})`);

            for (let i = 1; i < sorted.length; i++) {
                console.log(`   Deleting: ${sorted[i].id} (${sorted[i].createdAt})`);
                toDelete.push(sorted[i].id);
            }
        }
    });

    if (toDelete.length === 0) {
        console.log("\n✅ No duplicates found. Nothing to clean up.");
        return;
    }

    console.log(`\n🗑️  Will delete ${toDelete.length} duplicate requests.`);
    console.log("Press Ctrl+C to cancel, or wait 3 seconds to continue...");

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete duplicates
    for (const id of toDelete) {
        await db.delete(mentorshipRequests)
            .where(eq(mentorshipRequests.id, id));
        console.log(`  Deleted: ${id}`);
    }

    console.log(`\n✅ Cleanup complete. Deleted ${toDelete.length} duplicates.`);

    // Show remaining requests
    const remaining = await db.select().from(mentorshipRequests);
    console.log(`\n📊 Remaining requests: ${remaining.length}`);
    remaining.forEach(req => {
        console.log(`  ${req.menteeUsername} -> ${req.mentorUsername} (${req.status})`);
    });
}

cleanupMentorshipRequests()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
