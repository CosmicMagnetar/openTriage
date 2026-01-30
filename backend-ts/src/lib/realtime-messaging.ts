/**
 * Real-time Messaging Service using WebSockets
 * 
 * Manages WebSocket connections for real-time message delivery.
 * Each user can have a WebSocket connection that receives messages in real-time.
 */

interface MessageSubscriber {
    userId: string;
    callback: (message: any) => void;
}

interface ActiveConnection {
    userId: string;
    listeners: Set<(message: any) => void>;
}

class RealtimeMessagingService {
    private activeConnections: Map<string, ActiveConnection> = new Map();
    private messageSubscribers: MessageSubscriber[] = [];

    /**
     * Register a new WebSocket connection for a user
     */
    registerConnection(userId: string, callback: (message: any) => void): () => void {
        if (!this.activeConnections.has(userId)) {
            this.activeConnections.set(userId, {
                userId,
                listeners: new Set(),
            });
        }

        const connection = this.activeConnections.get(userId)!;
        connection.listeners.add(callback);

        // Return unsubscribe function
        return () => {
            connection.listeners.delete(callback);
            if (connection.listeners.size === 0) {
                this.activeConnections.delete(userId);
            }
        };
    }

    /**
     * Broadcast a message to a specific user
     */
    broadcastToUser(userId: string, message: any): void {
        const connection = this.activeConnections.get(userId);
        if (connection) {
            connection.listeners.forEach(callback => {
                try {
                    callback(message);
                } catch (error) {
                    console.error(`Error broadcasting message to user ${userId}:`, error);
                }
            });
        }
    }

    /**
     * Notify both sender and receiver of a new message
     */
    notifyMessageSent(message: {
        id: string;
        sender_id: string;
        receiver_id: string;
        content: string;
        read: boolean;
        timestamp: string;
        edited_at?: string | null;
    }): void {
        // Notify receiver
        this.broadcastToUser(message.receiver_id, {
            type: 'message_received',
            data: message,
        });

        // Notify sender (for UI update confirmation)
        this.broadcastToUser(message.sender_id, {
            type: 'message_sent',
            data: message,
        });
    }

    /**
     * Notify user of message read status update
     */
    notifyMessageRead(messageId: string, senderId: string): void {
        this.broadcastToUser(senderId, {
            type: 'message_read',
            data: { messageId },
        });
    }

    /**
     * Notify user of message edit
     */
    notifyMessageEdited(message: {
        id: string;
        sender_id: string;
        receiver_id: string;
        content: string;
        edited_at: string;
    }): void {
        this.broadcastToUser(message.receiver_id, {
            type: 'message_edited',
            data: message,
        });

        this.broadcastToUser(message.sender_id, {
            type: 'message_edited',
            data: message,
        });
    }

    /**
     * Notify user of message deletion
     */
    notifyMessageDeleted(messageId: string, senderId: string, receiverId: string): void {
        this.broadcastToUser(receiverId, {
            type: 'message_deleted',
            data: { messageId },
        });

        this.broadcastToUser(senderId, {
            type: 'message_deleted',
            data: { messageId },
        });
    }

    /**
     * Get the list of active user IDs
     */
    getActiveUsers(): string[] {
        return Array.from(this.activeConnections.keys());
    }

    /**
     * Check if a user is currently connected
     */
    isUserOnline(userId: string): boolean {
        return this.activeConnections.has(userId);
    }

    /**
     * Get number of active connections for a user
     */
    getConnectionCount(userId: string): number {
        return this.activeConnections.get(userId)?.listeners.size ?? 0;
    }
}

export const realtimeMessaging = new RealtimeMessagingService();
