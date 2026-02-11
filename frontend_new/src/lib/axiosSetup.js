/**
 * Axios Global Interceptor Setup
 * Automatically adds Authorization header to all axios requests
 */

import axios from "axios";

/**
 * Set up global axios interceptor to add Authorization header
 */
export function setupAxiosInterceptors() {
  // Request interceptor - add Authorization header
  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      console.log(
        "[Axios] Request to:",
        config.url,
        "- Token present:",
        !!token,
      );
      if (!token) {
        console.warn("[Axios] ⚠️ WARNING: No token found in localStorage!");
        console.log("[Axios] localStorage keys:", Object.keys(localStorage));
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log("[Axios] ✅ Authorization header added");
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor - handle network errors and 401/403
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // Network error — server unreachable (TypeError: Failed to fetch)
      if (!error.response) {
        const msg =
          error.code === "ECONNABORTED"
            ? "Request timed out. The server may be busy."
            : "Server is waking up… Please retry in a moment.";
        console.error("[Axios] Network error:", error.message);
        // Dynamic import avoids circular dependency with sonner
        import("sonner").then(({ toast }) => toast.error(msg)).catch(() => {});
        return Promise.reject(error);
      }

      if (error.response.status === 401) {
        console.warn("[Axios] Received 401 Unauthorized - clearing token");
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else if (error.response.status === 403) {
        console.warn("[Axios] Received 403 Forbidden");
        console.error("[Axios] Response data:", error.response?.data);
      }
      return Promise.reject(error);
    },
  );

  console.log("[Axios] Global interceptors configured");
}
