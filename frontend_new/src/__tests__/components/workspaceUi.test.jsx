import { describe, expect, it } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { Baton, Empty, LiveNumber, Pulse, SkeletonRows, useChangedRows } from '../../components/workspace/ui';
import usePrefs, { arrangeNav, accentFor } from '../../stores/prefsStore';

describe('workspace v3 ui', () => {
  it('state mark: filled dot when active, dashed when stale, ring only when done', () => {
    const { container, rerender } = render(<Pulse color="green" />);
    expect(container.querySelectorAll('circle').length).toBe(2);
    rerender(<Pulse color="amber" />);
    expect(container.querySelector('circle[stroke-dasharray]')).toBeTruthy();
    rerender(<Pulse color="gray" />);
    expect(container.querySelectorAll('circle').length).toBe(1);
  });

  it('Baton marks maintainers as holder when waiting on maintainers', () => {
    render(<Baton action={{ type: 'review_pending', waitingOn: { kind: 'maintainers' } }} me="me" />);
    expect(screen.getByLabelText('Waiting on maintainers')).toBeTruthy();
  });

  it('Baton marks you as holder when waiting on the viewer', () => {
    render(<Baton action={{ type: 'changes_requested', waitingOn: { kind: 'user', login: 'Me' } }} me="me" />);
    expect(screen.getByLabelText('Waiting on you')).toBeTruthy();
  });

  it('Baton marks CI as holder when CI is failing', () => {
    render(<Baton action={{ type: 'ci_failing', waitingOn: { kind: 'user', login: 'x' } }} me="me" />);
    expect(screen.getByLabelText('Waiting on CI')).toBeTruthy();
  });

  it('first-load state is a status message, not grey bars', () => {
    const { container } = render(<SkeletonRows n={4} />);
    expect(screen.getByRole('status').textContent).toMatch(/GitHub/);
    expect(container.querySelector('svg, .skeleton')).toBeNull();
  });

  it('Empty renders title with art', () => {
    const { container } = render(<Empty art="search" title="Nothing" />);
    expect(screen.getByText('Nothing')).toBeTruthy();
    expect(container.querySelector('svg.empty-art')).toBeTruthy();
  });
});

describe('workspace v4 ui', () => {
  it('LiveNumber shows a dash before data and does not animate the first value', () => {
    usePrefs.setState({ motion: false });
    const { container, rerender } = render(<LiveNumber value={null} />);
    expect(container.textContent).toBe('–');
    rerender(<LiveNumber value={5} />);
    expect(container.textContent).toBe('5');
    expect(container.querySelector('.delta')).toBeNull();
  });

  it('LiveNumber shows the change only when the value changes', () => {
    usePrefs.setState({ motion: false });
    const { container, rerender } = render(<LiveNumber value={5} />);
    rerender(<LiveNumber value={5} />);
    expect(container.querySelector('.delta')).toBeNull();
    rerender(<LiveNumber value={7} />);
    expect(container.textContent).toContain('7');
    expect(container.querySelector('.delta').textContent).toBe('▲2');
    expect(container.querySelector('.num-changed')).toBeTruthy();
  });

  it('useChangedRows flags only rows that changed after the first data set', () => {
    const { result, rerender } = renderHook(({ items }) => useChangedRows(items, (x) => x.id), {
      initialProps: { items: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }] },
    });
    expect(result.current(1)).toBe(false);
    act(() => rerender({ items: [{ id: 1, v: 'a' }, { id: 2, v: 'c' }, { id: 3, v: 'd' }] }));
    expect(result.current(1)).toBe(false);
    expect(result.current(2)).toBe(true);
    expect(result.current(3)).toBe(true);
  });

  it('arrangeNav applies saved order and hides pages but never Today', () => {
    const nav = [{ path: '/dashboard' }, { path: '/a' }, { path: '/b' }];
    const prefs = { navOrder: { contributor: ['/b', '/a'] }, navHidden: { contributor: ['/a', '/dashboard'] } };
    expect(arrangeNav(nav, prefs, 'contributor').map((n) => n.path)).toEqual(['/b', '/dashboard']);
  });

  it('each workspace has its own default accent', () => {
    expect(accentFor({ accent: {} }, 'contributor').hex).not.toBe(accentFor({ accent: {} }, 'maintainer').hex);
    expect(accentFor({ accent: { maintainer: 'blue' } }, 'maintainer').hex).toBe('#478be6');
  });
});

describe('workspace v5 nav', () => {
  it('contributor and maintainer get different pages', async () => {
    const { NAV } = await import('../../components/workspace/nav');
    const paths = (ws) => NAV[ws].flatMap((g) => g.items.map((i) => i.label));
    expect(paths('contributor')).not.toEqual(paths('maintainer'));
    expect(paths('contributor')).toContain('Home');
    expect(paths('maintainer')).toContain('Command center');
  });
});
