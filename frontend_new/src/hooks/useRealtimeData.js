/**
 * useRealtimeData Hook
 *
 * Provides real-time data synchronization with optimistic updates.
 * Works with both WebSocket/SSE and polling fallback.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { realtimeMessagingClient } from "../services/realtimeMessaging";

/**
 * Hook for real-time data with optimistic updates
 *
 * @param {Object} options Configuration options
 * @param {Function} options.fetchData Async function to fetch initial data
 * @param {string} options.eventType Event type to listen for (e.g., 'message_received')
 * @param {Function} options.onEvent Handler for real-time events
 * @param {number} options.pollInterval Polling interval in ms (default: 5000)
 * @param {boolean} options.enablePolling Whether to use polling as fallback (default: true)
 * @param {Array} options.dependencies Dependencies that trigger refetch
 */
export function useRealtimeData({
  fetchData,
  eventType = null,
  onEvent = null,
  pollInterval = 5000,
  enablePolling = true,
  dependencies = [],
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRealtime, setIsRealtime] = useState(false);
  const lastFetchRef = useRef(0);
  const pollTimeoutRef = useRef(null);

  // Fetch data function
  const loadData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const result = await fetchData();
        setData(result);
        setError(null);
        lastFetchRef.current = Date.now();
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [fetchData],
  );

  // Initial load
  useEffect(() => {
    loadData();
  }, [...dependencies]);

  // Real-time subscription
  useEffect(() => {
    if (!eventType) return;

    const unsubscribe = realtimeMessagingClient.subscribe({
      [eventType]: (eventData) => {
        setIsRealtime(true);
        if (onEvent) {
          // Use optimistic update pattern
          const updatedData = onEvent(data, eventData);
          if (updatedData !== undefined) {
            setData(updatedData);
          }
        } else {
          // Default: refresh data
          loadData(false);
        }
      },
      onConnectionOpen: () => {
        setIsRealtime(true);
      },
      onConnectionClose: () => {
        setIsRealtime(false);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [eventType, onEvent, data, loadData]);

  // Polling fallback when real-time is not available
  useEffect(() => {
    if (!enablePolling || isRealtime) {
      if (pollTimeoutRef.current) {
        clearInterval(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }

    pollTimeoutRef.current = setInterval(() => {
      // Only poll if enough time has passed since last fetch
      if (Date.now() - lastFetchRef.current >= pollInterval) {
        loadData(false);
      }
    }, pollInterval);

    return () => {
      if (pollTimeoutRef.current) {
        clearInterval(pollTimeoutRef.current);
      }
    };
  }, [enablePolling, isRealtime, pollInterval, loadData]);

  // Optimistic update function
  const optimisticUpdate = useCallback((updateFn) => {
    setData((prevData) => {
      const newData = updateFn(prevData);
      return newData;
    });
  }, []);

  // Rollback function for failed optimistic updates
  const rollback = useCallback(() => {
    loadData(false);
  }, [loadData]);

  return {
    data,
    setData,
    loading,
    error,
    refetch: loadData,
    isRealtime,
    optimisticUpdate,
    rollback,
  };
}

/**
 * Hook specifically for messaging with optimistic updates
 */
export function useRealtimeMessages(otherUserId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const pendingMessagesRef = useRef(new Map());

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!otherUserId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const API_BASE =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

      const response = await fetch(
        `${API_BASE}/api/messaging/history/${otherUserId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) throw new Error("Failed to load messages");

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Load messages error:", error);
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!otherUserId) return;

    const unsubscribe = realtimeMessagingClient.subscribe({
      onMessageReceived: (message) => {
        if (
          message.sender_id === otherUserId ||
          message.receiver_id === otherUserId
        ) {
          setMessages((prev) => {
            // Remove optimistic message if it exists
            const tempId = pendingMessagesRef.current.get(message.content);
            const filtered = tempId
              ? prev.filter((m) => m.id !== tempId)
              : prev;

            // Avoid duplicates
            if (filtered.some((m) => m.id === message.id)) {
              return filtered;
            }

            return [...filtered, message];
          });
          pendingMessagesRef.current.delete(message.content);
        }
      },
      onMessageEdited: (message) => {
        if (
          message.sender_id === otherUserId ||
          message.receiver_id === otherUserId
        ) {
          setMessages((prev) =>
            prev.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
          );
        }
      },
      onMessageDeleted: (messageId) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      },
      onConnectionOpen: () => setIsRealtime(true),
      onConnectionClose: () => setIsRealtime(false),
    });

    return () => unsubscribe();
  }, [otherUserId]);

  // Optimistic send
  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || !otherUserId) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        content,
        sender_id: "self",
        receiver_id: otherUserId,
        created_at: new Date().toISOString(),
        pending: true,
      };

      // Add optimistic message
      setMessages((prev) => [...prev, optimisticMessage]);
      pendingMessagesRef.current.set(content, tempId);

      setSending(true);
      try {
        const token = localStorage.getItem("token");
        const API_BASE =
          import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

        const response = await fetch(`${API_BASE}/api/messaging/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            receiver_id: otherUserId,
            content,
          }),
        });

        if (!response.ok) throw new Error("Failed to send message");

        const sentMessage = await response.json();

        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...sentMessage, pending: false } : m,
          ),
        );
        pendingMessagesRef.current.delete(content);

        return sentMessage;
      } catch (error) {
        // Remove failed optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        pendingMessagesRef.current.delete(content);
        throw error;
      } finally {
        setSending(false);
      }
    },
    [otherUserId],
  );

  return {
    messages,
    loading,
    sending,
    isRealtime,
    sendMessage,
    refetch: loadMessages,
  };
}

/**
 * Hook for real-time issue/PR updates with Ably
 */
export function useRealtimeIssues(options = {}) {
  const { onIssueUpdate, onPRUpdate, onSyncComplete } = options;
  const [connectionState, setConnectionState] = useState("disconnected");

  useEffect(() => {
    // Dynamic import of Ably hooks to avoid SSR issues
    let cleanup = () => {};

    import("../lib/ably")
      .then(
        ({
          subscribeToIssueEvents,
          getConnectionState,
          onConnectionStateChange,
        }) => {
          setConnectionState(getConnectionState());

          const unsubscribeConnection = onConnectionStateChange((state) => {
            setConnectionState(state);
          });

          const unsubscribeEvents = subscribeToIssueEvents((event) => {
            switch (event.event) {
              case "issue_created":
              case "issue_updated":
              case "issue_deleted":
                onIssueUpdate?.(event);
                break;
              case "pr_created":
              case "pr_updated":
              case "pr_deleted":
                onPRUpdate?.(event);
                break;
              case "sync_complete":
                onSyncComplete?.(event);
                break;
            }
          });

          cleanup = () => {
            unsubscribeConnection();
            unsubscribeEvents();
          };
        },
      )
      .catch(console.error);

    return () => cleanup();
  }, [onIssueUpdate, onPRUpdate, onSyncComplete]);

  return { connectionState, isConnected: connectionState === "connected" };
}

export default useRealtimeData;
