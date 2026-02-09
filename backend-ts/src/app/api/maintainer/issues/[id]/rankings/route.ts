/**
 * Issue Contributor Ranking Route
 *
 * GET /api/maintainer/issues/:id/rankings
 *
 * For a given issue, this endpoint:
 *  1. Fetches all GitHub comments on the issue
 *  2. Groups them by contributor (excluding the maintainer/repo-owner)
 *  3. Sends all comment bodies to the AI engine for batch sentiment analysis
 *  4. Fetches each contributor's top GitHub language via the public API
 *  5. Computes a composite score: sentiment (40%) + engagement (30%) + language relevance (30%)
 *  6. Returns a ranked list of contributors
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGitHubClient, fetchIssueComments } from "@/lib/github-client";
import { db } from "@/db";
import { issues, repositories } from "@/db/schema";
import { eq } from "drizzle-orm";

interface ContributorData {
    username: string;
    avatar: string;
    commentCount: number;
    commentIds: string[];
    commentBodies: string[];
}

interface RankedContributor {
    rank: number;
    username: string;
    avatar: string;
    overallScore: number;
    sentimentScore: number;
    sentimentLabel: string;
    engagementScore: number;
    languageScore: number;
    topLanguage: string | null;
    languages: string[];
    commentCount: number;
    prominentLanguage: string;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!user.githubAccessToken) {
            return NextResponse.json(
                { error: "GitHub access token not found" },
                { status: 401 }
            );
        }

        const { id } = await context.params;

        // 1. Get issue from DB
        const issue = await db
            .select()
            .from(issues)
            .where(eq(issues.id, id))
            .limit(1);

        if (!issue[0]) {
            return NextResponse.json({ error: "Issue not found" }, { status: 404 });
        }

        const issueData = issue[0];
        const { owner, repo, number: issueNumber } = issueData;

        if (!owner || !repo) {
            return NextResponse.json(
                { error: "Invalid issue data — missing repository information" },
                { status: 400 }
            );
        }

        // Also look up the repo's primary language
        const repoRow = await db
            .select()
            .from(repositories)
            .where(eq(repositories.id, issueData.repoId))
            .limit(1);
        const repoLanguage = (repoRow[0] as any)?.language || null;

        // 2. Fetch comments from GitHub
        const octokit = createGitHubClient(user.githubAccessToken);
        const comments = await fetchIssueComments(octokit, owner, repo, issueNumber);

        if (!comments || comments.length === 0) {
            return NextResponse.json({ rankings: [], summary: null });
        }

        // 3. Group by contributor, exclude the repo owner (maintainer)
        const contributorMap: Record<string, ContributorData> = {};

        for (const comment of comments) {
            const login = comment.user?.login;
            if (!login) continue;
            // Exclude the repo owner / maintainer
            if (login.toLowerCase() === owner.toLowerCase()) continue;

            if (!contributorMap[login]) {
                contributorMap[login] = {
                    username: login,
                    avatar: comment.user?.avatar_url || `https://github.com/${login}.png`,
                    commentCount: 0,
                    commentIds: [],
                    commentBodies: [],
                };
            }
            contributorMap[login].commentCount += 1;
            contributorMap[login].commentIds.push(String(comment.id));
            contributorMap[login].commentBodies.push(comment.body || "");
        }

        const contributors = Object.values(contributorMap);

        if (contributors.length === 0) {
            return NextResponse.json({ rankings: [], summary: null });
        }

        // 4. Batch sentiment analysis via AI engine
        const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:7860";
        const aiApiKey = process.env.AI_ENGINE_API_KEY || "default-key";

        // Build batch: one entry per comment
        const sentimentBatch = contributors.flatMap((c) =>
            c.commentIds.map((cid, idx) => ({
                id: cid,
                body: c.commentBodies[idx],
                author: c.username,
            }))
        );

        let sentimentResults: any[] = [];
        let sentimentSummary: any = null;

        try {
            const sentimentRes = await fetch(
                `${aiEngineUrl}/sentiment/analyze-batch`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${aiApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ comments: sentimentBatch }),
                }
            );
            if (sentimentRes.ok) {
                const sentimentData = await sentimentRes.json();
                sentimentResults = sentimentData.results || [];
                sentimentSummary = sentimentData.summary || null;
            }
        } catch (err) {
            console.error("Sentiment analysis failed, proceeding without:", err);
        }

        // Map comment_id -> sentiment result
        const sentimentById: Record<string, any> = {};
        for (const r of sentimentResults) {
            sentimentById[r.comment_id] = r;
        }

        // 5. Fetch each contributor's top GitHub language (public API, rate-limited but fine for small N)
        const languageCache: Record<string, { topLanguage: string | null; languages: string[] }> = {};

        await Promise.all(
            contributors.map(async (c) => {
                try {
                    const reposRes = await fetch(
                        `https://api.github.com/users/${c.username}/repos?per_page=20&sort=pushed`,
                        {
                            headers: {
                                Authorization: `token ${user.githubAccessToken}`,
                                Accept: "application/vnd.github.v3+json",
                            },
                        }
                    );
                    if (reposRes.ok) {
                        const repos: any[] = await reposRes.json();
                        const langCount: Record<string, number> = {};
                        for (const r of repos) {
                            if (r.language) {
                                langCount[r.language] = (langCount[r.language] || 0) + 1;
                            }
                        }
                        const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
                        languageCache[c.username] = {
                            topLanguage: sorted[0]?.[0] || null,
                            languages: sorted.slice(0, 5).map(([l]) => l),
                        };
                    } else {
                        languageCache[c.username] = { topLanguage: null, languages: [] };
                    }
                } catch {
                    languageCache[c.username] = { topLanguage: null, languages: [] };
                }
            })
        );

        // 6. Compute composite scores
        const maxComments = Math.max(...contributors.map((c) => c.commentCount), 1);

        const ranked: RankedContributor[] = contributors.map((c) => {
            // Sentiment score (0-100): average sentiment confidence across this user's comments
            const userSentiments = c.commentIds
                .map((cid) => sentimentById[cid])
                .filter(Boolean);

            let avgSentiment = 50; // neutral fallback
            let sentimentLabel = "NEUTRAL";
            let prominentLanguage = "neutral";

            if (userSentiments.length > 0) {
                const positiveScores = userSentiments.map((s: any) => {
                    // DistilBERT returns POSITIVE/NEGATIVE, we want positive-leaning score
                    if (s.sentiment_label === "POSITIVE") return s.sentiment_score * 100;
                    return (1 - s.sentiment_score) * 100;
                });
                avgSentiment = positiveScores.reduce((a: number, b: number) => a + b, 0) / positiveScores.length;
                sentimentLabel = avgSentiment >= 60 ? "POSITIVE" : avgSentiment >= 40 ? "NEUTRAL" : "NEGATIVE";
                // Most common prominent language from sentiment results
                const langs = userSentiments
                    .map((s: any) => s.prominent_language)
                    .filter(Boolean);
                if (langs.length > 0) {
                    const freq: Record<string, number> = {};
                    langs.forEach((l: string) => (freq[l] = (freq[l] || 0) + 1));
                    prominentLanguage = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
                }
            }

            // Engagement score (0-100): relative comment count
            const engagementScore = Math.min(100, (c.commentCount / maxComments) * 100);

            // Language relevance score (0-100): how well does the contributor's tech stack match the repo?
            let languageScore = 50; // default if we can't determine
            const lc = languageCache[c.username];
            if (lc && repoLanguage) {
                if (lc.topLanguage?.toLowerCase() === repoLanguage.toLowerCase()) {
                    languageScore = 100;
                } else if (lc.languages.some((l) => l.toLowerCase() === repoLanguage.toLowerCase())) {
                    languageScore = 75;
                } else {
                    languageScore = 30;
                }
            }

            // Composite: sentiment 40% + engagement 30% + language 30%
            const overallScore = Math.round(
                avgSentiment * 0.4 + engagementScore * 0.3 + languageScore * 0.3
            );

            return {
                rank: 0,
                username: c.username,
                avatar: c.avatar,
                overallScore,
                sentimentScore: Math.round(avgSentiment),
                sentimentLabel,
                engagementScore: Math.round(engagementScore),
                languageScore: Math.round(languageScore),
                topLanguage: lc?.topLanguage || null,
                languages: lc?.languages || [],
                commentCount: c.commentCount,
                prominentLanguage,
            };
        });

        // Sort descending by overall score
        ranked.sort((a, b) => b.overallScore - a.overallScore);
        ranked.forEach((r, i) => (r.rank = i + 1));

        return NextResponse.json({
            rankings: ranked,
            summary: sentimentSummary,
            repoLanguage,
        });
    } catch (error: any) {
        console.error("GET /api/maintainer/issues/:id/rankings error:", error);
        return NextResponse.json(
            { error: "Failed to compute rankings", message: error.message },
            { status: 500 }
        );
    }
}
