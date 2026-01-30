/**
 * WebSocket API Route for Real-time Messaging
 * 
 * GET /api/messaging/ws
 * Establishes a WebSocket connection for real-time message delivery
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { realtimeMessaging } from '@/lib/realtime-messaging';

// Types for WebSocket handling
interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

// Next.js doesn't natively support WebSockets in the same way as Node.js
// We'll need to use a different approach with API routes and Server-Sent Events (SSE)
// OR we can check if the server is using a custom WebSocket server

// For now, we'll create an SSE endpoint which provides real-time updates
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Setup SSE connection
        const encoder = new TextEncoder();
        let isConnected = true;

        const customReadable = new ReadableStream({
            start(controller) {
                // Send initial connection message
                const message = `data: ${JSON.stringify({
                    type: 'connected',
                    userId: user.id,
                    timestamp: new Date().toISOString(),
                })}\n\n`;

                controller.enqueue(encoder.encode(message));

                // Register this connection with the realtime service
                const unsubscribe = realtimeMessaging.registerConnection(user.id, (event) => {
                    if (isConnected) {
                        const eventMessage = `data: ${JSON.stringify(event)}\n\n`;
                        try {
                            controller.enqueue(encoder.encode(eventMessage));
                        } catch (error) {
                            console.error('Error sending SSE event:', error);
                            isConnected = false;
                            controller.close();
                        }
                    }
                });

                // Cleanup on connection close
                request.signal?.addEventListener('abort', () => {
                    isConnected = false;
                    unsubscribe();
                    controller.close();
                });
            },
        });

        return new Response(customReadable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        console.error('WebSocket connection error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
