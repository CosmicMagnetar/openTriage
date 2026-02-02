/**
 * Real-time Messaging Client Service
 * Uses Server-Sent Events (SSE) for instant message delivery
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

class RealtimeMessagingClient {
  constructor() {
    this.eventSource = null;
    this.listeners = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3; // Reduced to avoid spam
    this.reconnectDelay = 5000;
    this.authFailed = false; // Track auth failures
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Don't retry if auth has failed
        if (this.authFailed) {
          console.log("Skipping reconnect - authentication failed previously");
          resolve(); // Resolve without connecting
          return;
        }

        if (this.eventSource) {
          this.disconnect();
        }

        const token = localStorage.getItem("token");

        // Don't try to connect without a token
        if (!token) {
          console.log("No auth token available for real-time messaging");
          resolve(); // Resolve without connecting
          return;
        }

        const url = `${API_BASE}/api/messaging/ws?token=${encodeURIComponent(token)}`;

        // Use fetch first to check auth, then establish SSE
        fetch(url, { method: "HEAD" })
          .then((res) => {
            if (res.status === 401) {
              console.log(
                "Real-time messaging auth failed - will use polling instead",
              );
              this.authFailed = true;
              this.notifyListeners("onAuthFailed");
              resolve();
              return;
            }

            this.eventSource = new EventSource(url);

            this.eventSource.onopen = () => {
              this.isConnected = true;
              this.reconnectAttempts = 0;
              this.authFailed = false;
              console.log("Real-time messaging connected");
              this.notifyListeners("onConnectionOpen");
              resolve();
            };

            this.eventSource.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
              } catch (error) {
                console.error("Error parsing SSE message:", error);
              }
            };

            this.eventSource.onerror = () => {
              this.isConnected = false;
              if (this.eventSource?.readyState === EventSource.CLOSED) {
                this.attemptReconnect();
              }
              this.notifyListeners("onConnectionClose");
            };
          })
          .catch((err) => {
            console.log("Real-time messaging unavailable:", err.message);
            resolve(); // Still resolve, just without real-time
          });
      } catch (error) {
        console.log("Real-time messaging error:", error.message);
        resolve(); // Don't reject, just work without real-time
      }
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
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
        console.log("SSE connected:", event.userId);
        break;
    }
  }

  notifyListeners(event, data) {
    this.listeners.forEach((listener) => {
      if (typeof listener[event] === "function") {
        try {
          listener[event](data);
        } catch (error) {
          console.error(`Listener error ${event}:`, error);
        }
      }
    });
  }

  attemptReconnect() {
    // Don't reconnect if auth failed
    if (this.authFailed) {
      console.log("Not reconnecting - auth failed");
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnect attempts reached - falling back to polling");
      this.notifyListeners("onMaxReconnectReached");
      return;
    }
    this.reconnectAttempts++;
    const delay =
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(
      `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );
    setTimeout(() => this.connect().catch(() => {}), delay);
  }

  // Reset auth state (call this after login/token refresh)
  resetAuthState() {
    this.authFailed = false;
    this.reconnectAttempts = 0;
  }
}

export const realtimeMessagingClient = new RealtimeMessagingClient();
