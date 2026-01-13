/**
 * useAbly Hook
 * 
 * React hook for Ably real-time subscriptions.
 * Manages connection lifecycle and provides subscription helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getAblyClient,
    subscribeToIssueEvents,
    subscribeToGlobalChat,
    getConnectionState,
    onConnectionStateChange,
} from '@/lib/ably';

/**
 * Hook for subscribing to real-time issue events
 * @param {function} onEvent - Callback for issue events
 */
export function useIssueEvents(onEvent) {
    const [connectionState, setConnectionState] = useState('disconnected');
    const callbackRef = useRef(onEvent);
    
    // Keep callback ref updated
    useEffect(() => {
        callbackRef.current = onEvent;
    }, [onEvent]);
    
    useEffect(() => {
        // Initialize connection state
        setConnectionState(getConnectionState());
        
        // Subscribe to connection state changes
        const unsubscribeConnection = onConnectionStateChange((state) => {
            setConnectionState(state);
        });
        
        // Subscribe to issue events
        const unsubscribeEvents = subscribeToIssueEvents((event) => {
            if (callbackRef.current) {
                callbackRef.current(event);
            }
        });
        
        return () => {
            unsubscribeConnection();
            unsubscribeEvents();
        };
    }, []);
    
    return { connectionState };
}

/**
 * Hook for global chat real-time updates
 * @param {function} onMessage - Callback for new messages
 */
export function useGlobalChat(onMessage) {
    const [connectionState, setConnectionState] = useState('disconnected');
    const callbackRef = useRef(onMessage);
    
    // Keep callback ref updated
    useEffect(() => {
        callbackRef.current = onMessage;
    }, [onMessage]);
    
    useEffect(() => {
        // Initialize connection state
        setConnectionState(getConnectionState());
        
        // Subscribe to connection state changes
        const unsubscribeConnection = onConnectionStateChange((state) => {
            setConnectionState(state);
        });
        
        // Subscribe to chat messages
        const unsubscribeChat = subscribeToGlobalChat((message) => {
            if (callbackRef.current) {
                callbackRef.current(message);
            }
        });
        
        return () => {
            unsubscribeConnection();
            unsubscribeChat();
        };
    }, []);
    
    return { connectionState };
}

/**
 * Hook for Ably connection status only
 */
export function useAblyConnection() {
    const [connectionState, setConnectionState] = useState('disconnected');
    
    useEffect(() => {
        // Initialize connection
        getAblyClient();
        setConnectionState(getConnectionState());
        
        const unsubscribe = onConnectionStateChange((state) => {
            setConnectionState(state);
        });
        
        return unsubscribe;
    }, []);
    
    return {
        connectionState,
        isConnected: connectionState === 'connected',
        isConnecting: connectionState === 'connecting',
    };
}
