import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import { eq, asc } from "drizzle-orm";

async function cleanup() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const allIssues = await db.select().from(schema.issues).orderBy(asc(schema.issues.createdAt));
  const kept = new Map<string, string>();
  const toDelete: { id: string; number: number; title: string }[] = [];

  for (const issue of allIssues) {
    const key = `${issue.repoId}:${issue.number}`;
    if (kept.has(key)) {
      toDelete.push({ id: issue.id, number: issue.number, title: issue.title });
    } else {
      kept.set(key, issue.id);
    }
  }

  console.log(`Total rows: ${allIssues.length}, Unique: ${kept.size}, Duplicates: ${toDelete.length}`);
  for (const dup of toDelete) {
    console.log(`  Deleting: #${dup.number} "${dup.title}" (${dup.id})`);
    await db.delete(schema.issues).where(eq(schema.issues.id, dup.id));
  }
  console.log("Cleanup done!");
  process.exit(0);
}

cleanup().catch(e => { console.error(e); process.exit(1); });
