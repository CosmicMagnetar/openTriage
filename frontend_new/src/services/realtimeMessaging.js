/**
 * Updated Real-time Messaging Client Service
 * Uses Server-Sent Events (SSE) with Exponential Backoff Retry Strategy
 * 
 * FIXES:
 * - 401 Unauthorized race condition with JWT
 * - Implements robust retry with exponential backoff
 * - Waits for auth to be ready before connecting
 */

import { RetryStrategy } from './messaging/retryStrategy.js';

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

class RealtimeMessagingClient {
  constructor() {
    this.eventSource = null;
    this.listeners = [];
    this.isConnected = false;
    this.authFailed = false;
    
    // Initialize retry strategy
    this.retryStrategy = new RetryStrategy({
      baseDelay: 1000,      // Start with 1s
      maxDelay: 30000,      // Cap at 30s
      maxRetries: 5,
      backoffMultiplier: 2,
      jitterPercent: 0.2,
    });
    
    // Queue for messages sent while disconnected
    this.messageQueue = [];
  }

  /**
   * Connect to real-time messaging
   * Now with auth readiness check and retry strategy
   */
  connect(authReadyPromise = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // CRITICAL FIX: Wait for auth to be ready
        if (authReadyPromise) {
          console.log('[RealtimeMessaging] Waiting for auth to be ready...');
          await authReadyPromise;
          console.log('[RealtimeMessaging] Auth ready, proceeding with connection');
        }

        // Don't retry if auth has failed
        if (this.authFailed) {
          console.log('[RealtimeMessaging] Skipping - auth failed previously');
          resolve();
          return;
        }

        if (this.eventSource) {
          this.disconnect();
        }

        const token = localStorage.getItem("token");

        // Don't try to connect without a token
        if (!token) {
          console.log('[RealtimeMessaging] No auth token available');
          resolve();
          return;
        }

        // RENAMED ENDPOINT to avoid adblocker: /api/messaging/ws → /api/realtime/connect
        const url = `${API_BASE}/api/realtime/connect?token=${encodeURIComponent(token)}`;

        console.log('[RealtimeMessaging] Attempting connection...');
        
        // Use fetch first to check auth (with timeout)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const res = await fetch(url, { 
            method: "HEAD",
            signal: controller.signal 
          });
          clearTimeout(timeoutId);

          if (res.status === 401 || res.status === 403) {
            // Auth failed - don't retry, fallback to polling
            console.warn('[RealtimeMessaging] Auth failed (401/403), falling back to polling');
            this.authFailed = true;
            this.notifyListeners("onAuthFailed");
            resolve();
            return;
          }

          if (!res.ok && res.status !== 404) {
            throw new Error(`Connection check failed: ${res.status}`);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          // If abort or network error, attempt retry
          if (fetchError.name === 'AbortError' || !fetchError.response) {
            console.warn('[RealtimeMessaging] Connection check failed, will retry');
            
            if (this.retryStrategy.canRetry()) {
              await this.retryStrategy.retry(() => this.connect(authReadyPromise));
              resolve();
              return;
            } else {
              console.warn('[RealtimeMessaging] Max retries reached, falling back to polling');
              this.notifyListeners("onMaxReconnectReached");
              resolve();
              return;
            }
          }
          
          throw fetchError;
        }

        // Establish SSE connection
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.authFailed = false;
          this.retryStrategy.reset(); // Reset retry counter on success
          
          console.log('[RealtimeMessaging] ✅ Connected successfully');
          this.notifyListeners("onConnectionOpen");
          
          // Flush message queue
          this.flushMessageQueue();
          
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[RealtimeMessaging] Error parsing message:', error);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('[RealtimeMessaging] Connection error:', error);
          this.isConnected = false;
          
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            this.attemptReconnect(authReadyPromise);
          }
          
          this.notifyListeners("onConnectionClose");
        };

      } catch (error) {
        console.error('[RealtimeMessaging] Connection failed:', error);
        
        // Retry on error
        if (this.retryStrategy.canRetry()) {
          await this.retryStrategy.retry(() => this.connect(authReadyPromise));
          resolve();
        } else {
          resolve(); // Don't reject, just work without real-time
        }
      }
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.retryStrategy.cancel(); // Cancel any pending retries
      this.notifyListeners("onConnectionClose");
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getIsConnected() {
    return this.isConnected;
  }

  handleMessage(event) {
    switch (event.type) {
      case "message_received":
        this.notifyListeners("onMessageReceived", event.data);
        break;
      case "message_sent":
        this.notifyListeners("onMessageSent", event.data);
        break;
      case "message_read":
        this.notifyListeners("onMessageRead", event.data?.messageId);
        break;
      case "message_edited":
        this.notifyListeners("onMessageEdited", event.data);
        break;
      case "message_deleted":
        this.notifyListeners("onMessageDeleted", event.data?.messageId);
        break;
      case "connected":
        console.log('[RealtimeMessaging] Server confirmed connection:', event.userId);
        break;
    }
  }

  notifyListeners(event, data) {
    this.listeners.forEach((listener) => {
      if (typeof listener[event] === "function") {
        try {
          listener[event](data);
        } catch (error) {
          console.error(`[RealtimeMessaging] Listener error ${event}:`, error);
        }
      }
    });
  }

  attemptReconnect(authReadyPromise) {
    // Don't reconnect if auth failed
    if (this.authFailed) {
      console.log('[RealtimeMessaging] Not reconnecting - auth failed');
      return;
    }

    if (!this.retryStrategy.canRetry()) {
      console.log('[RealtimeMessaging] Max reconnect attempts reached');
      this.notifyListeners("onMaxReconnectReached");
      return;
    }
    
    const status = this.retryStrategy.getStatus();
    console.log(
      `[RealtimeMessaging] Reconnecting (${status.retryCount}/${status.maxRetries})...`
    );
    
    this.retryStrategy
      .retry(() => this.connect(authReadyPromise))
      .catch((error) => {
        console.error('[RealtimeMessaging] Reconnection failed:', error);
        this.notifyListeners("onMaxReconnectReached");
      });
  }

  /**
   * Reset auth state (call this after login/token refresh)
   */
  resetAuthState() {
    this.authFailed = false;
    this.retryStrategy.reset();
  }

  /**
   * Get retry strategy status (for debugging)
   */
  getRetryStatus() {
    return this.retryStrategy.getStatus();
  }

  /**
   * Queue a message to be sent when connected
   * (For future implementation)
   */
  queueMessage(message) {
    this.messageQueue.push(message);
  }

  /**
   * Flush queued messages
   * (For future implementation)
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      // Send message implementation
      console.log('[RealtimeMessaging] Flushing queued message:', message);
    }
  }
}

export const realtimeMessagingClient = new RealtimeMessagingClient();
