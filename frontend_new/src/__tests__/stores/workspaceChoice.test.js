import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import useAuthStore, { readChosenWorkspace } from '../../stores/authStore';

vi.mock('axios', () => {
  const ax = { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } };
  return { default: ax };
});

describe('workspace choice survives an external role reset', () => {
  beforeEach(() => {
    const m = new Map();
    global.localStorage = {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      clear: () => m.clear(),
    };
    vi.clearAllMocks();
    localStorage.setItem('token', 'old');
  });

  it('switching remembers the choice for this account on this device', async () => {
    useAuthStore.setState({ user: { id: 'u1', role: 'CONTRIBUTOR' }, role: 'CONTRIBUTOR' });
    axios.post.mockResolvedValueOnce({ data: { token: 't2', role: 'MAINTAINER' } });
    await useAuthStore.getState().updateRole('MAINTAINER');
    expect(readChosenWorkspace('u1')).toBe('MAINTAINER');
    expect(readChosenWorkspace('someone-else')).toBeNull();
  });

  it('re-applies the chosen workspace when the server says otherwise', async () => {
    localStorage.setItem('ot:workspace', JSON.stringify({ userId: 'u1', role: 'MAINTAINER' }));
    axios.get.mockResolvedValueOnce({ data: { id: 'u1', username: 'me', role: 'CONTRIBUTOR' } });
    axios.post.mockResolvedValueOnce({ data: { token: 'fresh', role: 'MAINTAINER' } });
    await useAuthStore.getState().loadUser();
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/select-role'), { role: 'MAINTAINER' });
    expect(useAuthStore.getState().role).toBe('MAINTAINER');
    expect(localStorage.getItem('token')).toBe('fresh');
  });

  it('does nothing extra when server and choice agree', async () => {
    localStorage.setItem('ot:workspace', JSON.stringify({ userId: 'u1', role: 'CONTRIBUTOR' }));
    axios.get.mockResolvedValueOnce({ data: { id: 'u1', username: 'me', role: 'CONTRIBUTOR' } });
    await useAuthStore.getState().loadUser();
    expect(axios.post).not.toHaveBeenCalled();
    expect(useAuthStore.getState().role).toBe('CONTRIBUTOR');
  });
});
