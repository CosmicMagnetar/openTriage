/**
 * Ably Message Payload Types
 * 
 * Strict TypeScript types for Ably real-time message payloads.
 */

// =============================================================================
// Event Types
// =============================================================================

export type IssueEventType = 'issue_created' | 'issue_updated' | 'issue_deleted' | 'pr_created' | 'pr_updated' | 'pr_deleted';

// =============================================================================
// Channel Names
// =============================================================================

export const ABLY_CHANNELS = {
    EVENTS: 'OpenTriage-Events',
    GLOBAL_CHAT: 'OpenTriage-Global-Chat',
} as const;

export type AblyChannelName = typeof ABLY_CHANNELS[keyof typeof ABLY_CHANNELS];

// =============================================================================
// Issue/PR Update Payloads
// =============================================================================

export interface IssueUpdatePayload {
    eventType: IssueEventType;
    issueId: string;
    githubIssueId: number;
    number: number;
    title: string;
    repoName: string;
    owner: string;
    repo: string;
    isPR: boolean;
    state: string;
    timestamp: string;
}

export interface SyncCompletePayload {
    eventType: 'sync_complete';
    reposProcessed: number;
    issuesUpdated: number;
    issuesDeleted: number;
    timestamp: string;
}

// =============================================================================
// Global Chat Payloads
// =============================================================================

export interface ChatMessagePayload {
    messageId: string;
    senderId: string;
    senderUsername: string;
    senderAvatarUrl?: string;
    content: string;
    timestamp: string;
}

export interface ChatHistoryPayload {
    messages: ChatMessagePayload[];
    hasMore: boolean;
    cursor?: string;
}

// =============================================================================
// Union Types for Channel Messages
// =============================================================================

export type EventsChannelMessage = IssueUpdatePayload | SyncCompletePayload;
export type GlobalChatChannelMessage = ChatMessagePayload;
