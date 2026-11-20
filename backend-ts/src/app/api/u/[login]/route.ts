/**
 * GET /api/u/:login — public profile, no sign-in. 404 unless the owner
 * turned the public link on. Built with the owner's stored GitHub token and
 * cached 1 hour; contains only what publicView() allows.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fetchJourney } from "@/lib/journey";
import { MINUTE, cached } from "@/lib/github/services";
import { createGitHubClient } from "@/lib/github-client";
import { getSettingsByLogin, publicView } from "@/lib/profile";

const notFound = () => NextResponse.json({ error: "This profile is private or doesn't exist." }, { status: 404 });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ login: string }> }) {
    const { login } = await params;
    if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) return notFound();
    try {
        const s = await getSettingsByLogin(login);
        if (!s?.public) return notFound();
        const owner = (await db.select({ username: users.username, token: users.githubAccessToken }).from(users).where(eq(users.id, s.userId)).limit(1))[0];
        if (!owner?.token) return notFound();
        const journey = await cached(`journey:${owner.username}`.toLowerCase(), 60 * MINUTE,
            () => fetchJourney(createGitHubClient(owner.token!), owner.username, owner.token));
        return NextResponse.json(publicView(owner.username, journey, s), { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
        console.error("[u/login]", err);
        return NextResponse.json({ error: "Could not load this profile right now." }, { status: 502 });
    }
}
