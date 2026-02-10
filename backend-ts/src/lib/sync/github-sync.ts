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
    return db.select({
        id: issues.id,
        githubIssueId: issues.githubIssueId,
        number: issues.number,
        title: issues.title,
        body: issues.body,
        authorName: issues.authorName,
        repoId: issues.repoId,
        repoName: issues.repoName,
        owner: issues.owner,
        repo: issues.repo,
        htmlUrl: issues.htmlUrl,
        state: issues.state,
        isPR: issues.isPR,
        authorAssociation: issues.authorAssociation,
        headSha: issues.headSha,
        updatedAt: issues.updatedAt,
        createdAt: issues.createdAt,
    }).from(issues).where(eq(issues.repoId, repoId));
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
        const rawDbIssues = await getIssuesByRepoId(repoId);
        // Deduplicate DB issues by number (same PR may have been inserted multiple times)
        const dbIssuesByNumber = new Map<number, typeof rawDbIssues[0]>();
        const duplicateIds: string[] = [];
        for (const i of rawDbIssues) {
            if (dbIssuesByNumber.has(i.number)) {
                duplicateIds.push(i.id); // mark as duplicate for cleanup
            } else {
                dbIssuesByNumber.set(i.number, i);
            }
        }
        // Clean up existing duplicates in DB
        for (const id of duplicateIds) {
            await db.delete(issues).where(eq(issues.id, id));
        }
        const dbIssues = Array.from(dbIssuesByNumber.values());

        // Track GitHub issue numbers we've seen from the open list
        const openNumbers = new Set<number>();
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
            openNumbers.add(ghItem.number);
            checkMentorStatus(ghItem);
            
            // Skip items that don't match role filter
            if (!shouldIncludeItem(ghItem)) {
                continue;
            }
            
            const isPR = !!ghItem.pull_request;
            const existingIssue = dbIssuesByNumber.get(ghItem.number);

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
            if (!openNumbers.has(dbIssue.number)) {
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

        // Get existing issues for this contributor from DB
        const rawExistingIssues = await db.select()
            .from(issues)
            .where(eq(issues.authorName, username));
        // Deduplicate by number+repoId, keeping first occurrence
        const existingByKey = new Map<string, typeof rawExistingIssues[0]>();
        const contribDupIds: string[] = [];
        for (const i of rawExistingIssues) {
            const key = `${i.repoId}:${i.number}`;
            if (existingByKey.has(key)) {
                contribDupIds.push(i.id);
            } else {
                existingByKey.set(key, i);
            }
        }
        for (const id of contribDupIds) {
            await db.delete(issues).where(eq(issues.id, id));
        }
        const existingIssues = Array.from(existingByKey.values());

        // Cache for repo lookups/creates
        const repoCache = new Map<string, string>();

        // Helper to get or create a repository entry
        const getOrCreateRepo = async (owner: string, repo: string, repoName: string): Promise<string> => {
            const cacheKey = repoName;
            if (repoCache.has(cacheKey)) {
                return repoCache.get(cacheKey)!;
            }

            // Check if repo exists in DB
            const existingRepo = await db.select({ id: repositories.id })
                .from(repositories)
                .where(eq(repositories.name, repoName))
                .limit(1);

            if (existingRepo[0]) {
                repoCache.set(cacheKey, existingRepo[0].id);
                return existingRepo[0].id;
            }

            // Create a new repository entry for contributor tracking
            const newRepoId = uuidv4();
            await db.insert(repositories).values({
                id: newRepoId,
                githubRepoId: 0, // Placeholder - we don't have the actual GitHub repo ID from search
                name: repoName,
                owner: owner,
                userId: userId, // Associate with the contributor
                createdAt: new Date().toISOString(),
            }).onConflictDoNothing();

            repoCache.set(cacheKey, newRepoId);
            return newRepoId;
        };

        // Track seen numbers per repo for reconciliation
        const openKeys = new Set<string>();

        // Process each GitHub item
        for (const item of allGitHubItems) {
            const repoUrl = item.repository_url || "";
            const repoMatch = repoUrl.match(/repos\/([^/]+)\/([^/]+)/);
            const owner = repoMatch?.[1] || "";
            const repo = repoMatch?.[2] || "";
            const repoName = `${owner}/${repo}`;
            const isPR = !!item.pull_request;

            // Get or create the repository entry (needed for key lookup)
            const repoId = await getOrCreateRepo(owner, repo, repoName);
            const key = `${repoId}:${item.number}`;
            openKeys.add(key);

            const existing = existingByKey.get(key);

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
                // Create new issue
                const newId = uuidv4();
                await db.insert(issues).values({
                    id: newId,
                    githubIssueId: item.id,
                    number: item.number,
                    title: item.title,
                    body: item.body || null,
                    authorName: item.user?.login || username,
                    repoId: repoId,
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
            const key = `${existing.repoId}:${existing.number}`;
            if (!openKeys.has(key)) {
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

// =============================================================================
// Reconcile Single Issue - Check specific issue state on GitHub
// =============================================================================

interface IssueReconcileResult {
    success: boolean;
    owner: string;
    repo: string;
    issueNumber: number;
    githubState: 'open' | 'closed' | 'not_found';
    dbState: 'open' | 'closed' | 'not_found';
    action: 'none' | 'deleted' | 'updated' | 'created';
    message: string;
}

/**
 * Reconcile a specific issue by checking its state on GitHub
 * and updating the database accordingly.
 * 
 * This is useful for immediately syncing a specific issue
 * (e.g., cosmicMagnetar/openTriage#1) without waiting for full sync.
 */
export async function reconcileSingleIssue(
    accessToken: string,
    owner: string,
    repo: string,
    issueNumber: number
): Promise<IssueReconcileResult> {
    const octokit = new Octokit({ auth: accessToken });
    const repoName = `${owner}/${repo}`;
    
    try {
        // 1. Check issue state on GitHub
        let githubIssue: GitHubIssue | null = null;
        let githubState: 'open' | 'closed' | 'not_found' = 'not_found';
        
        try {
            const response = await octokit.issues.get({
                owner,
                repo,
                issue_number: issueNumber,
            });
            githubIssue = response.data as GitHubIssue;
            githubState = githubIssue.state as 'open' | 'closed';
        } catch (error: any) {
            if (error.status === 404) {
                githubState = 'not_found';
            } else {
                throw error;
            }
        }

        // 2. Check current state in database
        const dbIssue = await db.select()
            .from(issues)
            .where(
                and(
                    eq(issues.owner, owner),
                    eq(issues.repo, repo),
                    eq(issues.number, issueNumber)
                )
            )
            .limit(1);

        const existingIssue = dbIssue[0];
        const dbState: 'open' | 'closed' | 'not_found' = existingIssue 
            ? (existingIssue.state as 'open' | 'closed') 
            : 'not_found';

        // 3. Reconcile based on states
        let action: 'none' | 'deleted' | 'updated' | 'created' = 'none';
        let message = '';

        if (githubState === 'closed' || githubState === 'not_found') {
            // Issue is closed or doesn't exist on GitHub - delete from DB
            if (existingIssue) {
                await db.delete(issues).where(eq(issues.id, existingIssue.id));
                action = 'deleted';
                message = `Issue #${issueNumber} is ${githubState} on GitHub - removed from database`;
                
                // Publish deletion event
                if (isAblyConfigured()) {
                    await publishIssueDeleted({
                        id: existingIssue.id,
                        githubIssueId: existingIssue.githubIssueId,
                        number: issueNumber,
                        title: existingIssue.title,
                        repoName,
                        owner,
                        repo,
                        isPR: existingIssue.isPR,
                        state: 'closed',
                    });
                }
                
                console.log(`[Reconcile] ${repoName}#${issueNumber}: Deleted (${githubState} on GitHub)`);
            } else {
                message = `Issue #${issueNumber} is ${githubState} on GitHub and not in database - no action needed`;
            }
        } else if (githubState === 'open' && githubIssue) {
            // Issue is open on GitHub
            if (existingIssue) {
                // Update existing issue
                if (existingIssue.state !== 'open' || existingIssue.title !== githubIssue.title) {
                    await db.update(issues)
                        .set({
                            state: 'open',
                            title: githubIssue.title,
                            body: githubIssue.body || null,
                        })
                        .where(eq(issues.id, existingIssue.id));
                    action = 'updated';
                    message = `Issue #${issueNumber} updated to match GitHub state`;
                } else {
                    message = `Issue #${issueNumber} is already in sync`;
                }
            } else {
                // Issue is open on GitHub but not in DB - would need repo context to create
                message = `Issue #${issueNumber} is open on GitHub but not tracked. Run full sync to add it.`;
            }
        }

        return {
            success: true,
            owner,
            repo,
            issueNumber,
            githubState,
            dbState,
            action,
            message,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Reconcile] Error for ${repoName}#${issueNumber}:`, errorMessage);
        return {
            success: false,
            owner,
            repo,
            issueNumber,
            githubState: 'not_found',
            dbState: 'not_found',
            action: 'none',
            message: `Error reconciling issue: ${errorMessage}`,
        };
    }
}

/**
 * Reconcile the critical tracked issue: cosmicMagnetar/openTriage#1
 * This ensures the issue state is immediately synced from GitHub.
 */
export async function reconcileOpenTriageIssue1(accessToken: string): Promise<IssueReconcileResult> {
    return reconcileSingleIssue(accessToken, 'cosmicMagnetar', 'openTriage', 1);
}

/**
 * Fetch user's PRs directly from repos they've contributed to using the Pulls API.
 * This bypasses the GitHub Search API indexing delay.
 * 
 * We check repos where the user already has PRs tracked, plus repos from recent activity.
 */
export async function syncContributorPRsDirect(
    userId: string,
    username: string,
    accessToken: string
): Promise<{ added: number; updated: number; repos: string[] }> {
    const octokit = new Octokit({ auth: accessToken });
    const result = { added: 0, updated: 0, repos: [] as string[] };
    
    try {
        // Get unique repos where this user already has tracked issues
        const existingIssues = await db.select({
            owner: issues.owner,
            repo: issues.repo,
            repoId: issues.repoId,
        })
            .from(issues)
            .where(eq(issues.authorName, username));

        const uniqueRepos = new Map<string, { owner: string; repo: string; repoId: string | null }>();
        for (const issue of existingIssues) {
            const key = `${issue.owner}/${issue.repo}`;
            if (!uniqueRepos.has(key) && issue.owner && issue.repo) {
                uniqueRepos.set(key, {
                    owner: issue.owner,
                    repo: issue.repo,
                    repoId: issue.repoId,
                });
            }
        }

        // Also fetch recent activity to find new repos where user has PRs
        try {
            const events = await octokit.activity.listPublicEventsForUser({
                username,
                per_page: 50,
            });
            
            for (const event of events.data) {
                if (event.type === 'PullRequestEvent' && event.repo?.name) {
                    const [owner, repo] = event.repo.name.split('/');
                    const key = event.repo.name;
                    if (!uniqueRepos.has(key) && owner && repo) {
                        uniqueRepos.set(key, { owner, repo, repoId: null });
                    }
                }
            }
        } catch (eventError) {
            // Ignore event fetch errors - just use existing repos
            console.log(`[DirectSync] Could not fetch events for ${username}`);
        }

        // Helper to get or create repo
        const getOrCreateRepo = async (owner: string, repo: string, repoName: string): Promise<string> => {
            const existingRepo = await db.select({ id: repositories.id })
                .from(repositories)
                .where(eq(repositories.name, repoName))
                .limit(1);

            if (existingRepo[0]) {
                return existingRepo[0].id;
            }

            const newRepoId = uuidv4();
            await db.insert(repositories).values({
                id: newRepoId,
                githubRepoId: 0,
                name: repoName,
                owner: owner,
                userId: userId,
                createdAt: new Date().toISOString(),
            }).onConflictDoNothing();
            return newRepoId;
        };

        // For each repo, fetch open PRs by this author directly from Pulls API
        for (const [repoName, repoInfo] of uniqueRepos) {
            try {
                const prs = await octokit.pulls.list({
                    owner: repoInfo.owner,
                    repo: repoInfo.repo,
                    state: 'open',
                    per_page: 30,
                });

                // Filter to only this user's PRs
                const userPRs = prs.data.filter(pr => pr.user?.login === username);
                
                for (const pr of userPRs) {
                    // Get or create the repository entry first (needed for number+repoId check)
                    const repoId = repoInfo.repoId || await getOrCreateRepo(repoInfo.owner, repoInfo.repo, repoName);
                    
                    // Check if PR already exists by number+repoId (true unique identifier)
                    const existing = await db.select({ id: issues.id, state: issues.state })
                        .from(issues)
                        .where(and(eq(issues.number, pr.number), eq(issues.repoId, repoId)))
                        .limit(1);

                    if (existing[0]) {
                        // Update state if needed
                        if (existing[0].state !== pr.state) {
                            await db.update(issues)
                                .set({ state: pr.state, title: pr.title, body: pr.body || null })
                                .where(eq(issues.id, existing[0].id));
                            result.updated++;
                        }
                    } else {
                        // Create new PR entry
                        const newId = uuidv4();
                        await db.insert(issues).values({
                            id: newId,
                            githubIssueId: pr.id,
                            number: pr.number,
                            title: pr.title,
                            body: pr.body || null,
                            authorName: username,
                            repoId: repoId,
                            repoName,
                            owner: repoInfo.owner,
                            repo: repoInfo.repo,
                            htmlUrl: pr.html_url,
                            state: pr.state || 'open',
                            isPR: true,
                            authorAssociation: pr.author_association as AuthorAssociation,
                            createdAt: new Date().toISOString(),
                        }).onConflictDoNothing();
                        result.added++;
                    }
                }

                if (userPRs.length > 0) {
                    result.repos.push(repoName);
                }
            } catch (repoError) {
                // Skip repos we can't access (private, deleted, etc.)
                console.log(`[DirectSync] Skipping ${repoName}: ${repoError instanceof Error ? repoError.message : String(repoError)}`);
            }
        }

        console.log(`[DirectSync] ${username}: ${result.added} added, ${result.updated} updated from ${result.repos.length} repos`);
    } catch (error) {
        console.error(`[DirectSync] Error for ${username}:`, error);
    }

    return result;
}
