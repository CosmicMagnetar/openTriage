/**
 * Ably Client Configuration
 * 
 * Client-side Ably configuration for real-time subscriptions.
 * Uses token-based authentication via backend.
 */

import Ably from 'ably';

// Channel names (must match backend)
export const ABLY_CHANNELS = {
    EVENTS: 'OpenTriage-Events',
    GLOBAL_CHAT: 'OpenTriage-Global-Chat',
};

// Singleton Ably client
let ablyClient = null;

/**
 * Get or create Ably Realtime client
 * Uses token authentication via backend endpoint
 */
export function getAblyClient() {
    if (!ablyClient) {
        ablyClient = new Ably.Realtime({
            authUrl: '/api/auth/ably-token',
            authMethod: 'GET',
        });
    }
    return ablyClient;
}

/**
 * Get the Events channel for issue/PR updates
 */
export function getEventsChannel() {
    return getAblyClient().channels.get(ABLY_CHANNELS.EVENTS);
}

/**
 * Get the Global Chat channel
 */
export function getGlobalChatChannel() {
    return getAblyClient().channels.get(ABLY_CHANNELS.GLOBAL_CHAT);
}

/**
 * Subscribe to all issue events
 * @param {function} callback - Called with event data
 * @returns {function} Unsubscribe function
 */
export function subscribeToIssueEvents(callback) {
    const channel = getEventsChannel();
    
    const events = [
        'issue_created',
        'issue_updated', 
        'issue_deleted',
        'pr_created',
        'pr_updated',
        'pr_deleted',
        'sync_complete',
    ];
    
    events.forEach(event => {
        channel.subscribe(event, (message) => {
            callback({ event, data: message.data });
        });
    });
    
    return () => {
        events.forEach(event => {
            channel.unsubscribe(event);
        });
    };
}

/**
 * Subscribe to global chat messages
 * @param {function} callback - Called with message data
 * @returns {function} Unsubscribe function
 */
export function subscribeToGlobalChat(callback) {
    const channel = getGlobalChatChannel();
    
    channel.subscribe('message', (message) => {
        callback(message.data);
    });
    
    return () => {
        channel.unsubscribe('message');
    };
}

/**
 * Check if Ably is configured and connected
 */
export function isAblyConnected() {
    if (!ablyClient) return false;
    return ablyClient.connection.state === 'connected';
}

/**
 * Get connection state
 */
export function getConnectionState() {
    if (!ablyClient) return 'disconnected';
    return ablyClient.connection.state;
}

/**
 * Subscribe to connection state changes
 * @param {function} callback - Called with new state
 * @returns {function} Unsubscribe function
 */
export function onConnectionStateChange(callback) {
    const client = getAblyClient();
    
    client.connection.on('connected', () => callback('connected'));
    client.connection.on('disconnected', () => callback('disconnected'));
    client.connection.on('failed', () => callback('failed'));
    client.connection.on('suspended', () => callback('suspended'));
    
    return () => {
        client.connection.off();
    };
}
