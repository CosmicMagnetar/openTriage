/**
 * Vitest setup file
 * Configure test environment and global mocks
 */

import '@testing-library/jest-dom';

// Mock environment variables
process.env.VITE_BACKEND_URL = 'http://localhost:3000';
process.env.VITE_AI_ENGINE_URL = 'http://localhost:7860';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock window.location
delete window.location;
window.location = {
  href: '',
  pathname: '/',
  search: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});
