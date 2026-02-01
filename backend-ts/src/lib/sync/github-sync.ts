/**
 * GitHub Sync Service
 * 
 * Handles synchronization of issues and PRs from GitHub to the database.
 * Uses ETag caching for efficient API usage (5,000 req/hr limit).
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
    skipped: boolean;  // True if 304 Not Modified
    error?: string;
}

interface SyncStats {
    reposProcessed: number;
    reposSkipped: number;  // Repos that returned 304 Not Modified
    issuesUpdated: number;
    issuesDeleted: number;
    errors: string[];
}

interface SyncOptions {
    role?: 'MAINTAINER' | 'CONTRIBUTOR';
    username?: string;  // For contributor-specific filtering
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
// Update Repository ETag
// =============================================================================

async function updateRepositoryEtag(repoId: string, etag: string | null): Promise<void> {
    await db.update(repositories)
        .set({ 
            etag: etag,
            lastSyncedAt: new Date().toISOString()
        })
        .where(eq(repositories.id, repoId));
}

async function getRepositoryEtag(repoId: string): Promise<string | null> {
    const repo = await db.select({ etag: repositories.etag })
        .from(repositories)
        .where(eq(repositories.id, repoId))
        .limit(1);
    return repo[0]?.etag || null;
}

// =============================================================================
// Single Repository Sync (with ETag Caching)
// =============================================================================

async function syncRepository(
    octokit: Octokit,
    repoId: string,
    owner: string,
    repo: string,
    options: SyncOptions = {}
): Promise<SyncResult> {
    const repoName = `${owner}/${repo}`;

    try {
        // Get stored ETag for conditional request
        const storedEtag = await getRepositoryEtag(repoId);
        
        // Build headers for conditional request
        const headers: Record<string, string> = {};
        if (storedEtag) {
            headers['If-None-Match'] = storedEtag;
        }

        // Fetch open issues with conditional request
        let openItems: GitHubIssue[] = [];
        let newEtag: string | null = null;
        
        try {
            const response = await octokit.issues.listForRepo({
                owner,
                repo,
                state: "open",
                per_page: 100,
                headers,
            });
            
            // Get ETag from response headers
            newEtag = response.headers.etag || null;
            
            // If we got data, paginate for the rest
            openItems = response.data as GitHubIssue[];
            
            // Paginate if there are more items
            if (response.data.length === 100) {
                const remainingItems = await octokit.paginate(octokit.issues.listForRepo, {
                    owner,
                    repo,
                    state: "open",
                    per_page: 100,
                    page: 2,  // Start from page 2
                });
                openItems = [...openItems, ...(remainingItems as GitHubIssue[])];
            }
        } catch (error: any) {
            // Check for 304 Not Modified
            if (error.status === 304) {
                console.log(`[Sync] ${repoName}: No changes (304 Not Modified)`);
                // Update last synced timestamp even for 304
                await db.update(repositories)
                    .set({ lastSyncedAt: new Date().toISOString() })
                    .where(eq(repositories.id, repoId));
                return { repoId, repoName, success: true, created: 0, updated: 0, deleted: 0, skipped: true };
            }
            throw error;
        }

        // Update stored ETag if we got a new one
        if (newEtag) {
            await updateRepositoryEtag(repoId, newEtag);
        }

        // Get current issues in DB for this repo
        const dbIssues = await getIssuesByRepoId(repoId);
        const dbIssuesByGithubId = new Map(dbIssues.map(i => [i.githubIssueId, i]));

        // Track GitHub IDs we've seen from the open list
        const openGithubIds = new Set<number>();
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

        // For Contributors: filter to only their authored items (PRs and issues)
        const shouldIncludeItem = (item: GitHubIssue): boolean => {
            if (options.role === 'CONTRIBUTOR' && options.username) {
                // Contributors see their own authored PRs and issues
                return item.user.login === options.username;
            }
            // Maintainers see everything
            return true;
        };

        // Process open items
        for (const ghItem of openItems) {
            openGithubIds.add(ghItem.id);
            checkMentorStatus(ghItem);
            
            // Skip items that don't match role filter
            if (!shouldIncludeItem(ghItem)) {
                continue;
            }
            
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

        // =========================================================================
        // STATE RECONCILIATION: Delete issues/PRs that are closed on GitHub
        // If an issue is in our DB but NOT in GitHub's open list, delete it
        // =========================================================================
        for (const dbIssue of dbIssues) {
            // If issue is in DB but NOT in GitHub's open list, it's closed - delete it
            if (!openGithubIds.has(dbIssue.githubIssueId)) {
                await db.delete(issues)
                    .where(eq(issues.id, dbIssue.id));
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
                        state: 'closed',
                    });
                }
                
                console.log(`[Sync] ${repoName}: Deleted #${dbIssue.number} (closed on GitHub)`);
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

        return { repoId, repoName, success: true, created, updated, deleted, skipped: false };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Sync error for ${repoName}:`, errorMessage);
        return { repoId, repoName, success: false, created: 0, updated: 0, deleted: 0, skipped: false, error: errorMessage };
    }
}

// =============================================================================
// Full Sync (All Repositories)
// =============================================================================

export async function runFullSync(
    userId: string, 
    accessToken: string,
    options: SyncOptions = {}
): Promise<SyncStats> {
    const octokit = new Octokit({ auth: accessToken });

    // Get all repositories for this user
    const userRepos = await db.select()
        .from(repositories)
        .where(eq(repositories.userId, userId));

    if (userRepos.length === 0) {
        return { reposProcessed: 0, reposSkipped: 0, issuesUpdated: 0, issuesDeleted: 0, errors: [] };
    }

    // Sync all repos in parallel using Promise.allSettled
    const syncPromises = userRepos.map(repo => {
        // repo.name may contain full path like "owner/repo", extract just the repo name
        const repoNameOnly = repo.name.includes('/') ? repo.name.split('/')[1] : repo.name;
        return syncRepository(octokit, repo.id, repo.owner, repoNameOnly, options);
    });

    const results = await Promise.allSettled(syncPromises);

    // Aggregate results
    const stats: SyncStats = {
        reposProcessed: 0,
        reposSkipped: 0,
        issuesUpdated: 0,
        issuesDeleted: 0,
        errors: [],
    };

    for (const result of results) {
        if (result.status === "fulfilled") {
            const syncResult = result.value;
            stats.reposProcessed++;
            
            if (syncResult.skipped) {
                stats.reposSkipped++;
            } else {
                stats.issuesUpdated += syncResult.created + syncResult.updated;
                stats.issuesDeleted += syncResult.deleted;
            }
            
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

    console.log(`[Sync] Complete: ${stats.reposProcessed} repos, ${stats.reposSkipped} skipped (304), ${stats.issuesUpdated} updated, ${stats.issuesDeleted} deleted`);

    return stats;
}

// =============================================================================
// Sync Single Repository
// =============================================================================

export async function syncSingleRepository(
    accessToken: string,
    repoId: string,
    owner: string,
    repo: string,
    options: SyncOptions = {}
): Promise<SyncResult> {
    const octokit = new Octokit({ auth: accessToken });
    return syncRepository(octokit, repoId, owner, repo, options);
}

// =============================================================================
// Contributor Sync - Fetch all issues/PRs authored by this user from GitHub
// =============================================================================

export async function runContributorSync(
    userId: string,
    username: string,
    accessToken: string
): Promise<SyncStats> {
    const octokit = new Octokit({ auth: accessToken });
    
    const stats: SyncStats = {
        reposProcessed: 0,
        reposSkipped: 0,
        issuesUpdated: 0,
        issuesDeleted: 0,
        errors: [],
    };

    try {
        // Search for all open issues and PRs authored by this user
        const [prsResponse, issuesResponse] = await Promise.all([
            octokit.search.issuesAndPullRequests({
                q: `author:${username} is:pr is:open`,
                per_page: 100,
                sort: "updated",
                order: "desc",
            }),
            octokit.search.issuesAndPullRequests({
                q: `author:${username} is:issue is:open`,
                per_page: 100,
                sort: "updated",
                order: "desc",
            })
        ]);

        const allGitHubItems = [...prsResponse.data.items, ...issuesResponse.data.items];
        const githubItemIds = new Set<number>();

        // Get existing issues for this contributor from DB
        const existingIssues = await db.select()
            .from(issues)
            .where(eq(issues.authorName, username));
        const existingByGithubId = new Map(existingIssues.map(i => [i.githubIssueId, i]));

        // Process each GitHub item
        for (const item of allGitHubItems) {
            githubItemIds.add(item.id);
            
            const repoUrl = item.repository_url || "";
            const repoMatch = repoUrl.match(/repos\/([^/]+)\/([^/]+)/);
            const owner = repoMatch?.[1] || "";
            const repo = repoMatch?.[2] || "";
            const repoName = `${owner}/${repo}`;
            const isPR = !!item.pull_request;

            const existing = existingByGithubId.get(item.id);

            if (existing) {
                // Update if changed
                if (existing.state !== item.state || existing.title !== item.title) {
                    await db.update(issues)
                        .set({
                            state: item.state,
                            title: item.title,
                            body: item.body || null,
                        })
                        .where(eq(issues.id, existing.id));
                    stats.issuesUpdated++;
                }
            } else {
                // Create new issue - need a repoId, use a placeholder or find/create repo
                const newId = uuidv4();
                await db.insert(issues).values({
                    id: newId,
                    githubIssueId: item.id,
                    number: item.number,
                    title: item.title,
                    body: item.body || null,
                    authorName: item.user?.login || username,
                    repoId: `contributor-${userId}`, // Placeholder repoId for contributor-synced issues
                    repoName,
                    owner,
                    repo,
                    htmlUrl: item.html_url,
                    state: item.state || "open",
                    isPR,
                    authorAssociation: item.author_association,
                    createdAt: new Date().toISOString(),
                }).onConflictDoNothing();
                stats.issuesUpdated++;
            }
        }

        // Delete issues that are no longer open on GitHub
        for (const existing of existingIssues) {
            if (!githubItemIds.has(existing.githubIssueId)) {
                await db.delete(issues).where(eq(issues.id, existing.id));
                stats.issuesDeleted++;
            }
        }

        console.log(`[ContributorSync] ${username}: ${stats.issuesUpdated} updated, ${stats.issuesDeleted} deleted`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ContributorSync] Error for ${username}:`, errorMessage);
        stats.errors.push(errorMessage);
    }

    return stats;
}

// =============================================================================
// Maintainer Sync (All open issues/PRs)
// =============================================================================

export async function runMaintainerSync(
    userId: string,
    accessToken: string
): Promise<SyncStats> {
    return runFullSync(userId, accessToken, {
        role: 'MAINTAINER',
    });
}
