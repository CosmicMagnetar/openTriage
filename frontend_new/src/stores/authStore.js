import { BACKEND_URL } from '../lib/config';
import { create } from "zustand";
import axios from "axios";
import { clearQueryCache, setQueryScope } from "../lib/query";

const API = `${BACKEND_URL}/api`;
const USER_KEY = "ot_user";

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

// The workspace (CONTRIBUTOR / MAINTAINER) last chosen on this device, per account.
const WS_KEY = "ot:workspace";

export function readChosenWorkspace(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(WS_KEY) || "null");
    return v && v.userId === userId && (v.role === "MAINTAINER" || v.role === "CONTRIBUTOR") ? v.role : null;
  } catch {
    return null;
  }
}

function writeChosenWorkspace(userId, role) {
  try {
    if (userId) localStorage.setItem(WS_KEY, JSON.stringify({ userId, role }));
  } catch {
    /* ignore */
  }
}

// Flag to prevent re-auth during logout
let isLoggingOut = false;

// Circuit breaker: prevent concurrent loadUser() calls
let loadUserInProgress = false;

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  role: null,
  isLoading: true,
  isLoggingOut: false,

  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    set({
      token,
      user,
      role: user?.role,
      isLoading: false,
      isLoggingOut: false,
    });
  },

  loadUser: async () => {
    // Circuit breaker: prevent concurrent calls
    if (loadUserInProgress) {
      console.log('[AuthStore] loadUser already in progress, skipping duplicate call');
      return;
    }

    // Prevent loading user during logout
    if (isLoggingOut || get().isLoggingOut) {
      set({ isLoading: false });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      set({ isLoading: false });
      return;
    }

    // Set lock before async operations
    loadUserInProgress = true;
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Render immediately with the last known user; verify in the background.
    const cachedUser = readCachedUser();
    if (cachedUser) {
      setQueryScope(cachedUser.id);
      set({ token, user: cachedUser, role: cachedUser.role, isLoading: false });
    }

    try {
      const response = await axios.get(`${API}/auth/me`);
      setQueryScope(response.data.id);
      let me = response.data;
      // The workspace you picked on this device wins. If something else changed the
      // shared account row (another browser, another deployment), switch it back once.
      const chosen = readChosenWorkspace(me.id);
      if (chosen && chosen !== me.role) {
        try {
          const r = await axios.post(`${API}/auth/select-role`, { role: chosen });
          localStorage.setItem("token", r.data.token);
          axios.defaults.headers.common["Authorization"] = `Bearer ${r.data.token}`;
          me = { ...me, role: r.data.role };
          set({ token: r.data.token });
        } catch {
          /* keep the server's value if re-applying fails */
        }
      }
      writeCachedUser(me);
      set({
        token: get().token ?? token,
        user: me,
        role: me.role,
        isLoading: false,
      });
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        // Token is invalid or expired: sign out.
        localStorage.removeItem("token");
        writeCachedUser(null);
        clearQueryCache();
        delete axios.defaults.headers.common["Authorization"];
        set({ token: null, user: null, role: null, isLoading: false });
      } else if (!cachedUser) {
        // Network error / server hiccup with nothing cached: keep the token so a reload can recover.
        console.error("[AuthStore] Could not load user:", error?.message);
        set({ user: null, role: null, isLoading: false });
      }
      // With a cached user, stay signed in and keep working from cache.
    } finally {
      // Always reset lock, even on error
      loadUserInProgress = false;
    }
  },

  logout: () => {
    // Set flag to prevent re-auth
    isLoggingOut = true;

    // Clear all auth data synchronously
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];

    // Clear all localStorage items that might trigger re-auth
    localStorage.removeItem("ably-auth");
    localStorage.removeItem("realtimeToken");
    writeCachedUser(null);
    clearQueryCache();

    // Update state with isLoggingOut flag
    set({
      token: null,
      user: null,
      role: null,
      isLoading: false,
      isLoggingOut: true,
    });

    // Clean up any cached data
    try {
      // Clear session storage
      sessionStorage.clear();
    } catch (e) {
      console.debug("Cleanup during logout:", e);
    }

    // Force redirect to landing page (using window.location to ensure full cleanup)
    // This ensures no React Router state persists
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
      return; // Don't reset flag since we're navigating away
    }

    // Reset logging out flag after a brief delay to allow navigation
    setTimeout(() => {
      isLoggingOut = false;
      set({ isLoggingOut: false });
    }, 200);
  },

  // Check if currently logging out (for protected routes)
  getIsLoggingOut: () => isLoggingOut || get().isLoggingOut,

  updateRole: async (newRole) => {
    try {
      const response = await axios.post(`${API}/auth/select-role`, {
        role: newRole,
      });
      const { token, role } = response.data;

      // Store the new token with the updated role
      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      set((state) => {
        const user = { ...state.user, role };
        writeCachedUser(user);
        writeChosenWorkspace(user.id, role);
        return { token, role, user };
      });
      return true;
    } catch (error) {
      console.error("Failed to update role:", error);
      return false;
    }
  },

  // Mock login for testing
  mockLogin: (role = "MAINTAINER") => {
    const mockUser = {
      id: "1",
      username: role === "MAINTAINER" ? "maintainer-demo" : "contributor-demo",
      avatarUrl: "https://github.com/ghost.png",
      role: role,
      githubId: 12345,
    };
    set({ user: mockUser, role: role, isLoading: false, token: "mock-token" });
  },
}));

export default useAuthStore;
