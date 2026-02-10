/**
 * socket-client.ts
 *
 * Lightweight Socket.IO client utility for the frontend.
 * Provides a singleton instance and helpers for the UI components.
 */

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

/**
 * Get or create the Socket.IO client instance.
 * Connects to the server on first call.
 */
export function getIO(): Socket | null {
    if (typeof window === 'undefined') return null;

    if (!socketInstance) {
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        const host = window.location.host;
        const url = `${protocol}//${host}`;

        socketInstance = io(url, {
            path: '/socket.io',
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
            transports: ['websocket', 'polling'],
        });

        socketInstance.on('connect', () => {
            console.log('[Socket.IO] Connected:', socketInstance?.id);
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('[Socket.IO] Disconnected:', reason);
        });

        socketInstance.on('error', (error) => {
            console.error('[Socket.IO] Error:', error);
        });
    }

    return socketInstance;
}

/**
 * Hook: Track agent thoughts in real-time
 */
export function useAgentThoughts(sessionId: string) {
    const [thoughts, setThoughts] = useState<any[]>([]);

    useEffect(() => {
        const socket = getIO();
        if (!socket) return;

        socket.emit('join_agent_session', sessionId);

        const handleThought = (data: any) => {
            if (data.sessionId === sessionId) {
                setThoughts(prev => [...prev, data]);
            }
        };

        socket.on('agent_thought', handleThought);

        return () => {
            socket.off('agent_thought', handleThought);
            socket.emit('leave_agent_session', sessionId);
        };
    }, [sessionId]);

    return thoughts;
}

/**
 * Hook: Track RAG stage updates
 */
export function useRagStageUpdates(sessionId: string) {
    const [stage, setStage] = useState<{
        stage: number;
        label: string;
        progress?: number;
        meta?: Record<string, unknown>;
    } | null>(null);

    useEffect(() => {
        const socket = getIO();
        if (!socket) return;

        socket.emit('join_rag_session', sessionId);

        const handleUpdate = (data: any) => {
            if (data.sessionId === sessionId) {
                setStage({
                    stage: data.stage,
                    label: data.label,
                    progress: data.progress,
                    meta: data.meta,
                });
            }
        };

        socket.on('stage_update', handleUpdate);

        return () => {
            socket.off('stage_update', handleUpdate);
            socket.emit('leave_rag_session', sessionId);
        };
    }, [sessionId]);

    return stage;
}

/**
 * Send a human reply to a guidance request
 */
export function sendHumanGuidance(sessionId: string, reply: string): void {
    const socket = getIO();
    if (socket) {
        socket.emit('human_reply', { sessionId, reply });
    }
}