import { create } from "zustand";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  role: null,
  isLoading: true,

  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    set({ token, user, role: user?.role, isLoading: false });
  },

  loadUser: async () => {
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
      set({ token: null, user: null, role: null, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    set({ token: null, user: null, role: null });
  },

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
