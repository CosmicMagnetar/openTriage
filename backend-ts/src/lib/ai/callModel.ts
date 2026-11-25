/**
 * One request to the user's chosen provider with the user's own key.
 * - Anthropic: official SDK, Claude Opus 5.5 by default, effort set
 *   explicitly, server-side refusal fallback on ("default" routing).
 * - OpenRouter / OpenAI: their chat-completions endpoint.
 * Returns the text, or throws an AiError with a message safe to show.
 */
import type { StoredKey } from "./byok";
import { DEFAULT_MODEL } from "./byok";

export class AiError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export interface CallInput { system: string; prompt: string; maxTokens?: number }

async function anthropic(key: StoredKey, input: CallInput): Promise<string> {
    // Loaded lazily so modules (and tests) that don't call Claude never load the SDK.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key.apiKey, timeout: 180_000, maxRetries: 1 });
    try {
        const res = await client.beta.messages.create({
            model: key.model || DEFAULT_MODEL.anthropic!,
            max_tokens: input.maxTokens ?? 16000,
            // Thinking is always on for Claude Opus 5.5; effort controls depth and cost (default would be medium too).
            output_config: { effort: "medium" },
            // On a safety decline, retry inside the same call on a fallback model chosen by refusal category.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: input.system,
            messages: [{ role: "user", content: input.prompt }],
        });
        if (res.stop_reason === "refusal") throw new AiError(422, "The model declined this request.");
        if (res.stop_reason === "max_tokens") throw new AiError(502, "The answer was cut off; try again.");
        let text = "";
        for (const block of res.content) if (block.type === "text") text += block.text;
        return text;
    } catch (e) {
        if (e instanceof AiError) throw e;
        if (e instanceof Anthropic.AuthenticationError) throw new AiError(401, "Your Anthropic key was rejected. Check it in Settings.");
        if (e instanceof Anthropic.RateLimitError) throw new AiError(429, "Your Anthropic key hit its rate limit. Try again shortly.");
        if (e instanceof Anthropic.BadRequestError) throw new AiError(400, `Anthropic rejected the request: ${e.message.slice(0, 200)}`);
        if (e instanceof Anthropic.APIError) throw new AiError(502, `Anthropic error ${e.status ?? ""}`.trim());
        throw new AiError(502, "Could not reach Anthropic.");
    }
}

async function chatCompletions(url: string, key: StoredKey, input: CallInput, model: string): Promise<string> {
    let res: Response;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${key.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                max_tokens: input.maxTokens ?? 16000,
                messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }],
            }),
            signal: AbortSignal.timeout(180_000),
        });
    } catch {
        throw new AiError(502, "Could not reach the AI provider.");
    }
    if (res.status === 401 || res.status === 403) throw new AiError(401, "Your key was rejected. Check it in Settings.");
    if (res.status === 429) throw new AiError(429, "Your key hit its rate limit. Try again shortly.");
    if (!res.ok) throw new AiError(502, `AI provider error ${res.status}`);
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = j.choices?.[0]?.message?.content;
    if (!text) throw new AiError(502, "The AI provider returned an empty answer.");
    return text;
}

export async function callModel(key: StoredKey, input: CallInput): Promise<{ text: string; model: string }> {
    if (key.provider === "anthropic") return { text: await anthropic(key, input), model: key.model || DEFAULT_MODEL.anthropic! };
    if (key.provider === "openrouter") {
        const model = key.model || DEFAULT_MODEL.openrouter!;
        return { text: await chatCompletions("https://openrouter.ai/api/v1/chat/completions", key, input, model), model };
    }
    if (!key.model) throw new AiError(400, "Pick a model for your OpenAI key in Settings.");
    return { text: await chatCompletions("https://api.openai.com/v1/chat/completions", key, input, key.model), model: key.model };
}
