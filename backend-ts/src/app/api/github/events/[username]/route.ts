/**
 * GitHub Events/Activity Route
 * 
 * GET /api/github/events/[username]
 * Fetches user's recent GitHub events/activity
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

interface GitHubEvent {
    id: string;
    type: string;
    repo: { name: string };
    created_at: string;
    payload: any;
}

interface ActivityItem {
    type: 'commits' | 'pr' | 'issue' | 'repo' | 'review';
    month: string;
    description: string;
    repos?: { name: string; count: number; maxCount?: number }[];
    date?: string;
    link?: string;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await context.params;
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

        // Get user's GitHub token (case-insensitive lookup)
        const user = await db.select()
            .from(users)
            .where(sql`LOWER(${users.username}) = LOWER(${username})`)
            .limit(1);

        const githubToken = user[0]?.githubAccessToken || process.env.GITHUB_TOKEN;

        if (!githubToken) {
            return NextResponse.json({ error: "No GitHub token available" }, { status: 401 });
        }

        // Fetch GitHub events (last 100)
        const response = await fetch(`https://api.github.com/users/${username}/events?per_page=100`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            console.error(`GitHub events API error: ${response.status}`);
            return NextResponse.json({ activities: [], source: 'error' });
        }

        const events: GitHubEvent[] = await response.json();

        // Group events by month and type
        const monthlyActivity: Record<string, {
            commits: Record<string, number>;
            prs: { repo: string; title: string; date: string }[];
            issues: { repo: string; title: string; date: string }[];
            repos: string[];
        }> = {};

        events.forEach(event => {
            const date = new Date(event.created_at);
            if (date.getFullYear() !== year) return;

            const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            if (!monthlyActivity[monthKey]) {
                monthlyActivity[monthKey] = {
                    commits: {},
                    prs: [],
                    issues: [],
                    repos: []
                };
            }

            const month = monthlyActivity[monthKey];

            switch (event.type) {
                case 'PushEvent':
                    const commits = event.payload?.commits?.length || 0;
                    month.commits[event.repo.name] = (month.commits[event.repo.name] || 0) + commits;
                    break;
                case 'PullRequestEvent':
                    if (event.payload?.action === 'opened') {
                        month.prs.push({
                            repo: event.repo.name,
                            title: event.payload.pull_request?.title || 'Pull Request',
                            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        });
                    }
                    break;
                case 'IssuesEvent':
                    if (event.payload?.action === 'opened') {
                        month.issues.push({
                            repo: event.repo.name,
                            title: event.payload.issue?.title || 'Issue',
                            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        });
                    }
                    break;
                case 'CreateEvent':
                    if (event.payload?.ref_type === 'repository') {
                        month.repos.push(event.repo.name);
                    }
                    break;
            }
        });

        // Convert to activity items
        const activities: ActivityItem[] = [];

        Object.entries(monthlyActivity).forEach(([month, data]) => {
            // Commits summary - only include repos with actual commits
            const repoCommits = Object.entries(data.commits).filter(([_, count]) => count > 0);
            if (repoCommits.length > 0) {
                const totalCommits = repoCommits.reduce((sum, [_, count]) => sum + count, 0);
                const maxCount = Math.max(...repoCommits.map(([_, c]) => c));
                activities.push({
                    type: 'commits',
                    month,
                    description: `Created ${totalCommits} commit${totalCommits !== 1 ? 's' : ''} in ${repoCommits.length} repositor${repoCommits.length !== 1 ? 'ies' : 'y'}`,
                    repos: repoCommits.map(([name, count]) => ({ name, count, maxCount }))
                });
            }

            // Repos created
            if (data.repos.length > 0) {
                activities.push({
                    type: 'repo',
                    month,
                    description: `Created ${data.repos.length} repositor${data.repos.length !== 1 ? 'ies' : 'y'}`
                });
            }

            // PRs opened
            data.prs.forEach(pr => {
                activities.push({
                    type: 'pr',
                    month,
                    description: `Opened a pull request in ${pr.repo}`,
                    date: pr.date,
                    link: pr.repo
                });
            });
        });

        return NextResponse.json({
            activities,
            months: Object.keys(monthlyActivity),
            year,
            source: 'github'
        });

    } catch (error) {
        console.error("GET /api/github/events/:username error:", error);
        return NextResponse.json({ activities: [], error: "Failed to fetch events" }, { status: 500 });
    }
}
