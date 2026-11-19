/**
 * Profile settings storage and the public profile view.
 * The public view holds only what the owner chose to show: level, the
 * numbers they picked, badge choices, the contribution graph and a few
 * derived counters. Never PR titles, tokens or private data.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profileSettings } from "@/db/schema-profile";

export const STAT_KEYS = ["merged", "opened", "issues", "reviews", "repos", "streak", "lines"] as const;
export const BANNERS = ["graph", "dots", "lines", "plain"] as const;
export const HUE_KEYS = ["green", "blue", "orange", "magenta", "teal", "amber", "pink"] as const;

export interface ProfileSettings {
    public: boolean;
    hidden: string[];
    featured: string[];
    banner: (typeof BANNERS)[number];
    hue: (typeof HUE_KEYS)[number];
    stats: string[];
    weeklyGoal: number;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
    public: false,
    hidden: [],
    featured: [],
    banner: "graph",
    hue: "magenta",
    stats: ["merged", "opened", "repos", "reviews"],
    weeklyGoal: 3,
};

const ids = (v: unknown, max: number) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)))].slice(0, max) : [];

/** Accept only known keys and shapes from the client. */
export function sanitizeSettings(input: unknown): ProfileSettings {
    const s = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    const goal = Number(s.weeklyGoal);
    return {
        public: s.public === true,
        hidden: ids(s.hidden, 50),
        featured: ids(s.featured, 6),
        banner: (BANNERS as readonly string[]).includes(s.banner as string) ? (s.banner as ProfileSettings["banner"]) : DEFAULT_SETTINGS.banner,
        hue: (HUE_KEYS as readonly string[]).includes(s.hue as string) ? (s.hue as ProfileSettings["hue"]) : DEFAULT_SETTINGS.hue,
        stats: Array.isArray(s.stats)
            ? ids(s.stats, STAT_KEYS.length).filter((k) => (STAT_KEYS as readonly string[]).includes(k))
            : [...DEFAULT_SETTINGS.stats],
        weeklyGoal: Number.isFinite(goal) ? Math.min(50, Math.max(1, Math.round(goal))) : DEFAULT_SETTINGS.weeklyGoal,
    };
}

let ensured: Promise<void> | null = null;
function ensureTable() {
    ensured ??= db.run(sql`CREATE TABLE IF NOT EXISTS profile_settings (
        user_id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 0,
        settings TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
    )`).then(() => undefined).catch((e) => { ensured = null; throw e; });
    return ensured;
}

function parse(row: { isPublic: boolean; settings: string } | undefined): ProfileSettings {
    if (!row) return { ...DEFAULT_SETTINGS };
    let raw: unknown = {};
    try { raw = JSON.parse(row.settings); } catch { /* keep defaults */ }
    return { ...sanitizeSettings(raw), public: !!row.isPublic };
}

export async function getSettings(userId: string): Promise<ProfileSettings> {
    await ensureTable();
    const rows = await db.select().from(profileSettings).where(eq(profileSettings.userId, userId)).limit(1);
    return parse(rows[0]);
}

export async function getSettingsByLogin(login: string): Promise<(ProfileSettings & { userId: string }) | null> {
    await ensureTable();
    const rows = await db.select().from(profileSettings)
        .where(sql`lower(${profileSettings.username}) = ${login.toLowerCase()}`).limit(1);
    return rows[0] ? { ...parse(rows[0]), userId: rows[0].userId } : null;
}

export async function saveSettings(userId: string, username: string, input: unknown): Promise<ProfileSettings> {
    await ensureTable();
    const s = sanitizeSettings(input);
    const { public: isPublic, ...rest } = s;
    const now = new Date().toISOString();
    await db.insert(profileSettings)
        .values({ userId, username, isPublic, settings: JSON.stringify(rest), updatedAt: now })
        .onConflictDoUpdate({ target: profileSettings.userId, set: { username, isPublic, settings: JSON.stringify(rest), updatedAt: now } });
    return s;
}

interface JourneyLike {
    stats: object;
    graph: unknown;
    level: unknown;
    milestones: Array<{ id: string; achievedAt: string | null }>;
    timeline?: Array<{ kind: string; title: string; repo: string }>;
}

/** What a stranger may see. Timeline titles are reduced to two counters badges need. */
export function publicView(login: string, journey: JourneyLike, s: ProfileSettings) {
    const tl = journey.timeline ?? [];
    return {
        login,
        settings: { hidden: s.hidden, featured: s.featured, banner: s.banner, hue: s.hue, stats: s.stats },
        stats: journey.stats,
        level: journey.level,
        graph: journey.graph,
        milestones: journey.milestones.map((m) => ({ id: m.id, achievedAt: m.achievedAt })),
        derived: {
            docsPrs: tl.filter((e) => e.kind === "pr" && /readme|docs?\b|documentation|typo/i.test(e.title)).length,
            outsideRepos: new Set(tl.filter((e) => !e.repo.toLowerCase().startsWith(`${login.toLowerCase()}/`)).map((e) => e.repo)).size,
        },
    };
}
