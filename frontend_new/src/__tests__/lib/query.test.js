import { renderHook, act, waitFor } from '@testing-library/react';
import { clearQueryCache, fetchQuery, prefetch, useQuery } from '../../lib/query';

describe('query cache', () => {
  beforeEach(() => {
    clearQueryCache();
    localStorage.getItem.mockReturnValue(null);
  });

  it('dedupes concurrent fetches for the same key', async () => {
    const fetcher = vi.fn().mockResolvedValue(1);
    await Promise.all([fetchQuery('a', fetcher), fetchQuery('a', fetcher)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves cached data without refetching while fresh', async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    await fetchQuery('b', fetcher);
    const { result } = renderHook(() => useQuery('b', fetcher, { staleMs: 60_000 }));
    expect(result.current.data).toEqual({ n: 1 });
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps showing old data while revalidating stale data (no spinner)', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    await fetchQuery('c', fetcher);
    const { result } = renderHook(() => useQuery('c', fetcher, { staleMs: 0 }));
    expect(result.current.data).toBe(1);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('refresh asks for fresh data', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    const { result } = renderHook(() => useQuery('d', fetcher));
    await waitFor(() => expect(result.current.data).toBe('x'));
    await act(() => result.current.refresh());
    expect(fetcher).toHaveBeenLastCalledWith({ fresh: true });
  });

  it('hydrates from localStorage after a reload', () => {
    localStorage.getItem.mockImplementation((k) =>
      k.endsWith(':e') ? JSON.stringify({ data: 'saved', updatedAt: Date.now() }) : null);
    const fetcher = vi.fn().mockResolvedValue('new');
    const { result } = renderHook(() => useQuery('e', fetcher, { staleMs: 60_000 }));
    expect(result.current.data).toBe('saved');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports an error only when there is no data to show', async () => {
    const { result } = renderHook(() => useQuery('f', () => Promise.reject(new Error('boom'))));
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
  });

  it('prefetch skips fresh entries', async () => {
    const fetcher = vi.fn().mockResolvedValue(1);
    await fetchQuery('g', fetcher);
    prefetch('g', fetcher, 60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
