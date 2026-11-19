/**
 * Use-case services: compose GitHub fetchers + the pure coordination engine.
 * Routes stay thin; everything here works without AI.
 */
import type { Octokit } from "@octokit/rest";
import { TTLCache } from "@/lib/cache";
import {
    activeAreas, assessPickup, computeAvailability, computeResponsiveness, detectStack, extractCodeRefs,
    extractSetupCommands, findSimilar, isMaintainer, issueNextActions, isOnMe, keywords, newcomerLabels,
    ownersFor, packageScripts, parseCodeowners, prNextActions, rankActions, responseThresholdDays, summarizeTree,
    type IssueItem, type NextAction, type Responsiveness,
} from "@/lib/coordination";
import {
    fetchIssue, fetchRecentMergedFiles, fetchResponsivenessSamples, fetchViewerPermissions, searchIssues, searchPRs,
} from "./graphql";

const cache = new TTLCache<unknown>(5 * 60 * 1000);
const HOUR = 60 * 60 * 1000;

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = cache.get(key) as T | undefined;
    if (hit !== undefined) return hit;
    const value = await fn();
    cache.set(key, value, ttlMs);
    return value;
}

/** Drop cached views of a repo (called from the webhook). */
export function invalidateRepo(owner: string, repo: string) {
    const r = `${owner}/${repo}`.toLowerCase();
    for (const prefix of ["lens:", "resp:", "files:", "issue:", "na:"]) cache.invalidatePrefix(`${prefix}${r}`);
}

// ---------------------------------------------------------------------------
// Repo files
// ---------------------------------------------------------------------------

async function getText(octokit: Octokit, owner: string, repo: string, path: string): Promise<string | null> {
    try {
        const res = await octokit.repos.getContent({ owner, repo, path, mediaType: { format: "raw" } });
        return typeof res.data === "string" ? res.data : null;
    } catch {
        return null;
    }
}

async function firstText(octokit: Octokit, owner: string, repo: string, paths: string[]) {
    for (const p of paths) {
        const t = await getText(octokit, owner, repo, p);
        if (t) return { path: p, text: t };
    }
    return null;
}

async function getTree(octokit: Octokit, owner: string, repo: string, branch: string): Promise<string[]> {
    try {
        const res = await octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: "1" });
        return res.data.tree.filter((t) => t.type === "blob" && t.path).map((t) => t.path!);
    } catch {
        return [];
    }
}

export async function getResponsiveness(octokit: Octokit, owner: string, repo: string): Promise<Responsiveness> {
    return cached(`resp:${owner}/${repo}`.toLowerCase(), 6 * HOUR, async () =>
        computeResponsiveness(await fetchResponsivenessSamples(octokit, owner, repo))
    );
}

// ---------------------------------------------------------------------------
// Understanding: Repo Lens
// ---------------------------------------------------------------------------

export async function buildRepoLens(octokit: Octokit, owner: string, repo: string) {
    return cached(`lens:${owner}/${repo}`.toLowerCase(), HOUR, async () => {
        const { data: meta } = await octokit.repos.get({ owner, repo });
        const branch = meta.default_branch;
        const [paths, readme, contributing, codeowners, pkg, recent, responsiveness, newcomerCount] = await Promise.all([
            getTree(octokit, owner, repo, branch),
            firstText(octokit, owner, repo, ["README.md", "readme.md", "README.rst", "README"]),
            firstText(octokit, owner, repo, ["CONTRIBUTING.md", ".github/CONTRIBUTING.md", "docs/CONTRIBUTING.md", "DEVELOPMENT.md"]),
            firstText(octokit, owner, repo, [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]),
            getText(octokit, owner, repo, "package.json"),
            fetchRecentMergedFiles(octokit, owner, repo, 20).catch(() => []),
            getResponsiveness(octokit, owner, repo).catch(() => null),
            octokit.search
                .issuesAndPullRequests({ q: `repo:${owner}/${repo} is:issue is:open no:assignee label:"good first issue"`, per_page: 1 })
                .then((r) => r.data.total_count)
                .catch(() => null),
        ]);

        const codeownerRules = codeowners ? parseCodeowners(codeowners.text) : [];
        const recentFiles = recent.flatMap((p) => p.files);

        // Who has recently merged work per area — people to ask (bots excluded).
        const areaPeople = new Map<string, Set<string>>();
        for (const p of recent.filter((r) => !r.isBot)) {
            for (const a of activeAreas(p.files, 2, 3)) {
                if (!areaPeople.has(a.area)) areaPeople.set(a.area, new Set());
                areaPeople.get(a.area)!.add(p.author);
            }
        }

        return {
            repo: { fullName: meta.full_name, description: meta.description, url: meta.html_url, defaultBranch: branch,
                stars: meta.stargazers_count, openIssues: meta.open_issues_count, license: meta.license?.spdx_id ?? null,
                archived: meta.archived, pushedAt: meta.pushed_at, topics: meta.topics ?? [] },
            stack: detectStack(paths.filter((p) => p.split("/").length <= 2)),
            layout: summarizeTree(paths),
            fileCount: paths.length,
            setup: [
                ...(contributing ? extractSetupCommands(contributing.text).map((b) => ({ ...b, source: contributing.path })) : []),
                ...(readme ? extractSetupCommands(readme.text).map((b) => ({ ...b, source: readme.path })) : []),
            ].slice(0, 6),
            scripts: pkg ? packageScripts(pkg) : {},
            docs: {
                readme: readme?.path ?? null,
                contributing: contributing?.path ?? null,
                codeOfConduct: paths.find((p) => /code_of_conduct/i.test(p)) ?? null,
                issueTemplates: paths.filter((p) => p.startsWith(".github/ISSUE_TEMPLATE/")).length,
                prTemplate: paths.find((p) => /pull_request_template/i.test(p)) ?? null,
                ci: paths.filter((p) => p.startsWith(".github/workflows/")),
            },
            codeowners: codeownerRules.slice(0, 30),
            activeAreas: activeAreas(recentFiles).map((a) => ({ ...a, people: [...(areaPeople.get(a.area) ?? [])].slice(0, 4) })),
            responsiveness,
            newcomerIssuesOpen: newcomerCount,
            warnings: [
                ...(meta.archived ? ["Repository is archived: contributions won't be accepted."] : []),
                ...(!contributing ? ["No CONTRIBUTING guide — ask maintainers about conventions before large changes."] : []),
                ...(responsiveness?.level === "unresponsive" ? [responsiveness.summary] : []),
            ],
        };
    });
}

// ---------------------------------------------------------------------------
// Discovery + Understanding: one issue
// ---------------------------------------------------------------------------

export async function buildIssueView(octokit: Octokit, owner: string, repo: string, number: number, viewer: string) {
    const issue = await fetchIssue(octokit, owner, repo, number);
    if (!issue) return null;

    const [responsiveness, related] = await Promise.all([
        getResponsiveness(octokit, owner, repo).catch(() => null),
        findRelated(octokit, issue),
    ]);
    const availability = computeAvailability(issue);
    const pickup = assessPickup(issue, availability, responsiveness, {
        forNewcomer: !issue.comments.some((c) => c.author.login.toLowerCase() === viewer.toLowerCase() && isMaintainer(c.author)),
    });
    const actions = issueNextActions(issue, {
        responseDays: responsiveness ? responseThresholdDays(responsiveness) : undefined,
    });
    const myClaim = availability.claims.find((c) => c.login.toLowerCase() === viewer.toLowerCase()) ?? null;

    return {
        issue: {
            owner, repo, number, title: issue.title, url: issue.url, state: issue.state, labels: issue.labels,
            author: issue.author, createdAt: issue.createdAt, updatedAt: issue.updatedAt, comments: issue.comments.length,
        },
        availability,
        pickup,
        responsiveness,
        related,
        actions,
        mine: {
            claimed: Boolean(myClaim),
            // Overlap guard: I claimed it but someone else opened a PR.
            overlap: myClaim
                ? availability.openPRs.filter((p) => p.author.toLowerCase() !== viewer.toLowerCase())
                : [],
        },
    };
}

async function findRelated(octokit: Octokit, issue: IssueItem) {
    const terms = keywords(`${issue.title} ${issue.title} ${issue.body.slice(0, 800)}`, 4);
    if (terms.length === 0) return { possibleDuplicates: [], related: [] };
    const q = `repo:${issue.owner}/${issue.repo} ${terms.join(" ")}`;
    const candidates = await searchIssues(octokit, `${q} in:title,body`, 20).catch(() => [] as IssueItem[]);
    const matches = findSimilar(
        { id: issue.number, title: issue.title, body: issue.body },
        candidates.map((c) => ({ id: c.number, title: c.title, body: c.body, state: c.state, url: c.url })),
        { threshold: 0.2, limit: 8 }
    );
    const shape = (m: (typeof matches)[number]) => ({
        number: m.item.id, title: m.item.title, url: m.item.url, state: m.item.state, score: m.score, sharedTerms: m.sharedTerms,
    });
    return {
        possibleDuplicates: matches.filter((m) => m.score >= 0.45).map(shape),
        related: matches.filter((m) => m.score < 0.45).map(shape),
    };
}

/** Everything a contributor needs to start on an issue — no AI required. */
export async function buildContextPack(octokit: Octokit, owner: string, repo: string, number: number) {
    const issue = await fetchIssue(octokit, owner, repo, number);
    if (!issue) return null;

    const [lens, related, recent] = await Promise.all([
        buildRepoLens(octokit, owner, repo).catch(() => null),
        findRelated(octokit, issue),
        cached(`files:${owner}/${repo}`.toLowerCase(), HOUR, () => fetchRecentMergedFiles(octokit, owner, repo, 30)).catch(() => []),
    ]);

    const text = [issue.title, issue.body, ...issue.comments.map((c) => c.body)].join("\n");
    const refs = extractCodeRefs(text);
    const { data: meta } = await octokit.repos.get({ owner, repo });
    const tree = await cached(`tree:${owner}/${repo}`.toLowerCase(), HOUR, () => getTree(octokit, owner, repo, meta.default_branch));
    const treeSet = new Set(tree);

    // Mentioned paths that really exist, plus files whose name matches a mentioned path's basename.
    const files = new Set<string>();
    for (const p of refs.paths) {
        if (treeSet.has(p)) files.add(p);
        else {
            const base = p.split("/").pop()!;
            tree.filter((t) => t.endsWith(`/${base}`) || t === base).slice(0, 3).forEach((t) => files.add(t));
        }
    }
    // Symbols (`parseConfig`) → GitHub code search, capped (search API is rate limited).
    for (const sym of refs.symbols.slice(0, 2)) {
        try {
            const res = await octokit.search.code({ q: `${sym} repo:${owner}/${repo}`, per_page: 3 });
            res.data.items.forEach((i) => files.add(i.path));
        } catch {
            break;
        }
    }

    const codeownerRules = lens?.codeowners ?? [];
    const likelyFiles = [...files].slice(0, 12).map((path) => {
        const touchedBy = recent.filter((p) => p.files.includes(path) && !p.isBot);
        return {
            path,
            url: `https://github.com/${owner}/${repo}/blob/${meta.default_branch}/${path}`,
            owners: ownersFor(path, codeownerRules),
            recentPRs: touchedBy.slice(0, 3).map((p) => ({ number: p.number, title: p.title, url: p.url, author: p.author })),
        };
    });

    const maintainerNotes = issue.comments
        .filter((c) => isMaintainer(c.author) && !c.author.isBot)
        .map((c) => ({ author: c.author.login, at: c.createdAt, url: c.url, excerpt: c.body.slice(0, 400) }));

    return {
        issue: { owner, repo, number, title: issue.title, url: issue.url, labels: issue.labels },
        availability: computeAvailability(issue),
        previousAttempts: issue.linkedPRs.map((p) => ({ ...p })),
        maintainerNotes,
        likelyFiles,
        mentioned: refs,
        related,
        setup: lens ? { stack: lens.stack, setup: lens.setup, scripts: lens.scripts, docs: lens.docs } : null,
        people: {
            maintainersInThread: [...new Set(maintainerNotes.map((m) => m.author))],
            areaExperts: [...new Set(likelyFiles.flatMap((f) => [...f.owners, ...f.recentPRs.map((p) => `@${p.author}`)]))].slice(0, 6),
        },
        checklist: [
            ...(lens?.docs.contributing ? [`Read ${lens.docs.contributing}`] : []),
            ...(issue.linkedPRs.some((p) => p.state === "CLOSED") ? ["Read why earlier PR attempts were closed"] : []),
            ...(computeAvailability(issue).status === "available" ? ["Comment on the issue that you're starting, so others don't duplicate it"] : []),
            ...(likelyFiles.length ? [`Start reading at ${likelyFiles[0].path}`] : ["Ask a maintainer where the relevant code lives"]),
            ...(lens?.docs.prTemplate ? ["Fill in the PR template when you open your PR"] : []),
        ],
    };
}

// ---------------------------------------------------------------------------
// Discovery: find work
// ---------------------------------------------------------------------------

export interface FindWorkQuery {
    language?: string;
    label?: string;
    repo?: string;
    text?: string;
    newcomer?: boolean;
    limit?: number;
    minStars?: number;
}

export async function findWork(octokit: Octokit, q: FindWorkQuery) {
    const parts = ["is:open", "archived:false", "no:assignee", "-linked:pr"];
    if (q.repo) parts.push(`repo:${q.repo}`);
    // Without a repo, skip brand-new/throwaway repos that farm "good first issue" labels.
    else parts.push(`stars:>=${q.minStars ?? 10}`);
    if (q.language) parts.push(`language:${q.language}`);
    if (q.label) parts.push(`label:"${q.label.replace(/"/g, "")}"`);
    else if (q.newcomer !== false) parts.push('label:"good first issue","help wanted"');
    if (q.text) parts.push(q.text.replace(/[^\w\s.-]/g, " "));
    parts.push("sort:updated-desc");

    const issues = await searchIssues(octokit, parts.join(" "), Math.min(q.limit ?? 20, 30));

    // Responsiveness per repo (cached), capped to keep the call cheap.
    const repos = [...new Set(issues.map((i) => `${i.owner}/${i.repo}`))].slice(0, 6);
    const resp = new Map<string, Responsiveness | null>();
    await Promise.all(repos.map(async (r) => {
        const [o, n] = r.split("/");
        resp.set(r, await getResponsiveness(octokit, o, n).catch(() => null));
    }));

    return issues
        .map((issue) => {
            const availability = computeAvailability(issue);
            const responsiveness = resp.get(`${issue.owner}/${issue.repo}`) ?? null;
            const pickup = assessPickup(issue, availability, responsiveness, { forNewcomer: q.newcomer !== false });
            return {
                owner: issue.owner, repo: issue.repo, number: issue.number, title: issue.title, url: issue.url,
                labels: issue.labels, newcomerLabels: newcomerLabels(issue.labels), comments: issue.comments.length,
                createdAt: issue.createdAt, updatedAt: issue.updatedAt,
                availability: { status: availability.status, summary: availability.summary, contested: availability.contested },
                responsiveness: responsiveness ? { level: responsiveness.level, summary: responsiveness.summary } : null,
                pickup,
            };
        })
        .sort((a, b) => b.pickup.score - a.pickup.score);
}

// ---------------------------------------------------------------------------
// Coordination: Today / next actions
// ---------------------------------------------------------------------------

export async function contributorToday(octokit: Octokit, login: string) {
    const [myPRs, reviewRequests, myIssues] = await Promise.all([
        searchPRs(octokit, `is:open author:${login} archived:false sort:updated-desc`, 30),
        searchPRs(octokit, `is:open review-requested:${login} archived:false`, 20),
        searchIssues(octokit, `is:open commenter:${login} archived:false sort:updated-desc`, 30),
    ]);

    const actions: NextAction[] = [];
    for (const pr of myPRs) actions.push(...prNextActions(pr).filter((a) => isOnMe(a, login, false)));
    for (const pr of reviewRequests) {
        actions.push(...prNextActions(pr).filter((a) => isOnMe(a, login, true) && a.waitingOn.kind !== "author"));
    }

    // Issues I claimed: stale claims on me, and overlap (someone else opened a PR).
    const claimed: Array<{ owner: string; repo: string; number: number; title: string; url: string; status: string; overlap: string[] }> = [];
    for (const issue of myIssues) {
        const availability = computeAvailability(issue);
        const mine = availability.claims.find((c) => c.login.toLowerCase() === login.toLowerCase());
        if (!mine) continue;
        const others = availability.openPRs.filter((p) => p.author.toLowerCase() !== login.toLowerCase());
        claimed.push({
            owner: issue.owner, repo: issue.repo, number: issue.number, title: issue.title, url: issue.url,
            status: mine.stale ? "stale" : "active", overlap: others.map((p) => p.url),
        });
        if (others.length > 0) {
            actions.push({
                id: `${issue.owner}/${issue.repo}#${issue.number}:overlap`, type: "duplicate_effort",
                waitingOn: { kind: "user", login }, priority: 1,
                repo: `${issue.owner}/${issue.repo}`, number: issue.number, isPR: false, title: issue.title, url: issue.url,
                reason: `You claimed this, but ${others.map((p) => `@${p.author} (#${p.number})`).join(", ")} opened a PR for it.`,
                suggestion: "Coordinate in the issue before continuing: review their PR, split the work, or step back.",
                evidence: others.map((p) => ({ label: `PR #${p.number} by @${p.author}`, url: p.url, at: p.createdAt })),
                waitingDays: 0,
            });
        } else if (mine.stale) {
            // Same rule as for others, but phrased for the claimant themselves.
            actions.push(...issueNextActions(issue)
                .filter((a) => a.type === "stale_claim" && isOnMe(a, login, false))
                .map((a) => ({
                    ...a,
                    reason: `You claimed this ${a.waitingDays >= 1 ? `${Math.floor(a.waitingDays)} days` : "recently"} ago with no activity since.`,
                    suggestion: "Post a short update if you're still on it, or say you're stepping back so someone else can pick it up.",
                })));
        }
    }

    return { actions: rankActions(dedupe(actions)), myOpenPRs: myPRs.length, claimed };
}

export async function maintainerToday(octokit: Octokit, login: string, repos: Array<{ owner: string; repo: string }>) {
    const perms = await fetchViewerPermissions(octokit, repos);
    const mine = repos.filter((r) => perms.get(`${r.owner}/${r.repo}`.toLowerCase())).slice(0, 8);

    const perRepo = await Promise.all(mine.map(async ({ owner, repo }) => {
        const full = `${owner}/${repo}`;
        const [prs, issues, responsiveness] = await Promise.all([
            searchPRs(octokit, `repo:${full} is:open sort:updated-desc`, 30).catch(() => []),
            searchIssues(octokit, `repo:${full} is:open sort:created-desc`, 40).catch(() => []),
            getResponsiveness(octokit, owner, repo).catch(() => null),
        ]);
        const responseDays = responsiveness ? responseThresholdDays(responsiveness) : undefined;
        const actions: NextAction[] = [];
        for (const pr of prs) actions.push(...prNextActions(pr, { responseDays }).filter((a) => isOnMe(a, login, true)));
        for (const issue of issues) actions.push(...issueNextActions(issue, { responseDays }).filter((a) => a.waitingOn.kind !== "author"));

        // Possible duplicates among recent issues (last 14 days vs the rest).
        const recentCut = Date.now() - 14 * 86_400_000;
        for (const fresh of issues.filter((i) => new Date(i.createdAt).getTime() > recentCut)) {
            const [match] = findSimilar(
                { id: fresh.number, title: fresh.title, body: fresh.body },
                issues.filter((i) => i.number < fresh.number).map((i) => ({ id: i.number, title: i.title, body: i.body, url: i.url })),
                { threshold: 0.45, limit: 1 }
            );
            if (match) {
                actions.push({
                    id: `${full}#${fresh.number}:possible_duplicate`, type: "duplicate_effort",
                    waitingOn: { kind: "maintainers" }, priority: 3, repo: full, number: fresh.number, isPR: false,
                    title: fresh.title, url: fresh.url,
                    reason: `Looks like #${match.item.id} ("${match.item.title}") — shared terms: ${match.sharedTerms.join(", ")}.`,
                    suggestion: "If it's the same problem, link and close one so effort isn't split.",
                    evidence: [{ label: `#${match.item.id}`, url: match.item.url }], waitingDays: 0,
                });
            }
        }

        return {
            repo: full,
            responsiveness,
            openPRs: prs.length,
            openIssuesSampled: issues.length,
            counts: countBy(actions.map((a) => a.type)),
            actions,
        };
    }));

    return {
        actions: rankActions(dedupe(perRepo.flatMap((r) => r.actions))),
        repos: perRepo.map(({ actions: _a, ...rest }) => rest),
        skipped: repos.filter((r) => !perms.get(`${r.owner}/${r.repo}`.toLowerCase())).map((r) => `${r.owner}/${r.repo}`),
    };
}

function dedupe(actions: NextAction[]): NextAction[] {
    const seen = new Map<string, NextAction>();
    for (const a of actions) if (!seen.has(a.id)) seen.set(a.id, a);
    return [...seen.values()];
}

function countBy(xs: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const x of xs) out[x] = (out[x] ?? 0) + 1;
    return out;
}
