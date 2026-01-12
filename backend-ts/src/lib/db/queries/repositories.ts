/**
 * Repository Queries - Drizzle ORM
 * 
 * All repository-related database operations.
 */

import { db } from "@/db";
import { repositories, issues, users } from "@/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
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

export async function getMaintainerRepositories(userId: string) {
    const repos = await db.select().from(repositories).where(eq(repositories.userId, userId));

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

    const contributedIssues = await db.select({
        repoId: issues.repoId,
        repoName: issues.repoName,
        owner: issues.owner,
        repo: issues.repo,
    })
        .from(issues)
        .where(eq(issues.authorName, username))
        .groupBy(issues.repoId, issues.repoName, issues.owner, issues.repo);

    // Filter out owned repos
    const contributedRepos = contributedIssues.filter(issue => !userRepoIds.has(issue.repoId));

    // Get counts for each repo
    const reposWithCounts = await Promise.all(contributedRepos.map(async (repo) => {
        const myIssues = await db.select({ count: count() })
            .from(issues)
            .where(and(eq(issues.repoId, repo.repoId), eq(issues.authorName, username)));

        return {
            id: repo.repoId,
            name: repo.repo || repo.repoName.split("/")[1],
            owner: repo.owner || repo.repoName.split("/")[0],
            fullName: repo.repoName,
            myContributions: myIssues[0]?.count || 0,
        };
    }));

    return reposWithCounts;
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
