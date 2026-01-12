import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for polling chat messages on an issue.
 * Provides real-time feel without WebSockets.
 *
 * @param {string} issueId - The issue to poll messages for
 * @param {object} options - Configuration options
 * @param {number} options.interval - Poll interval in ms (default: 3000)
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 */
export function useChatPolling(issueId, options = {}) {
  const { interval = 3000, enabled = true } = options;
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastMessageId = useRef(null);
  const pollInterval = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!issueId) return;

    const token = localStorage.getItem('token');
    const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    
    try {
      const url = `${API_BASE}/api/issues/${issueId}/messages`;
      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      
      // Update messages if there are new ones
      if (data.messages && data.messages.length > 0) {
        const newLastId = data.messages[data.messages.length - 1]?.id;
        if (newLastId !== lastMessageId.current) {
          setMessages(data.messages);
          lastMessageId.current = newLastId;
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Chat polling error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  // Initial fetch
  useEffect(() => {
    if (issueId && enabled) {
      setLoading(true);
      fetchMessages();
    }
  }, [issueId, enabled, fetchMessages]);

  // Set up polling
  useEffect(() => {
    if (!issueId || !enabled) {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      return;
    }

    pollInterval.current = setInterval(fetchMessages, interval);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [issueId, enabled, interval, fetchMessages]);

  // Function to send a message
  const sendMessage = async (content, messageType = 'text') => {
    const token = localStorage.getItem('token');
    const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

    const response = await fetch(`${API_BASE}/api/issues/${issueId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ content, messageType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    // Immediately fetch to get the new message
    await fetchMessages();

    return response.json();
  };

  // Manual refresh function
  const refresh = () => {
    return fetchMessages();
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    refresh,
  };
}

export default useChatPolling;
