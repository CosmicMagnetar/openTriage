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
        // Fetch issues (not PRs)
        const issuesResponse = await octokit.search.issuesAndPullRequests({
            q: `author:${username} is:issue`,
            per_page: 100,
            sort: "created",
            order: "desc",
        });

        // Fetch pull requests
        const prsResponse = await octokit.search.issuesAndPullRequests({
            q: `author:${username} is:pr`,
            per_page: 100,
            sort: "created",
            order: "desc",
        });

        return {
            issues: issuesResponse.data.items,
            prs: prsResponse.data.items,
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
