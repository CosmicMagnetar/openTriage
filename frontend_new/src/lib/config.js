/** Backend origin. Falls back to the local dev backend when VITE_BACKEND_URL is not set. */
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '');

export const GITHUB_LOGIN_URL = `${BACKEND_URL}/api/auth/github`;
