/**
 * Socket.io Helper
 *
 * Provides type-safe access to the Socket.io Server instance that is
 * attached to the custom HTTP server (see /server.js).
 *
 * Usage from any API route:
 *   import { getIO, emitStageUpdate } from "@/lib/socket";
 *   emitStageUpdate(sessionId, { stage: 2, label: "Generating answer" });
 */

import type { Server as SocketIOServer } from "socket.io";

/* ------------------------------------------------------------------ */
/*  Extend globalThis so TypeScript knows about __socketIO             */
/* ------------------------------------------------------------------ */
declare global {
    // eslint-disable-next-line no-var
    var __socketIO: SocketIOServer | undefined;
}

/**
 * Return the Socket.io Server instance, or null when running in an
 * environment where the custom server hasn't been initialised
 * (e.g. during `next build`).
 */
export function getIO(): SocketIOServer | null {
    return globalThis.__socketIO ?? null;
}

/* ------------------------------------------------------------------ */
/*  Stage update helpers                                              */
/* ------------------------------------------------------------------ */

export interface StageUpdatePayload {
    /** Numeric stage (1 = Retrieval, 2 = Generation, 3 = Done, -1 = Error) */
    stage: number;
    /** Human-readable label for the UI */
    label: string;
    /** Optional progress 0-100 */
    progress?: number;
    /** Optional extra metadata */
    meta?: Record<string, unknown>;
}

/**
 * Emit a `stage_update` event to every client in the given RAG session room.
 */
export function emitStageUpdate(
    sessionId: string,
    payload: StageUpdatePayload,
): void {
    const io = getIO();
    if (!io) {
        console.warn("[socket] Cannot emit stage_update — Socket.io not initialised");
        return;
    }
    io.to(`rag:${sessionId}`).emit("stage_update", {
        sessionId,
        timestamp: new Date().toISOString(),
        ...payload,
    });
}

/**
 * Broadcast a `stage_update` to ALL connected clients (useful if the
 * caller doesn't track per-session rooms).
 */
export function broadcastStageUpdate(payload: StageUpdatePayload): void {
    const io = getIO();
    if (!io) return;
    io.emit("stage_update", {
        timestamp: new Date().toISOString(),
        ...payload,
    });
}
