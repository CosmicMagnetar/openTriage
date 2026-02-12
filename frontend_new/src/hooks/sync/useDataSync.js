/**
 * Data Sync Hook
 * 
 * Provides explicit sync functionality that only runs when auth is ready.
 * Prevents infinite sync loops for new users.
 * 
 * Usage:
 *   const { triggerSync, isSyncing, lastSyncTime, error } = useDataSync();
 */

import { useCallback, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import useSyncStore from '@/stores/syncStore';
import axios from 'axios';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export function useDataSync(options = {}) {
  const { autoSync = false } = options;
  const { isAuthReady, isNewUser, token, user } = useAuth();
  const syncStore = useSyncStore();
  
  // Additional circuit breaker using useRef (survives re-renders)
  const isSyncingRef = useRef(false);

  /**
   * Trigger a data sync
   * Guards: Only syncs if auth is ready and user is not new (unless forced)
   */
  const triggerSync = useCallback(async (force = false) => {
    // Guard: Auth must be ready
    if (!isAuthReady) {
      console.log('[DataSync] Skipping sync - auth not ready');
      return { skipped: true, reason: 'auth_not_ready' };
    }

    // Guard: Don't sync for new users (unless forced)
    if (isNewUser && !force) {
      console.log('[DataSync] Skipping sync - new user (use force=true to override)');
      return { skipped: true, reason: 'new_user' };
    }

    // Double-check circuit breaker (ref-based + store-based)
    if (isSyncingRef.current || syncStore.isSyncing) {
      console.log('[DataSync] Sync already in progress');
      return { skipped: true, reason: 'already_syncing' };
    }

    // Set both locks
    isSyncingRef.current = true;

    try {
      syncStore.startSync();

      // Example: Sync user data
      const response = await axios.get(`${API}/sync/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      syncStore.completSync(response.data);
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[DataSync] Sync failed:', error);
      syncStore.failSync(error.message);
      return { success: false, error: error.message };
    } finally {
      // Always reset ref lock
      isSyncingRef.current = false;
    }
  }, [isAuthReady, isNewUser, token, syncStore]);

  /**
   * Force a sync (bypasses new user guard)
   */
  const forceSync = useCallback(() => {
    return triggerSync(true);
  }, [triggerSync]);

  /**
   * Check if sync can run
   */
  const canSync = isAuthReady && !syncStore.isSyncing && !syncStore.isLoggingOut;

  return {
    // Sync actions
    triggerSync,
    forceSync,
    
    // Sync state
    isSyncing: syncStore.isSyncing,
    lastSyncTime: syncStore.lastSyncTime,
    error: syncStore.syncError,
    canSync,
    
    // Guards status
    isAuthReady,
    isNewUser,
  };
}

export default useDataSync;
