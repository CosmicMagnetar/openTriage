/**
 * Bring-your-own AI key. Each user's key is encrypted (AES-256-GCM) before it
 * is stored, never returned to the browser (only the last 4 characters), and
 * only used for that user's own requests. OpenTriage pays for nothing.
 *
 * Encryption key: AI_KEY_SECRET, else derived from JWT_SECRET.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { syncDb } from "@/lib/opportunities/remoteDb";

export const PROVIDERS = ["anthropic", "openrouter", "openai"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Defaults when the user doesn't pick a model. OpenAI needs an explicit model. */
export const DEFAULT_MODEL: Record<Provider, string | null> = {
    anthropic: "claude-opus-5-5",
    openrouter: "openrouter/auto",
    openai: null,
};

export interface StoredKey { provider: Provider; model: string | null; apiKey: string }
export interface KeyStatus { set: boolean; provider: Provider | null; model: string | null; last4: string | null }

function secretKey(): Buffer {
    const secret = process.env.AI_KEY_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error("Server is missing AI_KEY_SECRET / JWT_SECRET");
    // Fixed salt is fine here: the secret itself is high-entropy and server-only.
    return scryptSync(secret, "opentriage:ai-keys:v1", 32);
}

export function encrypt(plain: string, key = secretKey()): string {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decrypt(box: string, key = secretKey()): string {
    const [v, iv, tag, data] = box.split(".");
    if (v !== "v1" || !iv || !tag || !data) throw new Error("Unknown key format");
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** Light shape check per provider; the real test is the first request. */
export function validKey(provider: Provider, apiKey: string): boolean {
    const k = apiKey.trim();
    if (k.length < 20 || k.length > 300 || /\s/.test(k)) return false;
    if (provider === "anthropic") return k.startsWith("sk-ant-");
    if (provider === "openrouter") return k.startsWith("sk-or-");
    return k.startsWith("sk-");
}

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
    ensured ??= syncDb().run(sql`CREATE TABLE IF NOT EXISTS user_ai_keys (
        user_id TEXT PRIMARY KEY NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        secret TEXT NOT NULL,
        last4 TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`).then(() => undefined).catch((e) => { ensured = null; throw e; });
    return ensured;
}

/** Just-saved keys, so the next request works before the replica syncs. */
const recent = new Map<string, { row: { provider: string; model: string | null; secret: string; last4: string } | null; at: number }>();

async function row(userId: string) {
    const r = recent.get(userId);
    if (r && Date.now() - r.at < 120_000) return r.row;
    try {
        const rows = await db.all<{ provider: string; model: string | null; secret: string; last4: string }>(
            sql`SELECT provider, model, secret, last4 FROM user_ai_keys WHERE user_id = ${userId} LIMIT 1`);
        return rows[0] ?? null;
    } catch {
        return null;
    }
}

export async function keyStatus(userId: string): Promise<KeyStatus> {
    const r = await row(userId);
    return r ? { set: true, provider: r.provider as Provider, model: r.model, last4: r.last4 } : { set: false, provider: null, model: null, last4: null };
}

export async function loadKey(userId: string): Promise<StoredKey | null> {
    const r = await row(userId);
    if (!r) return null;
    try {
        return { provider: r.provider as Provider, model: r.model, apiKey: decrypt(r.secret) };
    } catch {
        return null; // secret rotated: the user has to save the key again
    }
}

export async function saveKey(userId: string, provider: Provider, apiKey: string, model: string | null): Promise<KeyStatus> {
    await ensureTable();
    const k = apiKey.trim();
    const last4 = k.slice(-4);
    const secret = encrypt(k);
    const fp = createHash("sha256").update(k).digest("hex").slice(0, 12);
    const now = Date.now();
    await syncDb().run(sql`INSERT INTO user_ai_keys (user_id, provider, model, secret, last4, fingerprint, updated_at)
        VALUES (${userId}, ${provider}, ${model}, ${secret}, ${last4}, ${fp}, ${now})
        ON CONFLICT(user_id) DO UPDATE SET provider = excluded.provider, model = excluded.model, secret = excluded.secret,
            last4 = excluded.last4, fingerprint = excluded.fingerprint, updated_at = excluded.updated_at`);
    recent.set(userId, { row: { provider, model, secret, last4 }, at: now });
    return { set: true, provider, model, last4 };
}

export async function deleteKey(userId: string): Promise<void> {
    await ensureTable();
    await syncDb().run(sql`DELETE FROM user_ai_keys WHERE user_id = ${userId}`);
    recent.set(userId, { row: null, at: Date.now() });
}
