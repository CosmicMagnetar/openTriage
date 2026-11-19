import { describe, expect, it, vi } from 'vitest';
import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageBoundary, PageFallback, lazyRetry } from '../../components/workspace/PageShell';

describe('page area never goes blank', () => {
  it('retries page code that failed to load once', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: () => <p>Loaded page</p> });
    const Page = lazyRetry(load);
    render(<Suspense fallback={<p>waiting</p>}><Page /></Suspense>);
    expect(await screen.findByText('Loaded page', {}, { timeout: 2000 })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('fallback shows the page name, not an empty area', () => {
    render(<MemoryRouter><PageFallback ws="contributor" pathname="/dashboard/profile" /></MemoryRouter>);
    expect(screen.getByRole('heading').textContent).toBe('Profile');
  });

  it('a page that throws shows a reload message', () => {
    const Boom = () => { throw new Error('x'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<PageBoundary><Boom /></PageBoundary>);
    expect(screen.getByText("This page didn't load")).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
  });
});
