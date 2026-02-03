import { create } from "zustand";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

// Flag to prevent re-auth during logout
let isLoggingOut = false;

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

    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const response = await axios.get(`${API}/auth/me`);
      set({
        token,
        user: response.data,
        role: response.data.role,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem("token");
      delete axios.defaults.headers.common["Authorization"];
      set({ token: null, user: null, role: null, isLoading: false });
    }
  },

  logout: () => {
    // Set flag to prevent re-auth
    isLoggingOut = true;

    // Clear all auth data synchronously
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];

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

      // Disconnect real-time services (if available)
      if (typeof window !== "undefined" && window.realtimeMessagingClient) {
        window.realtimeMessagingClient.disconnect?.();
      }
    } catch (e) {
      console.debug("Cleanup during logout:", e);
    }

    // Reset logging out flag after a brief delay to allow navigation
    setTimeout(() => {
      isLoggingOut = false;
      set({ isLoggingOut: false });
    }, 100);
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

      set((state) => ({
        token,
        role,
        user: { ...state.user, role },
      }));
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
