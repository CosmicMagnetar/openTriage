import { describe, expect, it } from 'vitest';
import { coAuthorTrailer, firstPrSteps, issueDrafts, prDrafts } from '../../components/workspace/drafts';

const claim = (login, stale) => ({ login, stale, source: 'comment', claimedAt: null, lastActivityAt: null });

describe('issueDrafts', () => {
  it('claimer gets update and step-back drafts', () => {
    const d = issueDrafts({ availability: { claims: [claim('me', false)], openPRs: [] }, mine: { claimed: true }, isMaintainer: false, me: 'me' });
    expect(d.map((x) => x.id)).toEqual(['update', 'release']);
  });

  it('maintainer gets check-in naming only stale claimers', () => {
    const d = issueDrafts({ availability: { claims: [claim('ann', true), claim('bob', false)], openPRs: [] }, mine: { claimed: false }, isMaintainer: true, me: 'boss' });
    const checkin = d.find((x) => x.id === 'checkin');
    expect(checkin.text).toContain('@ann');
    expect(checkin.text).not.toContain('@bob');
  });

  it('nothing to say when nothing is stale and not claimed', () => {
    expect(issueDrafts({ availability: { claims: [], openPRs: [] }, mine: { claimed: false }, isMaintainer: true })).toEqual([]);
  });
});

describe('prDrafts', () => {
  const pr = { author: { login: 'ann' } };
  it('only for stalled PRs', () => {
    expect(prDrafts({ pr, mine: false, isMaintainer: true, stalled: false })).toEqual([]);
  });
  it('others can offer to continue, crediting the author', () => {
    const [d] = prDrafts({ pr, mine: false, isMaintainer: false, stalled: true });
    expect(d.id).toBe('pr-adopt');
    expect(d.text).toContain('@ann');
    expect(d.text).toMatch(/co-author/);
  });
  it('author can hand off', () => {
    expect(prDrafts({ pr, mine: true, isMaintainer: false, stalled: true }).map((x) => x.id)).toContain('pr-handoff');
  });
});

describe('firstPrSteps', () => {
  it('next step is opening a PR after claiming', () => {
    const r = firstPrSteps({ issue: { number: 7, state: 'OPEN' }, availability: { status: 'claimed', openPRs: [] }, mine: { claimed: true }, me: 'me' });
    expect(r.next).toBe('setup');
    expect(r.steps.find((s) => s.id === 'pr').label).toContain('Fixes #7');
  });
  it('ticks PR step from my linked PR', () => {
    const r = firstPrSteps({ issue: { number: 7, state: 'OPEN' }, availability: { status: 'in_progress', openPRs: [{ author: 'Me', url: 'u' }] }, mine: { claimed: true }, me: 'me' });
    expect(r.next).toBe('merge');
    expect(r.myPR.url).toBe('u');
  });
  it('all done when issue closed', () => {
    expect(firstPrSteps({ issue: { state: 'CLOSED' }, availability: { status: 'closed', openPRs: [] }, mine: { claimed: true }, me: 'me' }).next).toBeNull();
  });
});

it('coAuthorTrailer uses the GitHub noreply address', () => {
  expect(coAuthorTrailer('ann')).toBe('Co-authored-by: ann <ann@users.noreply.github.com>');
});

import { newActions } from '../../lib/notify';
it('newActions returns only unseen actions', () => {
  expect(newActions([{ id: 'a' }, { id: 'b' }], ['a']).map((x) => x.id)).toEqual(['b']);
});
