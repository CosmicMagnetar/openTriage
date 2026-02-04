/**
 * Issue Queries - Drizzle ORM
 * 
 * All issue and triage-related database operations.
 */

import { db } from "@/db";
import { issues, triageData, repositories } from "@/db/schema";
import { eq, and, desc, asc, count, or, like, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// =============================================================================
// Issue CRUD
// =============================================================================

export async function getIssueById(id: string) {
    const result = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
    return result[0] || null;
}

export async function getIssueByGithubId(githubIssueId: number) {
    const result = await db.select().from(issues).where(eq(issues.githubIssueId, githubIssueId)).limit(1);
    return result[0] || null;
}

export async function createIssue(data: {
    githubIssueId: number;
    number: number;
    title: string;
    body?: string;
    authorName: string;
    repoId: string;
    repoName: string;
    owner?: string;
    repo?: string;
    htmlUrl?: string;
    state?: string;
    isPR?: boolean;
}) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.insert(issues).values({
        id,
        githubIssueId: data.githubIssueId,
        number: data.number,
        title: data.title,
        body: data.body || null,
        authorName: data.authorName,
        repoId: data.repoId,
        repoName: data.repoName,
        owner: data.owner || null,
        repo: data.repo || null,
        htmlUrl: data.htmlUrl || null,
        state: data.state || "open",
        isPR: data.isPR || false,
        createdAt: now,
    }).onConflictDoNothing();

    return { id, ...data, createdAt: now };
}

export async function updateIssueState(id: string, state: string) {
    await db.update(issues).set({ state }).where(eq(issues.id, id));
}

// =============================================================================
// Issue Listing with Pagination
// =============================================================================

export interface IssueFilters {
    repoId?: string;
    userId?: string;
    authorName?: string;
    state?: string;
    isPR?: boolean;
    search?: string;
}

export async function getIssues(filters: IssueFilters, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (filters.repoId) conditions.push(eq(issues.repoId, filters.repoId));
    if (filters.authorName) conditions.push(eq(issues.authorName, filters.authorName));
    if (filters.state) conditions.push(eq(issues.state, filters.state));
    if (filters.isPR !== undefined) conditions.push(eq(issues.isPR, filters.isPR));
    if (filters.search) {
        conditions.push(or(
            like(issues.title, `%${filters.search}%`),
            like(issues.body, `%${filters.search}%`)
        ));
    }

    // If userId provided, filter by user's repos that were explicitly added
    if (filters.userId) {
        const userRepos = await db.select({ id: repositories.id })
            .from(repositories)
            .where(and(
                eq(repositories.userId, filters.userId),
                eq(repositories.addedByUser, true) // Only repos explicitly added by maintainer
            ));
        const repoIds = userRepos.map(r => r.id);

        if (repoIds.length > 0) {
            conditions.push(sql`${issues.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`);
        } else {
            return { issues: [], total: 0, page, limit, totalPages: 0 };
        }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.select()
        .from(issues)
        .where(whereClause)
        .orderBy(desc(issues.createdAt))
        .limit(limit)
        .offset(offset);

    const totalResult = await db.select({ count: count() })
        .from(issues)
        .where(whereClause);

    const total = totalResult[0]?.count || 0;

    return {
        issues: results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

// =============================================================================
// Issues with Triage Data
// =============================================================================

export async function getIssuesWithTriage(filters: IssueFilters, page = 1, limit = 10) {
    const { issues: issueList, total, totalPages } = await getIssues(filters, page, limit);

    // Fetch triage data for each issue
    const issuesWithTriage = await Promise.all(issueList.map(async (issue) => {
        const triage = await db.select()
            .from(triageData)
            .where(eq(triageData.issueId, issue.id))
            .limit(1);

        return {
            ...issue,
            triage: triage[0] || null,
        };
    }));

    return { issues: issuesWithTriage, total, page, limit, totalPages };
}

// =============================================================================
// Triage Operations
// =============================================================================

export async function getTriageData(issueId: string) {
    const result = await db.select().from(triageData).where(eq(triageData.issueId, issueId)).limit(1);
    return result[0] || null;
}

export async function createOrUpdateTriageData(data: {
    issueId: string;
    classification: string;
    summary: string;
    suggestedLabel: string;
    sentiment: string;
}) {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.insert(triageData).values({
        id,
        issueId: data.issueId,
        classification: data.classification,
        summary: data.summary,
        suggestedLabel: data.suggestedLabel,
        sentiment: data.sentiment,
        analyzedAt: now,
    }).onConflictDoUpdate({
        target: triageData.issueId,
        set: {
            classification: data.classification,
            summary: data.summary,
            suggestedLabel: data.suggestedLabel,
            sentiment: data.sentiment,
            analyzedAt: now,
        }
    });

    return { id, ...data, analyzedAt: now };
}

// =============================================================================
// Dashboard Stats
// =============================================================================

export async function getDashboardStats(userId: string) {
    // Only count issues/PRs from repos explicitly added by the user
    const userRepos = await db.select({ id: repositories.id })
        .from(repositories)
        .where(and(
            eq(repositories.userId, userId),
            eq(repositories.addedByUser, true)
        ));

    if (userRepos.length === 0) {
        return { openIssues: 0, openPRs: 0, triaged: 0, untriaged: 0 };
    }

    const repoIds = userRepos.map(r => r.id);
    const repoCondition = sql`${issues.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`;

    const openIssues = await db.select({ count: count() })
        .from(issues)
        .where(and(repoCondition, eq(issues.state, "open"), eq(issues.isPR, false)));

    const openPRs = await db.select({ count: count() })
        .from(issues)
        .where(and(repoCondition, eq(issues.state, "open"), eq(issues.isPR, true)));

    // Count triaged issues
    const allOpenIssueIds = await db.select({ id: issues.id })
        .from(issues)
        .where(and(repoCondition, eq(issues.state, "open")));

    let triaged = 0;
    for (const issue of allOpenIssueIds) {
        const hasTriagedata = await db.select({ id: triageData.id })
            .from(triageData)
            .where(eq(triageData.issueId, issue.id))
            .limit(1);
        if (hasTriagedata.length > 0) triaged++;
    }

    return {
        openIssues: openIssues[0]?.count || 0,
        openPRs: openPRs[0]?.count || 0,
        triaged,
        untriaged: (openIssues[0]?.count || 0) - triaged,
    };
}
