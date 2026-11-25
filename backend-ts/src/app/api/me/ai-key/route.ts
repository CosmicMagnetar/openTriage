/**
 * GET    /api/me/ai-key                              { set, provider, model, last4 } (never the key)
 * PUT    /api/me/ai-key { provider, apiKey, model? }  save (encrypted)
 * DELETE /api/me/ai-key                              remove
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { PROVIDERS, deleteKey, keyStatus, saveKey, validKey, type Provider } from "@/lib/ai/byok";

export async function GET(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    return NextResponse.json(await keyStatus(user!.id));
}

export async function PUT(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const body = await request.json().catch(() => ({}));
    const provider = PROVIDERS.find((p) => p === body?.provider) as Provider | undefined;
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey : "";
    const model = typeof body?.model === "string" && /^[\w./:@-]{1,100}$/.test(body.model.trim()) ? body.model.trim() : null;
    if (!provider) return NextResponse.json({ error: "Pick a provider: anthropic, openrouter or openai" }, { status: 400 });
    const NAME: Record<Provider, string> = { anthropic: "an Anthropic", openrouter: "an OpenRouter", openai: "an OpenAI" };
    if (!validKey(provider, apiKey)) return NextResponse.json({ error: `That doesn't look like ${NAME[provider]} API key` }, { status: 400 });
    if (provider === "openai" && !model) return NextResponse.json({ error: "Add the model name to use with your OpenAI key" }, { status: 400 });
    try {
        return NextResponse.json(await saveKey(user!.id, provider, apiKey, model));
    } catch (e) {
        console.error("[ai-key] save failed", e instanceof Error ? e.message : e);
        return NextResponse.json({ error: "Could not save the key" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    await deleteKey(user!.id);
    return NextResponse.json({ set: false, provider: null, model: null, last4: null });
}
