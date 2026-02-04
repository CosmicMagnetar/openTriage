/**
 * Repository Queries - Drizzle ORM
 * 
 * All repository-related database operations.
 */

import { db } from "@/db";
import { repositories, issues, users, userRepositories } from "@/db/schema";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// =============================================================================
// Repository CRUD
// =============================================================================

export async function getRepositoryById(id: string) {
    const result = await db.select().from(repositories).where(eq(repositories.id, id)).limit(1);
    return result[0] || null;
}

export async function getRepositoryByGithubId(githubRepoId: number) {
    const result = await db.select().from(repositories).where(eq(repositories.githubRepoId, githubRepoId)).limit(1);
    return result[0] || null;
}

export async function getRepositoriesByUserId(userId: string) {
    return db.select().from(repositories).where(eq(repositories.userId, userId)).orderBy(desc(repositories.createdAt));
}

export async function getRepositoryByFullName(owner: string, name: string) {
    const result = await db.select().from(repositories)
        .where(and(eq(repositories.owner, owner), eq(repositories.name, name)))
        .limit(1);
    return result[0] || null;
}

export async function createRepository(data: {
    githubRepoId: number;
    name: string;
    owner: string;
    userId: string;
}) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.insert(repositories).values({
        id,
        githubRepoId: data.githubRepoId,
        name: data.name,
        owner: data.owner,
        userId: data.userId,
        createdAt: now,
    }).onConflictDoNothing();

    return { id, ...data, createdAt: now };
}

export async function deleteRepository(id: string) {
    await db.delete(repositories).where(eq(repositories.id, id));
}

// =============================================================================
// Maintainer Repositories
// =============================================================================

// =============================================================================
// Maintainer Repositories
// =============================================================================

export async function getMaintainerRepositories(userId: string) {
    // Only return repos explicitly added by the user (maintainer)
    const repos = await db.select()
        .from(repositories)
        .where(and(
            eq(repositories.userId, userId),
            eq(repositories.addedByUser, true)
        ))
        .orderBy(asc(repositories.name));

    // Add issue counts
    const reposWithCounts = await Promise.all(repos.map(async (repo) => {
        const issueCount = await db.select({ count: count() })
            .from(issues)
            .where(and(eq(issues.repoId, repo.id), eq(issues.state, "open")));

        const prCount = await db.select({ count: count() })
            .from(issues)
            .where(and(eq(issues.repoId, repo.id), eq(issues.isPR, true), eq(issues.state, "open")));

        return {
            ...repo,
            fullName: `${repo.owner}/${repo.name}`,
            openIssues: issueCount[0]?.count || 0,
            openPRs: prCount[0]?.count || 0,
        };
    }));

    return reposWithCounts;
}

// =============================================================================
// Contributor Repositories
// =============================================================================

export async function getContributorRepositories(userId: string, username: string) {
    // Get repos where user has contributed (authored issues/PRs) but doesn't own
    const userRepos = await db.select({ id: repositories.id }).from(repositories).where(eq(repositories.userId, userId));
    const userRepoIds = new Set(userRepos.map(r => r.id));

    // Source 1: Repos where user has authored issues/PRs
    const contributedIssues = await db.select({
        repoId: issues.repoId,
        repoName: issues.repoName,
        owner: issues.owner,
        repo: issues.repo,
    })
        .from(issues)
        .where(eq(issues.authorName, username))
        .groupBy(issues.repoId, issues.repoName, issues.owner, issues.repo);

    // Source 2: Repos explicitly tracked via userRepositories table
    const trackedRepos = await db.select({
        repoFullName: userRepositories.repoFullName,
    })
        .from(userRepositories)
        .where(eq(userRepositories.userId, userId));

    // Merge repos from both sources using a Map to avoid duplicates
    const repoMap = new Map<string, { repoId: string | null; repoName: string; owner: string; repo: string }>();

    // Add repos from issues
    for (const issue of contributedIssues) {
        if (!userRepoIds.has(issue.repoId)) {
            repoMap.set(issue.repoName, {
                repoId: issue.repoId,
                repoName: issue.repoName,
                owner: issue.owner || issue.repoName.split("/")[0],
                repo: issue.repo || issue.repoName.split("/")[1],
            });
        }
    }

    // Add repos from userRepositories (may not have repoId if not synced yet)
    for (const tracked of trackedRepos) {
        const [owner, repo] = tracked.repoFullName.split("/");
        if (!repoMap.has(tracked.repoFullName)) {
            repoMap.set(tracked.repoFullName, {
                repoId: null,
                repoName: tracked.repoFullName,
                owner: owner || "",
                repo: repo || "",
            });
        }
    }

    // Get counts for each repo
    const reposWithCounts = await Promise.all(Array.from(repoMap.values()).map(async (repo) => {
        let myContributions = 0;
        if (repo.repoId) {
            const myIssues = await db.select({ count: count() })
                .from(issues)
                .where(and(eq(issues.repoId, repo.repoId), eq(issues.authorName, username)));
            myContributions = myIssues[0]?.count || 0;
        }

        return {
            id: repo.repoId,
            name: repo.repo,
            owner: repo.owner,
            fullName: repo.repoName,
            myContributions,
        };
    }));

    // Sort alphabetically by name
    return reposWithCounts.sort((a, b) => a.name.localeCompare(b.name));
}

// =============================================================================
// Dashboard Stats
// =============================================================================

export async function getRepositoryStats(userId: string) {
    const repos = await getRepositoriesByUserId(userId);
    const repoIds = repos.map(r => r.id);

    if (repoIds.length === 0) {
        return { totalRepos: 0, totalIssues: 0, totalPRs: 0, openIssues: 0, openPRs: 0 };
    }

    const allIssues = await db.select({
        id: issues.id,
        isPR: issues.isPR,
        state: issues.state
    }).from(issues).where(sql`${issues.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`);

    const totalIssues = allIssues.filter(i => !i.isPR).length;
    const totalPRs = allIssues.filter(i => i.isPR).length;
    const openIssues = allIssues.filter(i => !i.isPR && i.state === "open").length;
    const openPRs = allIssues.filter(i => i.isPR && i.state === "open").length;

    return {
        totalRepos: repos.length,
        totalIssues,
        totalPRs,
        openIssues,
        openPRs,
    };
}
