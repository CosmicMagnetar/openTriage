/**
 * GET /api/me/goals              your goals + feedback (and whether you set goals yet)
 * PUT /api/me/goals { goals }    save goals (learn, résumé, paid, mentorship, foundation; hours; issue size; languages)
 * POST /api/me/goals { id, action: save|hide|not_for_me|clear, tags? }  feedback on a repo or opportunity
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { applyFeedback, sanitizeGoals } from "@/lib/ranking";
import { getGoals, saveGoals } from "@/lib/ranking/store";

const ACTIONS = ["save", "hide", "not_for_me", "clear"] as const;

export async function GET(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    return NextResponse.json(await getGoals(user!.id));
}

export async function PUT(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const body = await request.json().catch(() => ({}));
    const current = await getGoals(user!.id);
    const goals = sanitizeGoals(body?.goals ?? body);
    await saveGoals(user!.id, goals, current.feedback);
    return NextResponse.json({ goals, feedback: current.feedback, set: true });
}

export async function POST(request: NextRequest) {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" && /^[\w:.\-/]{1,200}$/.test(body.id) ? body.id : null;
    const action = ACTIONS.find((a) => a === body?.action);
    if (!id || !action) return NextResponse.json({ error: "Send { id, action: save|hide|not_for_me|clear }" }, { status: 400 });
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown): t is string => typeof t === "string" && t.length <= 40) : [];
    const current = await getGoals(user!.id);
    const feedback = applyFeedback(current.feedback, id, action, tags);
    await saveGoals(user!.id, current.goals, feedback);
    return NextResponse.json({ goals: current.goals, feedback, set: current.set });
}
