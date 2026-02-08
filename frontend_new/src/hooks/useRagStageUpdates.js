/**
 * useRagStageUpdates
 *
 * React hook that connects to the backend Socket.io server and listens
 * for `stage_update` events on a given RAG session.
 *
 * Usage:
 *   const { stage, label, progress, isConnected } = useRagStageUpdates(sessionId);
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

/**
 * @param {string|null} sessionId  — The RAG session to listen to.
 *   Pass `null` to keep the socket disconnected.
 */
export default function useRagStageUpdates(sessionId) {
  const [stage, setStage] = useState(null); // 1 | 2 | 3 | -1
  const [label, setLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // Reset state whenever the session changes
  const reset = useCallback(() => {
    setStage(null);
    setLabel("");
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    // Create one Socket.io connection (shared across re-renders via ref)
    const socket = io(BACKEND_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      // Join the room for this RAG session
      socket.emit("join_rag_session", sessionId);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("stage_update", (payload) => {
      // Only handle events for our session (extra guard)
      if (payload.sessionId && payload.sessionId !== sessionId) return;

      setStage(payload.stage);
      setLabel(payload.label ?? "");
      setProgress(payload.progress ?? 0);
    });

    return () => {
      socket.emit("leave_rag_session", sessionId);
      socket.disconnect();
      socketRef.current = null;
      reset();
    };
  }, [sessionId, reset]);

  return { stage, label, progress, isConnected, reset };
}
