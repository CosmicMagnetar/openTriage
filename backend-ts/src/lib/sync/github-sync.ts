/**
 * GitHub Sync Service
 * 
 * Handles synchronization of issues and PRs from GitHub to the database.
 * Uses Promise.allSettled for resilient parallel fetching.
 */

import { Octokit } from "@octokit/rest";
import { db } from "@/db";
import { issues, repositories, triageData, users } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { GitHubIssue, AuthorAssociation } from "@/lib/types/github";
import { publishIssueCreated, publishIssueUpdated, publishIssueDeleted, publishSyncComplete, isAblyConfigured } from "@/lib/ably-client";

// Sync interval: 5 minutes
export const SYNC_INTERVAL_MS = 300000;

// =============================================================================
// Types
// =============================================================================

interface SyncResult {
    repoId: string;
    repoName: string;
    success: boolean;
    created: number;
    updated: number;
    deleted: number;
    error?: string;
}

interface SyncStats {
    reposProcessed: number;
    issuesUpdated: number;
    issuesDeleted: number;
    errors: string[];
}

// =============================================================================
// Issue Deletion
// =============================================================================

export async function deleteIssue(issueId: string): Promise<void> {
    // Triage data will cascade delete due to foreign key
    await db.delete(triageData).where(eq(triageData.issueId, issueId));
    await db.delete(issues).where(eq(issues.id, issueId));
}

export async function deleteIssueByGithubId(githubIssueId: number): Promise<void> {
    const issue = await db.select()
        .from(issues)
        .where(eq(issues.githubIssueId, githubIssueId))
        .limit(1);

    if (issue[0]) {
        await deleteIssue(issue[0].id);
    }
}

// =============================================================================
// Get Issues for Repository
// =============================================================================

export async function getIssuesByRepoId(repoId: string) {
    return db.select().from(issues).where(eq(issues.repoId, repoId));
}

// =============================================================================
// Single Repository Sync
// =============================================================================

async function syncRepository(
    octokit: Octokit,
    repoId: string,
    owner: string,
    repo: string
): Promise<SyncResult> {
    const repoName = `${owner}/${repo}`;

    try {
        // Fetch all open issues from GitHub (paginated)
        const openItems = await octokit.paginate(octokit.issues.listForRepo, {
            owner,
            repo,
            state: "open",
            per_page: 100,
        });

        // Fetch recent closed issues
        const closedResponse = await octokit.issues.listForRepo({
            owner,
            repo,
            state: "closed",
            per_page: 50,
            sort: "updated",
            direction: "desc",
        });
        const closedItems = closedResponse.data;

        // Get current issues in DB for this repo
        const dbIssues = await getIssuesByRepoId(repoId);
        const dbIssuesByGithubId = new Map(dbIssues.map(i => [i.githubIssueId, i]));

        // Track GitHub IDs we've seen in this sync
        const seenGithubIds = new Set<number>();
        // Track potential mentors to update roles
        const potentialMentors = new Set<string>();

        let created = 0;
        let updated = 0;
        let deleted = 0;

        // Helper to check for mentor status
        const checkMentorStatus = (item: any) => {
            const assoc = item.author_association;
            if (assoc === "OWNER" || assoc === "MEMBER" || assoc === "COLLABORATOR") {
                if (item.user?.login) {
                    potentialMentors.add(item.user.login);
                }
            }
        };

        // Process open items
        for (const ghItem of openItems as GitHubIssue[]) {
            seenGithubIds.add(ghItem.id);
            checkMentorStatus(ghItem);
            const isPR = !!ghItem.pull_request;
            const existingIssue = dbIssuesByGithubId.get(ghItem.id);

            if (existingIssue) {
                // Update if state changed or other fields
                if (existingIssue.state !== ghItem.state ||
                    existingIssue.title !== ghItem.title ||
                    existingIssue.authorAssociation !== ghItem.author_association) {
                    await db.update(issues)
                        .set({
                            state: ghItem.state,
                            title: ghItem.title,
                            body: ghItem.body || null,
                            authorAssociation: ghItem.author_association,
                        })
                        .where(eq(issues.id, existingIssue.id));
                    updated++;

                    if (isAblyConfigured()) {
                        await publishIssueUpdated({
                            id: existingIssue.id,
                            githubIssueId: ghItem.id,
                            number: ghItem.number,
                            title: ghItem.title,
                            repoName,
                            owner,
                            repo,
                            isPR,
                            state: ghItem.state,
                        });
                    }
                }
            } else {
                // Create new issue
                const newId = uuidv4();
                await db.insert(issues).values({
                    id: newId,
                    githubIssueId: ghItem.id,
                    number: ghItem.number,
                    title: ghItem.title,
                    body: ghItem.body || null,
                    authorName: ghItem.user.login,
                    repoId,
                    repoName,
                    owner,
                    repo,
                    htmlUrl: ghItem.html_url,
                    state: ghItem.state,
                    isPR,
                    authorAssociation: ghItem.author_association,
                    createdAt: new Date().toISOString(),
                }).onConflictDoNothing();
                created++;

                if (isAblyConfigured()) {
                    await publishIssueCreated({
                        id: newId,
                        githubIssueId: ghItem.id,
                        number: ghItem.number,
                        title: ghItem.title,
                        repoName,
                        owner,
                        repo,
                        isPR,
                        state: ghItem.state,
                    });
                }
            }
        }

        // Process closed items - explicitly delete them
        for (const ghItem of closedItems as GitHubIssue[]) {
            seenGithubIds.add(ghItem.id);
            checkMentorStatus(ghItem); // Also check closed items for mentor activity
            const existingIssue = dbIssuesByGithubId.get(ghItem.id);

            if (existingIssue) {
                const isPR = !!ghItem.pull_request;
                const isMerged = ghItem.pull_request?.merged_at !== null;

                await deleteIssue(existingIssue.id);
                deleted++;

                if (isAblyConfigured()) {
                    await publishIssueDeleted({
                        id: existingIssue.id,
                        githubIssueId: ghItem.id,
                        number: ghItem.number,
                        title: ghItem.title,
                        repoName,
                        owner,
                        repo,
                        isPR,
                        state: isMerged ? "merged" : "closed",
                    });
                }
            }
        }

        // Cleanup: Delete any DB issue that is marked 'open' but was NOT found in the full GitHub open list
        // This ensures strict synchronization - if it's not in GitHub's open list, it shouldn't be open in our DB
        for (const dbIssue of dbIssues) {
            // Only strictly clean up things we think are open
            if (dbIssue.state === 'open' && !seenGithubIds.has(dbIssue.githubIssueId)) {
                // We double check: if it's open in DB, but missing from Open pagination -> it must be closed/deleted
                // verification is implied by the comprehensive open fetch
                await deleteIssue(dbIssue.id);
                deleted++;

                if (isAblyConfigured()) {
                    await publishIssueDeleted({
                        id: dbIssue.id,
                        githubIssueId: dbIssue.githubIssueId,
                        number: dbIssue.number,
                        title: dbIssue.title,
                        repoName,
                        owner,
                        repo,
                        isPR: dbIssue.isPR,
                        state: "closed", // Assumed closed since missing from open
                    });
                }
            }
        }

        // Update Mentor Roles
        if (potentialMentors.size > 0) {
            for (const username of potentialMentors) {
                // Determine if user exists and upgrade role if eligible
                // We only upgrade if role is null or CONTRIBUTOR. We don't touch MAINTAINER.
                const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
                if (user.length > 0) {
                    const currentRole = user[0].role;
                    if (!currentRole || currentRole === 'CONTRIBUTOR') {
                        await db.update(users)
                            .set({ role: 'MENTOR' })
                            .where(eq(users.id, user[0].id));
                    }
                }
            }
        }

        return { repoId, repoName, success: true, created, updated, deleted };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Sync error for ${repoName}:`, errorMessage);
        return { repoId, repoName, success: false, created: 0, updated: 0, deleted: 0, error: errorMessage };
    }
}

// =============================================================================
// Full Sync (All Repositories)
// =============================================================================

export async function runFullSync(userId: string, accessToken: string): Promise<SyncStats> {
    const octokit = new Octokit({ auth: accessToken });

    // Get all repositories for this user
    const userRepos = await db.select()
        .from(repositories)
        .where(eq(repositories.userId, userId));

    if (userRepos.length === 0) {
        return { reposProcessed: 0, issuesUpdated: 0, issuesDeleted: 0, errors: [] };
    }

    // Sync all repos in parallel using Promise.allSettled
    const syncPromises = userRepos.map(repo =>
        syncRepository(octokit, repo.id, repo.owner, repo.name)
    );

    const results = await Promise.allSettled(syncPromises);

    // Aggregate results
    const stats: SyncStats = {
        reposProcessed: 0,
        issuesUpdated: 0,
        issuesDeleted: 0,
        errors: [],
    };

    for (const result of results) {
        if (result.status === "fulfilled") {
            const syncResult = result.value;
            stats.reposProcessed++;
            stats.issuesUpdated += syncResult.created + syncResult.updated;
            stats.issuesDeleted += syncResult.deleted;
            if (!syncResult.success && syncResult.error) {
                stats.errors.push(`${syncResult.repoName}: ${syncResult.error}`);
            }
        } else {
            stats.errors.push(`Sync failed: ${result.reason}`);
        }
    }

    // Publish sync complete event
    if (isAblyConfigured()) {
        try {
            await publishSyncComplete({
                reposProcessed: stats.reposProcessed,
                issuesUpdated: stats.issuesUpdated,
                issuesDeleted: stats.issuesDeleted,
            });
        } catch (ablyError) {
            console.error("Failed to publish sync complete:", ablyError);
        }
    }

    return stats;
}

// =============================================================================
// Sync Single Repository
// =============================================================================

export async function syncSingleRepository(
    accessToken: string,
    repoId: string,
    owner: string,
    repo: string
): Promise<SyncResult> {
    const octokit = new Octokit({ auth: accessToken });
    return syncRepository(octokit, repoId, owner, repo);
}
