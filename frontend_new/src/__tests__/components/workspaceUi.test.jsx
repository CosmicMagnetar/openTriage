import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Baton, Empty, Pulse, SkeletonRows } from '../../components/workspace/ui';

describe('workspace v3 ui', () => {
  it('Pulse beats for active, slows for stale, is flat for done', () => {
    const { container, rerender } = render(<Pulse color="green" />);
    expect(container.querySelector('.pulse-fast')).toBeTruthy();
    rerender(<Pulse color="amber" />);
    expect(container.querySelector('.pulse-slow')).toBeTruthy();
    rerender(<Pulse color="gray" />);
    expect(container.querySelector('.pulse-flat')).toBeTruthy();
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
    render(<SkeletonRows n={4} />);
    expect(screen.getByRole('status').textContent).toMatch(/Reading GitHub/);
  });

  it('Empty renders title with art', () => {
    const { container } = render(<Empty art="search" title="Nothing" />);
    expect(screen.getByText('Nothing')).toBeTruthy();
    expect(container.querySelector('svg.empty-art')).toBeTruthy();
  });
});
