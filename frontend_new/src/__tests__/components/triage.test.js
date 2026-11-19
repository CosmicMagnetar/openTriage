import { describe, expect, it } from 'vitest';
import { columnFor, labelChanges } from '../../components/workspace/triage';

describe('triage columns and labels', () => {
  it('puts issues in columns by label', () => {
    expect(columnFor([])).toBe('new');
    expect(columnFor(['bug'])).toBe('new');
    expect(columnFor(['Needs Info'])).toBe('info');
    expect(columnFor([{ name: 'good first issue' }])).toBe('ready');
    expect(columnFor(['duplicate'])).toBe('dup');
  });

  it('moving adds the target label and removes other column labels only', () => {
    expect(labelChanges(['bug', 'needs info'], 'ready')).toEqual({ add: ['good first issue'], remove: ['needs info'] });
  });

  it('moving to New only removes triage labels', () => {
    expect(labelChanges(['bug', 'duplicate'], 'new')).toEqual({ add: [], remove: ['duplicate'] });
  });

  it('no add when the target label (or an alias) is already there', () => {
    expect(labelChanges(['help wanted'], 'ready')).toEqual({ add: [], remove: [] });
  });
});
