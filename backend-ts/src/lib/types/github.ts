/**
 * GitHub API Response Types
 * 
 * Strict TypeScript types for GitHub API responses.
 */

// =============================================================================
// Author Association
// =============================================================================

export type AuthorAssociation =
    | 'COLLABORATOR'
    | 'CONTRIBUTOR'
    | 'FIRST_TIMER'
    | 'FIRST_TIME_CONTRIBUTOR'
    | 'MANNEQUIN'
    | 'MEMBER'
    | 'NONE'
    | 'OWNER';

// =============================================================================
// GitHub User
// =============================================================================

export interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
    type: 'User' | 'Bot' | 'Organization';
}

// =============================================================================
// GitHub Label
// =============================================================================

export interface GitHubLabel {
    id: number;
    name: string;
    color: string;
    description?: string;
}

// =============================================================================
// GitHub Issue
// =============================================================================

export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: 'open' | 'closed';
    state_reason?: 'completed' | 'reopened' | 'not_planned' | null;
    author_association: AuthorAssociation;
    user: GitHubUser;
    labels: GitHubLabel[];
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    // Present only for PRs fetched from issues endpoint
    pull_request?: {
        url: string;
        html_url: string;
        diff_url: string;
        patch_url: string;
        merged_at: string | null;
    };
}

// =============================================================================
// GitHub Pull Request
// =============================================================================

export interface GitHubPullRequest extends Omit<GitHubIssue, 'pull_request'> {
    merged: boolean;
    merged_at: string | null;
    merge_commit_sha: string | null;
    draft: boolean;
    head: {
        ref: string;
        sha: string;
    };
    base: {
        ref: string;
        sha: string;
    };
}

// =============================================================================
// GitHub Repository
// =============================================================================

export interface GitHubRepository {
    id: number;
    name: string;
    full_name: string;
    owner: GitHubUser;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    license: {
        key: string;
        name: string;
        spdx_id: string;
    } | null;
    default_branch: string;
    permissions?: {
        admin: boolean;
        maintain: boolean;
        push: boolean;
        pull: boolean;
    };
}

// =============================================================================
// GitHub Search Results
// =============================================================================

export interface GitHubSearchResult<T> {
    total_count: number;
    incomplete_results: boolean;
    items: T[];
}

// =============================================================================
// Mentor Identification Helpers
// =============================================================================

export const MENTOR_ASSOCIATIONS: AuthorAssociation[] = ['OWNER', 'MEMBER', 'COLLABORATOR'];

export function isMentorAssociation(association: AuthorAssociation): boolean {
    return MENTOR_ASSOCIATIONS.includes(association);
}

export const GOOD_FIRST_ISSUE_LABELS = [
    'good first issue',
    'good-first-issue',
    'beginner',
    'beginner-friendly',
    'easy',
    'starter',
    'first-timers-only',
    'help wanted',
];

export function hasGoodFirstIssueLabel(labels: GitHubLabel[]): boolean {
    return labels.some(label =>
        GOOD_FIRST_ISSUE_LABELS.includes(label.name.toLowerCase())
    );
}
