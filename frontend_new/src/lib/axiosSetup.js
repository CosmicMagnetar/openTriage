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
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor - handle 401/403 errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.warn("[Axios] Received 401 Unauthorized - clearing token");
        localStorage.removeItem("token");
        // Redirect to login if needed
        window.location.href = "/login";
      } else if (error.response?.status === 403) {
        console.warn("[Axios] Received 403 Forbidden");
      }
      return Promise.reject(error);
    },
  );

  console.log("[Axios] Global interceptors configured");
}
