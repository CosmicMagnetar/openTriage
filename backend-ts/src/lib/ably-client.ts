/**
 * Ably Real-time Client
 * 
 * Provides Ably client and helper functions for real-time broadcasting.
 * Uses Ably REST API for server-side publishing.
 */

import Ably from 'ably';
import {
    ABLY_CHANNELS,
    IssueUpdatePayload,
    SyncCompletePayload,
    ChatMessagePayload,
    IssueEventType,
} from '@/lib/types/ably';

// =============================================================================
// Client Singleton
// =============================================================================

let ablyClient: Ably.Rest | null = null;

function getAblyClient(): Ably.Rest {
    if (!ablyClient) {
        const apiKey = process.env.ABLY_API_KEY;
        if (!apiKey) {
            throw new Error('ABLY_API_KEY environment variable is not set');
        }
        ablyClient = new Ably.Rest({ key: apiKey });
    }
    return ablyClient;
}

// =============================================================================
// Channel Helpers
// =============================================================================

function getEventsChannel() {
    return getAblyClient().channels.get(ABLY_CHANNELS.EVENTS);
}

function getGlobalChatChannel() {
    return getAblyClient().channels.get(ABLY_CHANNELS.GLOBAL_CHAT);
}

// =============================================================================
// Issue/PR Event Publishers
// =============================================================================

export async function publishIssueEvent(
    eventType: IssueEventType,
    issue: {
        id: string;
        githubIssueId: number;
        number: number;
        title: string;
        repoName: string;
        owner: string;
        repo: string;
        isPR: boolean;
        state: string;
    }
): Promise<void> {
    const channel = getEventsChannel();
    const payload: IssueUpdatePayload = {
        eventType,
        issueId: issue.id,
        githubIssueId: issue.githubIssueId,
        number: issue.number,
        title: issue.title,
        repoName: issue.repoName,
        owner: issue.owner,
        repo: issue.repo,
        isPR: issue.isPR,
        state: issue.state,
        timestamp: new Date().toISOString(),
    };

    await channel.publish(eventType, payload);
}

export async function publishIssueCreated(issue: Parameters<typeof publishIssueEvent>[1]): Promise<void> {
    await publishIssueEvent(issue.isPR ? 'pr_created' : 'issue_created', issue);
}

export async function publishIssueUpdated(issue: Parameters<typeof publishIssueEvent>[1]): Promise<void> {
    await publishIssueEvent(issue.isPR ? 'pr_updated' : 'issue_updated', issue);
}

export async function publishIssueDeleted(issue: Parameters<typeof publishIssueEvent>[1]): Promise<void> {
    await publishIssueEvent(issue.isPR ? 'pr_deleted' : 'issue_deleted', issue);
}

// =============================================================================
// Sync Event Publisher
// =============================================================================

export async function publishSyncComplete(stats: {
    reposProcessed: number;
    issuesUpdated: number;
    issuesDeleted: number;
}): Promise<void> {
    const channel = getEventsChannel();
    const payload: SyncCompletePayload = {
        eventType: 'sync_complete',
        reposProcessed: stats.reposProcessed,
        issuesUpdated: stats.issuesUpdated,
        issuesDeleted: stats.issuesDeleted,
        timestamp: new Date().toISOString(),
    };

    await channel.publish('sync_complete', payload);
}

// =============================================================================
// Global Chat Publisher
// =============================================================================

export async function publishChatMessage(message: {
    messageId: string;
    senderId: string;
    senderUsername: string;
    senderAvatarUrl?: string;
    content: string;
}): Promise<void> {
    const channel = getGlobalChatChannel();
    const payload: ChatMessagePayload = {
        messageId: message.messageId,
        senderId: message.senderId,
        senderUsername: message.senderUsername,
        senderAvatarUrl: message.senderAvatarUrl,
        content: message.content,
        timestamp: new Date().toISOString(),
    };

    await channel.publish('message', payload);
}

// =============================================================================
// Ably Token Request (for client-side auth)
// =============================================================================

export async function createTokenRequest(clientId: string): Promise<Ably.TokenRequest> {
    const client = getAblyClient();
    return await client.auth.createTokenRequest({
        clientId,
        capability: {
            [ABLY_CHANNELS.EVENTS]: ['subscribe'],
            [ABLY_CHANNELS.GLOBAL_CHAT]: ['subscribe', 'publish'],
        },
    });
}

// =============================================================================
// Health Check
// =============================================================================

export function isAblyConfigured(): boolean {
    return !!process.env.ABLY_API_KEY;
}
