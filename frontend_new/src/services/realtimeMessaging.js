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
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        if (this.eventSource) {
          this.disconnect();
        }

        const token = localStorage.getItem("token");
        const url = `${API_BASE}/api/messaging/ws${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
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
      } catch (error) {
        reject(error);
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }
    this.reconnectAttempts++;
    const delay =
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }
}

export const realtimeMessagingClient = new RealtimeMessagingClient();
