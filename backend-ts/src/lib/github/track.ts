/**
 * Mark repositories as tracked by a maintainer (the `addedByUser` flag on the
 * user's own `repositories` row). No PR import here; the workspace reads
 * GitHub live, so tracking is instant.
 */
import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { validRepo } from "./route-helpers";

export async function trackRepos(userId: string, fullNames: string[]): Promise<string[]> {
    const wanted = [...new Set(fullNames.map((s) => s.trim()))].filter((s) => {
        const [o, r, extra] = s.split("/");
        return !extra && !!o && !!r && validRepo(o, r);
    });
    if (!wanted.length) return [];
    const existing = await db
        .select({ id: repositories.id, name: repositories.name })
        .from(repositories)
        .where(and(eq(repositories.userId, userId), inArray(repositories.name, wanted)));
    const have = new Map(existing.map((r) => [r.name, r.id]));
    const now = new Date().toISOString();
    for (const full of wanted) {
        const id = have.get(full);
        if (id) {
            await db.update(repositories).set({ addedByUser: true }).where(eq(repositories.id, id));
        } else {
            await db.insert(repositories).values({
                id: uuidv4(), githubRepoId: 0, name: full, owner: full.split("/")[0], userId, addedByUser: true, createdAt: now,
            }).onConflictDoNothing();
        }
    }
    return wanted;
}
