/**
 * Optional LLM access. Every caller must work when this returns null:
 * AI adds explanation, it never gates core functionality.
 *
 * Env: OPENROUTER_API_KEY (required to enable), OPENROUTER_MODEL (optional).
 */

const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct";

export function aiEnabled(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
}

export interface CompleteOptions {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    system?: string;
}

/** Returns the model's text, or null if AI is disabled or the call failed. */
export async function complete(prompt: string, opts: CompleteOptions = {}): Promise<string | null> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return null;
    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
                messages: [
                    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
                    { role: "user", content: prompt },
                ],
                max_tokens: opts.maxTokens ?? 600,
                temperature: opts.temperature ?? 0.2,
            }),
            signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
        });
        if (!res.ok) {
            console.warn(`[ai] OpenRouter ${res.status}`);
            return null;
        }
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        return typeof text === "string" && text.trim() ? text.trim() : null;
    } catch (err) {
        console.warn("[ai] completion failed:", err instanceof Error ? err.message : err);
        return null;
    }
}

/** Untrusted text goes in a fenced block so instructions inside it are treated as data. */
export function quoteUntrusted(label: string, text: string, max = 4000): string {
    return `<${label}>\n${text.slice(0, max).replace(new RegExp(`</?${label}>`, "g"), "")}\n</${label}>`;
}
