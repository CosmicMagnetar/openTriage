/**
 * GitHub API Client Helper
 * 
 * Provides functions to interact with GitHub API using Octokit
 */

import { Octokit } from "@octokit/rest";

/**
 * Create an Octokit client with the provided access token
 */
export function createGitHubClient(accessToken: string) {
    return new Octokit({
        auth: accessToken,
    });
}

/**
 * Fetch user's issues and PRs across all repositories
 */
export async function fetchUserContributions(octokit: Octokit, username: string) {
    try {
        // Note: GitHub Search API has a max of 1000 results total
        // We fetch all available results by using pagination
        const allIssues: any[] = [];
        const allPRs: any[] = [];

        // Fetch issues (not PRs) - get more than 100
        for (let page = 1; page <= 2; page++) {
            const issuesResponse = await octokit.search.issuesAndPullRequests({
                q: `author:${username} is:issue`,
                per_page: 100,
                page,
                sort: "created",
                order: "desc",
            });
            allIssues.push(...issuesResponse.data.items);
            if (issuesResponse.data.items.length < 100) break;
        }

        // Fetch pull requests - get more than 100
        for (let page = 1; page <= 2; page++) {
            const prsResponse = await octokit.search.issuesAndPullRequests({
                q: `author:${username} is:pr`,
                per_page: 100,
                page,
                sort: "created",
                order: "desc",
            });
            allPRs.push(...prsResponse.data.items);
            if (prsResponse.data.items.length < 100) break;
        }

        return {
            issues: allIssues,
            prs: allPRs,
        };
    } catch (error) {
        console.error("Error fetching user contributions:", error);
        throw error;
    }
}

/**
 * Fetch comments for a specific issue or pull request
 */
export async function fetchIssueComments(
    octokit: Octokit,
    owner: string,
    repo: string,
    issueNumber: number
) {
    try {
        const response = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber,
            per_page: 100,
        });

        return response.data;
    } catch (error) {
        console.error(`Error fetching comments for ${owner}/${repo}#${issueNumber}:`, error);
        throw error;
    }
}

/**
 * Fetch repository information
 */
export async function fetchRepository(
    octokit: Octokit,
    owner: string,
    repo: string
) {
    try {
        const response = await octokit.repos.get({
            owner,
            repo,
        });

        return response.data;
    } catch (error) {
        console.error(`Error fetching repository ${owner}/${repo}:`, error);
        throw error;
    }
}

/**
 * Fetch user's repositories
 */
export async function fetchUserRepositories(octokit: Octokit, username: string) {
    try {
        const response = await octokit.repos.listForUser({
            username,
            per_page: 100,
            sort: "updated",
        });

        return response.data;
    } catch (error) {
        console.error(`Error fetching repositories for ${username}:`, error);
        throw error;
    }
}

/**
 * Create a comment on an issue or pull request
 */
export async function createIssueComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
) {
    try {
        const response = await octokit.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body,
        });

        return response.data;
    } catch (error) {
        console.error(`Error creating comment on ${owner}/${repo}#${issueNumber}:`, error);
        throw error;
    }
}

/**
 * Add assignee(s) to an issue or pull request
 */
export async function addIssueAssignees(
    octokit: Octokit,
    owner: string,
    repo: string,
    issueNumber: number,
    assignees: string[]
) {
    try {
        const response = await octokit.issues.addAssignees({
            owner,
            repo,
            issue_number: issueNumber,
            assignees,
        });

        return response.data;
    } catch (error) {
        console.error(`Error adding assignees to ${owner}/${repo}#${issueNumber}:`, error);
        throw error;
    }
}

/**
 * Fetch contribution statistics using GitHub GraphQL API
 * More accurate and efficient than REST API for stats
 */
export async function fetchContributionStats(octokit: Octokit, username: string) {
    try {
        const query = `
            query($username: String!) {
                user(login: $username) {
                    contributionsCollection {
                        contributionCalendar {
                            totalContributions
                        }
                        totalIssueContributions
                        totalPullRequestContributions
                        totalPullRequestReviewContributions
                        totalRepositoryContributions
                    }
                    repositories(first: 100, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
                        totalCount
                    }
                    pullRequests(first: 100) {
                        totalCount
                        nodes {
                            state
                            merged
                        }
                    }
                    issues(first: 100) {
                        totalCount
                        nodes {
                            state
                        }
                    }
                }
            }
        `;

        const result: any = await octokit.graphql(query, { username });
        return result;
    } catch (error) {
        console.error(`Error fetching contribution stats for ${username}:`, error);
        throw error;
    }
}

/**
 * Fetch all user repositories with proper pagination
 */
export async function fetchAllUserRepositories(octokit: Octokit, username: string) {
    try {
        const allRepos: any[] = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            const response = await octokit.repos.listForUser({
                username,
                per_page: perPage,
                page,
                sort: "updated",
            });

            allRepos.push(...response.data);

            if (response.data.length < perPage) {
                break; // No more pages
            }

            page++;

            // Safety limit to avoid infinite loops
            if (page > 10) break; // Max 1000 repos
        }

        return allRepos;
    } catch (error) {
        console.error(`Error fetching all repositories for ${username}:`, error);
        throw error;
    }
}
