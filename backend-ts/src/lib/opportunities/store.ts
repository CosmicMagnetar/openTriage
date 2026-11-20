/** Read path: stored opportunities, falling back to the seed if the table is empty or unreachable. */
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { programs as seed, type Program } from "@/lib/programs";
import { isoDay } from "./dates";
import { isExpired, kindOf, rollForward } from "./normalize";

let memo: { at: number; list: Program[] } | null = null;

export async function loadOpportunities(now = new Date()): Promise<{ list: Program[]; fromSeed: boolean }> {
    const today = isoDay(now);
    if (memo && Date.now() - memo.at < 60_000) return { list: memo.list, fromSeed: false };
    try {
        const rows = await db.select().from(opportunities);
        if (rows.length) {
            const list = rows
                .filter((r) => r.linkFailures < 2)
                .map((r) => rollForward({ ...(JSON.parse(r.data) as Program), kind: r.kind as Program["kind"] }, today))
                .filter((p) => !isExpired(p, today));
            memo = { at: Date.now(), list };
            return { list, fromSeed: false };
        }
    } catch { /* table missing or DB down */ }
    return { list: seed.map((p) => rollForward({ ...p, kind: kindOf(p), recurring: p.recurring ?? true }, today)), fromSeed: true };
}

export function clearOpportunityMemo() { memo = null; }
