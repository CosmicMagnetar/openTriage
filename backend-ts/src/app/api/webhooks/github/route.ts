/**
 * POST /api/webhooks/github
 *
 * GitHub Webhook Handler
 *
 * This endpoint receives push, pull_request, and issue events from GitHub.
 * It will eventually replace the 5-minute polling loop by triggering syncs on-demand.
 *
 * Webhook Setup:
 * 1. In GitHub repo settings > Webhooks > Add webhook
 * 2. Payload URL: https://yourdomain.com/api/webhooks/github
 * 3. Content type: application/json
 * 4. Events: push, pull_request, issues
 * 5. Secret: Set a secret in GitHub, store in env var GITHUB_WEBHOOK_SECRET
 * 6. Active: ✓
 *
 * ROADMAP:
 * - Parse webhook payload
 * - Verify GitHub signature
 * - Queue a sync task for the affected repo
 * - Update issues/PRs in real-time without waiting for 5-min polling
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { repositories } from "@/db/schema";
import { eq, and, sql, like } from "drizzle-orm";
import { syncSingleRepository } from "@/lib/sync/github-sync";
import { users } from "@/db/schema";

/**
 * Verify the GitHub webhook signature.
 * GitHub sends X-Hub-Signature-256 header with HMAC-SHA256 of the request body.
 */
function verifyGitHubSignature(payload: string, signature: string): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("[Webhook] GITHUB_WEBHOOK_SECRET not set. Skipping signature verification.");
        return true; // In dev, allow unsigned webhooks if secret not configured
    }

    const hash = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
    const expectedSignature = `sha256=${hash}`;

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

/**
 * Extract repo info from GitHub webhook payload.
 */
interface WebhookPayload {
    action?: string;
    repository?: {
        id: number;
        name: string;
        full_name: string;
        owner: {
            login: string;
            type: string;
        };
        html_url: string;
    };
    pull_request?: {
        number: number;
        title: string;
        state: string;
    };
    issue?: {
        number: number;
        title: string;
        state: string;
    };
    pusher?: {
        name: string;
    };
    ref?: string;  // for push events
}

export async function POST(request: NextRequest) {
    try {
        // Read the raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256") || "";

        // ✅ Verify GitHub signature
        if (!verifyGitHubSignature(rawBody, signature)) {
            console.warn("[Webhook] Invalid GitHub signature. Rejecting webhook.");
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            );
        }

        const payload: WebhookPayload = JSON.parse(rawBody);
        const repo = payload.repository;

        if (!repo) {
            return NextResponse.json(
                { error: "No repository in payload" },
                { status: 400 }
            );
        }

        const eventType = request.headers.get("x-github-event") || "unknown";
        const repoName = repo.full_name;
        const [owner, repoShort] = repoName.split("/");

        console.log(`[Webhook] Received ${eventType} event for ${repoName}`);

        // ============================================================================
        // HANDLE DIFFERENT EVENT TYPES
        // ============================================================================

        switch (eventType) {
            case "push": {
                // Push event: code was updated
                const ref = payload.ref || "";
                const branch = ref.split("/").pop();
                console.log(`[Webhook] Push to ${repoName}@${branch}`);

                // Only sync on pushes to main/master
                if (branch !== "main" && branch !== "master") {
                    console.log(`[Webhook] Skipping non-main push to branch: ${branch}`);
                    return NextResponse.json({ status: "skipped", reason: "non-main-branch" });
                }

                // Queue a sync for this repo
                await queueRepoSync(owner, repoShort);
                break;
            }

            case "pull_request": {
                // PR event: opened, closed, synchronize, etc.
                const action = payload.action || "";
                const prNumber = payload.pull_request?.number;
                console.log(`[Webhook] Pull request ${action}: #${prNumber}`);

                // Sync on relevant actions only
                if (["opened", "closed", "reopened", "synchronize"].includes(action)) {
                    await queueRepoSync(owner, repoShort);
                }
                break;
            }

            case "issues": {
                // Issue event: opened, closed, etc.
                const action = payload.action || "";
                const issueNumber = payload.issue?.number;
                console.log(`[Webhook] Issue ${action}: #${issueNumber}`);

                // Sync on relevant actions
                if (["opened", "closed", "reopened"].includes(action)) {
                    await queueRepoSync(owner, repoShort);
                }
                break;
            }

            case "ping": {
                // GitHub sends a ping on webhook creation to verify it's reachable
                console.log("[Webhook] Ping from GitHub - webhook is reachable");
                return NextResponse.json({ status: "pong" });
            }

            default: {
                console.log(`[Webhook] Unhandled event type: ${eventType}`);
                return NextResponse.json({
                    status: "ignored",
                    reason: "unhandled-event-type",
                });
            }
        }

        return NextResponse.json({ status: "ok", repo: repoName });

    } catch (error) {
        console.error("[Webhook] Error processing GitHub webhook:", error);
        return NextResponse.json(
            { error: "Failed to process webhook" },
            { status: 500 }
        );
    }
}

/**
 * Queue a sync for a repository.
 *
 * ROADMAP:
 * - Current: synchronous call to syncSingleRepository
 * - Future: queue to Bull/BullMQ job queue for async processing
 * - Eventually: trigger NextJS server action or external worker
 */
async function queueRepoSync(owner: string, repo: string): Promise<void> {
    try {
        // Find the repository in our DB
        const dbRepo = await db.select()
            .from(repositories)
            .where(
                and(
                    eq(repositories.owner, owner),
                    like(repositories.name, `%${repo}%`)
                )
            )
            .limit(1);

        if (!dbRepo || dbRepo.length === 0) {
            console.warn(
                `[Webhook] Repository ${owner}/${repo} not tracked in DB. Skipping sync.`
            );
            return;
        }

        const repository = dbRepo[0];

        // Get the owner's GitHub token
        const user = await db.select()
            .from(users)
            .where(eq(users.id, repository.userId))
            .limit(1);

        if (!user || user.length === 0 || !user[0].githubAccessToken) {
            console.warn(
                `[Webhook] No GitHub token for user ${repository.userId}. Skipping sync.`
            );
            return;
        }

        const accessToken = user[0].githubAccessToken;

        // ✅ Trigger sync
        console.log(
            `[Webhook] Syncing ${owner}/${repo} (repoId: ${repository.id})`
        );

        const result = await syncSingleRepository(accessToken, repository.id, owner, repo);

        console.log(
            `[Webhook] Sync complete: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`
        );

        // TODO: In production, queue this instead of awaiting synchronously
        // await syncQueue.add("syncRepo", { repoId: repository.id, owner, repo }, { attempts: 3 });

    } catch (error) {
        console.error(
            `[Webhook] Error queuing sync for ${owner}/${repo}:`,
            error
        );
        // Don't re-throw; webhook should return 200 even if sync fails
        // The next polling cycle will catch any missed updates
    }
}
