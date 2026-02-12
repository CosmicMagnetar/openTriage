/**
 * useAuth Hook
 * 
 * Provides authentication state and utilities with new user detection
 * to prevent premature sync triggers.
 * 
 * Usage:
 *   const { user, token, role, isNewUser, isAuthReady, waitForAuth } = useAuth();
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import useAuthStore from '@/stores/authStore';

const AUTH_READY_DELAY = 500; // ms to wait after token received before marking auth as "ready"
const NEW_USER_INDICATORS = ['!role', '!repositories', 'tokenAge < 60000']; // < 1 minute

export function useAuth() {
  const authStore = useAuthStore();
  const { user, token, role, isLoading, isLoggingOut } = authStore;
  
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const authReadyPromise = useRef(null);
  const authReadyResolve = useRef(null);

  // Create a promise that resolves when auth is ready
  useEffect(() => {
    if (!authReadyPromise.current) {
      authReadyPromise.current = new Promise((resolve) => {
        authReadyResolve.current = resolve;
      });
    }
  }, []);

  // Monitor auth state and determine readiness
  useEffect(() => {
    // Reset if logging out
    if (isLoggingOut) {
      setIsAuthReady(false);
      setIsNewUser(false);
      return;
    }

    // Not ready if still loading
    if (isLoading) {
      setIsAuthReady(false);
      return;
    }

    // Not ready if no token
    if (!token) {
      setIsAuthReady(false);
      setIsNewUser(false);
      return;
    }

    // Delay marking auth as ready to allow state to settle
    const timer = setTimeout(() => {
      // Detect new user
      const tokenTimestamp = localStorage.getItem('tokenTimestamp');
      const tokenAge = tokenTimestamp ? Date.now() - parseInt(tokenTimestamp, 10) : null;
      
      const isNew = (
        !role || // No role selected yet
        tokenAge !== null && tokenAge < 60000 || // Token less than 1 minute old
        !user?.repositories // No repositories synced yet
      );

      setIsNewUser(isNew);
      setIsAuthReady(true);

      // Resolve the auth ready promise
      if (authReadyResolve.current) {
        authReadyResolve.current({ user, token, role, isNewUser: isNew });
      }
    }, AUTH_READY_DELAY);

    return () => clearTimeout(timer);
  }, [token, user, role, isLoading, isLoggingOut]);

  // Save token timestamp when token changes
  useEffect(() => {
    if (token && !localStorage.getItem('tokenTimestamp')) {
      localStorage.setItem('tokenTimestamp', Date.now().toString());
    }
    if (!token) {
      localStorage.removeItem('tokenTimestamp');
    }
  }, [token]);

  /**
   * Returns a promise that resolves when auth is ready
   * Useful for services that need to wait for auth before initializing
   */
  const waitForAuth = useCallback(() => {
    if (isAuthReady) {
      return Promise.resolve({ user, token, role, isNewUser });
    }
    return authReadyPromise.current;
  }, [isAuthReady, user, token, role, isNewUser]);

  /**
   * Mark user as no longer new (call after onboarding complete)
   */
  const completeOnboarding = useCallback(() => {
    setIsNewUser(false);
    // Update token timestamp to make it "old"
    localStorage.setItem('tokenTimestamp', (Date.now() - 120000).toString()); // 2 minutes ago
  }, []);

  return {
    // Auth state
    user,
    token,
    role,
    isLoading,
    isLoggingOut,
    
    // Auth readiness
    isAuthReady,
    isNewUser,
    
    // Utilities
    waitForAuth,
    completeOnboarding,
    
    // Auth actions
    setAuth: authStore.setAuth,
    loadUser: authStore.loadUser,
    logout: authStore.logout,
    updateRole: authStore.updateRole,
  };
}

export default useAuth;
