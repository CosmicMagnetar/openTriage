/**
 * Issue Queries - Drizzle ORM (REFACTORED)
 *
 * All issue and triage-related database operations.
 * REFACTOR: SQL-first pagination using LIMIT/OFFSET, JOINs for triage data.
 * This eliminates N+1 queries and in-memory deduplication.
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
    bodySummary?: string;
    authorName: string;
    repoId: string;
    repoName: string;
    owner?: string;
    repo?: string;
    htmlUrl?: string;
    state?: string;
    isPR?: boolean;
    headSha?: string;  // For PRs
    updatedAt?: string;  // From GitHub's updated_at
}) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Auto-generate bodySummary if not provided
    const summary = data.bodySummary || 
        (data.body ? data.body.substring(0, 200) : null);

    await db.insert(issues).values({
        id,
        githubIssueId: data.githubIssueId,
        number: data.number,
        title: data.title,
        body: data.body || null,
        bodySummary: summary,
        authorName: data.authorName,
        repoId: data.repoId,
        repoName: data.repoName,
        owner: data.owner || null,
        repo: data.repo || null,
        htmlUrl: data.htmlUrl || null,
        state: data.state || "open",
        isPR: data.isPR || false,
        headSha: data.headSha || null,
        updatedAt: data.updatedAt || now,
        createdAt: now,
    }).onConflictDoNothing();

    return { id, ...data, bodySummary: summary, createdAt: now };
}

export async function updateIssueState(id: string, state: string) {
    await db.update(issues).set({ state, updatedAt: new Date().toISOString() }).where(eq(issues.id, id));
}

export async function getIssueByNumberAndRepo(number: number, repoId: string) {
    const result = await db.select().from(issues)
        .where(and(eq(issues.number, number), eq(issues.repoId, repoId)))
        .limit(1);
    return result[0] || null;
}

/**
 * Delete duplicate issue/PR rows, keeping only the oldest entry per number+repoId.
 * Returns the count of deleted duplicates.
 */
export async function cleanupDuplicateIssues() {
    const allIssues = await db.select().from(issues).orderBy(asc(issues.createdAt));
    const kept = new Map<string, string>(); // key -> id to keep
    const toDelete: string[] = [];

    for (const issue of allIssues) {
        const key = `${issue.repoId}:${issue.number}`;
        if (kept.has(key)) {
            toDelete.push(issue.id);
        } else {
            kept.set(key, issue.id);
        }
    }

    for (const id of toDelete) {
        await db.delete(issues).where(eq(issues.id, id));
    }

    return toDelete.length;
}

// =============================================================================
// Issue Listing with SQL Pagination (REFACTORED)
// =============================================================================

export interface IssueFilters {
    repoId?: string;
    repoName?: string;  // Filter by repo name (owner/repo format)
    userId?: string;
    authorName?: string;
    state?: string;
    isPR?: boolean;
    search?: string;
}

/**
 * Pagination using SQL LIMIT/OFFSET.
 * ✅ Never fetches all rows into memory
 * ✅ Uses database-level LIMIT/OFFSET, not JS slice()
 */
export async function getIssues(filters: IssueFilters, page = 1, limit = 10) {
    // Validate page and limit
    const offset = Math.max(0, (page - 1) * limit);
    const safePage = Math.max(1, page);

    // Build conditions
    const conditions = [];
    if (filters.repoId) conditions.push(eq(issues.repoId, filters.repoId));
    if (filters.repoName) conditions.push(eq(issues.repoName, filters.repoName));
    if (filters.authorName) conditions.push(eq(issues.authorName, filters.authorName));
    if (filters.state) conditions.push(eq(issues.state, filters.state));
    if (filters.isPR !== undefined) conditions.push(eq(issues.isPR, filters.isPR));
    if (filters.search) {
        conditions.push(or(
            like(issues.title, `%${filters.search}%`),
            like(issues.bodySummary, `%${filters.search}%`)  // Changed from body to bodySummary for performance
        ));
    }

    // If userId provided, filter by user's repos that were explicitly added
    if (filters.userId) {
        const userRepos = await db.select({ id: repositories.id })
            .from(repositories)
            .where(and(
                eq(repositories.userId, filters.userId),
                eq(repositories.addedByUser, true)
            ));
        const repoIds = userRepos.map(r => r.id);

        if (repoIds.length > 0) {
            conditions.push(sql`${issues.repoId} IN (${sql.join(repoIds.map(id => sql`'${id}'`), sql`, `)})`);
        } else {
            return { issues: [], total: 0, page: safePage, limit, totalPages: 0 };
        }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db.select({ count: count() })
        .from(issues)
        .where(whereClause);
    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // ✅ SQL-level LIMIT/OFFSET — never materializes full result
    const results = await db.select()
        .from(issues)
        .where(whereClause)
        .orderBy(desc(issues.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        issues: results,
        total,
        page: safePage,
        limit,
        totalPages,
    };
}

// =============================================================================
// Issues with Triage Data (REFACTORED - Single Query with JOIN)
// =============================================================================

/**
 * ✅ REFACTORED: Single SQL JOIN instead of Promise.all().
 * Eliminates N+1 query problem. Database joins and returns in one round-trip.
 */
export async function getIssuesWithTriage(filters: IssueFilters, page = 1, limit = 10) {
    // Validate pagination
    const offset = Math.max(0, (page - 1) * limit);
    const safePage = Math.max(1, page);

    // Build conditions (identical to getIssues)
    const conditions = [];
    if (filters.repoId) conditions.push(eq(issues.repoId, filters.repoId));
    if (filters.repoName) conditions.push(eq(issues.repoName, filters.repoName));
    if (filters.authorName) conditions.push(eq(issues.authorName, filters.authorName));
    if (filters.state) conditions.push(eq(issues.state, filters.state));
    if (filters.isPR !== undefined) conditions.push(eq(issues.isPR, filters.isPR));
    if (filters.search) {
        conditions.push(or(
            like(issues.title, `%${filters.search}%`),
            like(issues.bodySummary, `%${filters.search}%`)
        ));
    }

    if (filters.userId) {
        const userRepos = await db.select({ id: repositories.id })
            .from(repositories)
            .where(and(
                eq(repositories.userId, filters.userId),
                eq(repositories.addedByUser, true)
            ));
        const repoIds = userRepos.map(r => r.id);

        if (repoIds.length > 0) {
            conditions.push(sql`${issues.repoId} IN (${sql.join(repoIds.map(id => sql`'${id}'`), sql`, `)})`);
        } else {
            return { issues: [], total: 0, page: safePage, limit, totalPages: 0 };
        }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db.select({ count: count() })
        .from(issues)
        .where(whereClause);
    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // ✅ Single JOIN query: issues LEFT JOIN triageData
    // Database executes this in one round-trip, no N+1
    const results = await db.select({
        issue: issues,
        triage: triageData,
    })
        .from(issues)
        .leftJoin(triageData, eq(triageData.issueId, issues.id))
        .where(whereClause)
        .orderBy(desc(issues.createdAt))
        .limit(limit)
        .offset(offset);

    // Transform [ {issue, triage}, {issue, triage}, ... ] into [ {issue, triage}, ... ]
    const issuesWithTriage = results.map(row => ({
        ...row.issue,
        triage: row.triage || null,
    }));

    return {
        issues: issuesWithTriage,
        total,
        page: safePage,
        limit,
        totalPages,
    };
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
