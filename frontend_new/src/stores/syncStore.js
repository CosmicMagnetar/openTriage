/**
 * Sync Store
 * 
 * Manages data synchronization state separately from auth.
 * Prevents sync loops by explicit state management.
 */

import { create } from 'zustand';

const useSyncStore = create((set, get) => ({
  // Sync state
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  isLoggingOut: false,

  /**
   * Start a sync operation
   */
  startSync: () => {
    set({
      isSyncing: true,
      syncError: null,
    });
  },

  /**
   * Complete a sync operation
   */
  completSync: (data) => {
    set({
      isSyncing: false,
      lastSyncTime: new Date().toISOString(),
      syncError: null,
    });
  },

  /**
   * Mark sync as failed
   */
  failSync: (error) => {
    set({
      isSyncing: false,
      syncError: error,
    });
  },

  /**
   * Reset sync state
   */
  resetSync: () => {
    set({
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
    });
  },

  /**
   * Set logging out flag
   */
  setLoggingOut: (isLoggingOut) => {
    set({ isLoggingOut });
  },

  /**
   * Check if sync can run
   */
  canSync: () => {
    const state = get();
    return !state.isSyncing && !state.isLoggingOut;
  },
}));

export default useSyncStore;
