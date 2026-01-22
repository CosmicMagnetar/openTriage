/**
 * Tests for the authentication store
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios before importing the store
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  }
}));

import useAuthStore from '../../stores/authStore';
import axios from 'axios';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset the store state
    useAuthStore.setState({
      user: null,
      token: null,
      role: null,
      isLoading: true,
    });
    vi.clearAllMocks();
    localStorage.getItem.mockReturnValue(null);
  });

  describe('Initial State', () => {
    it('should have null user initially', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it('should have null token initially', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
    });

    it('should have null role initially', () => {
      const state = useAuthStore.getState();
      expect(state.role).toBeNull();
    });

    it('should be loading initially', () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
    });
  });

  describe('setAuth', () => {
    it('should set token and user', () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        role: 'CONTRIBUTOR',
      };
      const mockToken = 'test-token';

      useAuthStore.getState().setAuth(mockToken, mockUser);
      const state = useAuthStore.getState();

      expect(state.token).toBe(mockToken);
      expect(state.user).toEqual(mockUser);
      expect(state.role).toBe('CONTRIBUTOR');
      expect(state.isLoading).toBe(false);
    });

    it('should store token in localStorage', () => {
      const mockUser = { id: '123', username: 'test', role: 'MAINTAINER' };
      useAuthStore.getState().setAuth('my-token', mockUser);

      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'my-token');
    });

    it('should set axios authorization header', () => {
      const mockUser = { id: '123', username: 'test', role: 'MAINTAINER' };
      useAuthStore.getState().setAuth('my-token', mockUser);

      expect(axios.defaults.headers.common['Authorization']).toBe('Bearer my-token');
    });
  });

  describe('loadUser', () => {
    it('should set isLoading to false when no token', async () => {
      localStorage.getItem.mockReturnValue(null);
      
      await useAuthStore.getState().loadUser();
      const state = useAuthStore.getState();

      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should load user when token exists', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        role: 'CONTRIBUTOR',
      };
      
      localStorage.getItem.mockReturnValue('valid-token');
      axios.get.mockResolvedValue({ data: mockUser });

      await useAuthStore.getState().loadUser();
      const state = useAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.role).toBe('CONTRIBUTOR');
      expect(state.isLoading).toBe(false);
    });

    it('should clear auth on API error', async () => {
      localStorage.getItem.mockReturnValue('invalid-token');
      axios.get.mockRejectedValue(new Error('Unauthorized'));

      await useAuthStore.getState().loadUser();
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('logout', () => {
    it('should clear user and token', () => {
      // First set some auth state
      useAuthStore.setState({
        user: { id: '123', username: 'test' },
        token: 'some-token',
        role: 'MAINTAINER',
        isLoading: false,
      });

      useAuthStore.getState().logout();
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.role).toBeNull();
    });

    it('should remove token from localStorage', () => {
      useAuthStore.getState().logout();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });

    it('should remove axios authorization header', () => {
      axios.defaults.headers.common['Authorization'] = 'Bearer test';
      useAuthStore.getState().logout();
      expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('mockLogin', () => {
    it('should set mock maintainer user', () => {
      useAuthStore.getState().mockLogin('MAINTAINER');
      const state = useAuthStore.getState();

      expect(state.user).not.toBeNull();
      expect(state.role).toBe('MAINTAINER');
      expect(state.user.username).toBe('maintainer-demo');
    });

    it('should set mock contributor user', () => {
      useAuthStore.getState().mockLogin('CONTRIBUTOR');
      const state = useAuthStore.getState();

      expect(state.user).not.toBeNull();
      expect(state.role).toBe('CONTRIBUTOR');
      expect(state.user.username).toBe('contributor-demo');
    });
  });
});
