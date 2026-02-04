/**
 * useRealtimeMessages Hook
 *
 * Provides real-time message updates with automatic UI synchronization.
 * Works with the existing SSE-based real-time messaging service.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { realtimeMessagingClient } from "../services/realtimeMessaging";
import { messagingApi } from "../services/api";

/**
 * Hook for real-time messaging with automatic UI updates
 *
 * @param {Object} options Configuration options
 * @param {string} options.otherUserId - The ID of the other user in the conversation (optional)
 * @param {boolean} options.enabled - Whether to enable real-time updates (default: true)
 * @param {Function} options.onNewMessage - Callback when a new message is received
 * @param {Function} options.onMessageEdited - Callback when a message is edited
 * @param {Function} options.onMessageDeleted - Callback when a message is deleted
 */
export function useRealtimeMessages({
  otherUserId = null,
  enabled = true,
  onNewMessage = null,
  onMessageEdited = null,
  onMessageDeleted = null,
} = {}) {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const lastMessageIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Connect to real-time messaging service
  useEffect(() => {
    if (!enabled) return;

    const connectToRealtime = async () => {
      try {
        await realtimeMessagingClient.connect();
        setIsConnected(realtimeMessagingClient.getIsConnected());
        setConnectionError(null);
      } catch (error) {
        console.error("Failed to connect to real-time messaging:", error);
        setConnectionError(error.message);
        setIsConnected(false);
      }
    };

    connectToRealtime();

    return () => {
      // Don't disconnect the global client, just unsubscribe
    };
  }, [enabled]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = realtimeMessagingClient.subscribe({
      onMessageReceived: (message) => {
        // Filter by conversation if otherUserId is set
        if (
          otherUserId &&
          message.sender_id !== otherUserId &&
          message.receiver_id !== otherUserId
        ) {
          return;
        }

        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });

        // Update last message ID
        lastMessageIdRef.current = message.id;

        // Update unread count
        if (message.receiver_id) {
          setUnreadCount((prev) => prev + 1);
        }

        // Update conversations list
        updateConversationWithMessage(message);

        // Call custom callback
        if (onNewMessage) {
          onNewMessage(message);
        }
      },

      onMessageSent: (message) => {
        // Add sent message to the list
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });

        updateConversationWithMessage(message);
      },

      onMessageEdited: (message) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? { ...m, content: message.content, edited_at: message.edited_at }
              : m,
          ),
        );

        if (onMessageEdited) {
          onMessageEdited(message);
        }
      },

      onMessageDeleted: (messageId) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

        if (onMessageDeleted) {
          onMessageDeleted(messageId);
        }
      },

      onMessageRead: (messageId) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, read: true } : m)),
        );
      },

      onConnectionOpen: () => {
        setIsConnected(true);
        setConnectionError(null);
        // Clear polling interval when connected
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      },

      onConnectionClose: () => {
        setIsConnected(false);
        // Start polling fallback
        startPollingFallback();
      },

      onAuthFailed: () => {
        setIsConnected(false);
        setConnectionError("Authentication failed");
      },

      onMaxReconnectReached: () => {
        setConnectionError("Connection lost. Using polling.");
        startPollingFallback();
      },
    });

    return () => {
      unsubscribe();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [enabled, otherUserId, onNewMessage, onMessageEdited, onMessageDeleted]);

  // Update conversation list with new message
  const updateConversationWithMessage = useCallback((message) => {
    setConversations((prev) => {
      const otherUser = message.sender_id || message.receiver_id;
      const existingIndex = prev.findIndex((c) => c.user_id === otherUser);

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          last_message: message.content,
          last_message_at: message.created_at,
          unread_count: (updated[existingIndex].unread_count || 0) + 1,
        };
        // Sort by most recent
        updated.sort(
          (a, b) =>
            new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0),
        );
        return updated;
      }

      return prev;
    });
  }, []);

  // Polling fallback when real-time is not available
  const startPollingFallback = useCallback(() => {
    if (pollIntervalRef.current || !otherUserId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const newMessages = await messagingApi.pollMessages(
          otherUserId,
          lastMessageIdRef.current,
        );
        if (newMessages && newMessages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const uniqueNew = newMessages.filter((m) => !existingIds.has(m.id));
            if (uniqueNew.length > 0) {
              lastMessageIdRef.current = uniqueNew[uniqueNew.length - 1].id;
              return [...prev, ...uniqueNew];
            }
            return prev;
          });
        }
      } catch (error) {
        console.debug("Polling error:", error);
      }
    }, 3000);
  }, [otherUserId]);

  // Load initial messages for a conversation
  const loadMessages = useCallback(async (userId) => {
    try {
      const data = await messagingApi.getChatHistory(userId);
      setMessages(data.messages || []);
      if (data.messages?.length > 0) {
        lastMessageIdRef.current = data.messages[data.messages.length - 1].id;
      }
      return data.messages || [];
    } catch (error) {
      console.error("Failed to load messages:", error);
      return [];
    }
  }, []);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const data = await messagingApi.getConversations();
      const sortedConversations = (data.conversations || []).sort(
        (a, b) =>
          new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0),
      );
      setConversations(sortedConversations);
      return sortedConversations;
    } catch (error) {
      console.error("Failed to load conversations:", error);
      return [];
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(
    async (receiverId, content) => {
      try {
        const response = await messagingApi.sendMessage(receiverId, content);
        // Message will be added via real-time or optimistically here
        if (!isConnected) {
          setMessages((prev) => [...prev, response]);
        }
        return response;
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      }
    },
    [isConnected],
  );

  // Mark messages as read
  const markAsRead = useCallback(async (userId) => {
    try {
      await messagingApi.markRead(userId);
      setMessages((prev) =>
        prev.map((m) => (m.sender_id === userId ? { ...m, read: true } : m)),
      );
      // Update conversations unread count
      setConversations((prev) =>
        prev.map((c) => (c.user_id === userId ? { ...c, unread_count: 0 } : c)),
      );
    } catch (error) {
      console.debug("Failed to mark as read:", error);
    }
  }, []);

  // Get total unread count
  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/messaging/unread-count`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.debug("Failed to get unread count:", error);
    }
  }, []);

  return {
    // State
    messages,
    conversations,
    unreadCount,
    isConnected,
    connectionError,

    // Actions
    loadMessages,
    loadConversations,
    sendMessage,
    markAsRead,
    refreshUnreadCount,

    // Direct state setters for optimistic updates
    setMessages,
    setConversations,
  };
}

export default useRealtimeMessages;
