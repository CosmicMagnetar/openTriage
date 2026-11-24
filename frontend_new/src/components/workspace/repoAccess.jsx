/**
 * Your GitHub access, found automatically: repos you can maintain (owned,
 * collaborator, org/team), your orgs and role, and a one-time "re-connect"
 * prompt when the sign-in predates the org scope. No typing owner/repo.
 */
import { useState } from 'react';
import { ExternalLink, KeyRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { keys, workApi } from '../../services/workApi';
import { invalidate, useQuery } from '../../lib/query';
import { GITHUB_LOGIN_URL } from '../../lib/config';
import { Button, Card, Tag } from './ui';

export const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', maintain: 'Maintain', push: 'Write' };
const ROLE_COLOR = { owner: 'green', admin: 'blue', maintain: 'purple', push: 'gray' };

export function useAccess() {
  return useQuery(keys.access(), (o) => workApi.access(o), { staleMs: 10 * 60_000 });
}

/** Thin bar shown once per session when the sign-in lacks read:org / read:project. */
export function ReconnectBanner() {
  const access = useAccess();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('ot:reconnect-hidden') === '1'; } catch { return false; }
  });
  if (hidden || !access.data?.needsReconnect) return null;
  const hide = () => {
    setHidden(true);
    try { sessionStorage.setItem('ot:reconnect-hidden', '1'); } catch { /* private mode */ }
  };
  return (
    <div role="status" className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[var(--line)] bg-[var(--raised)] fs-13">
      <KeyRound className="w-4 h-4 text-[var(--amber)] shrink-0" />
      <span className="flex-1 min-w-0 text-[var(--text-2)]">
        Re-connect GitHub once so OpenTriage can find your organization repos and read project boards.
      </span>
      <Button size="sm" variant="primary" onClick={() => { window.location.href = GITHUB_LOGIN_URL; }}>Re-connect</Button>
      <button onClick={hide} aria-label="Hide for now" className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)]">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function RepoRow({ r, busy, onManage }) {
  return (
    <li className="flex items-center gap-2.5 px-1 py-1.5 rounded hover:bg-[var(--hover)]">
      <img src={`https://github.com/${r.owner}.png?size=40`} alt="" className="w-5 h-5 rounded" loading="lazy" />
      <span className="flex-1 min-w-0">
        <span className="block truncate fs-13">{r.fullName}</span>
        {r.description && <span className="block truncate fs-12 text-[var(--muted)]">{r.description}</span>}
      </span>
      <Tag color={ROLE_COLOR[r.role]}>{ROLE_LABEL[r.role]}</Tag>
      <Button size="sm" disabled={busy} onClick={() => onManage(r.fullName)}>Manage</Button>
    </li>
  );
}

/**
 * Repos you maintain on GitHub that OpenTriage doesn't track yet, each one
 * click away. Hidden when there is nothing to add.
 */
export function YourGitHubRepos({ onTracked, limit = 5, title = 'Your repos on GitHub' }) {
  const access = useAccess();
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = access.data;
  if (!d) return null;
  const untracked = d.repos.filter((r) => !r.tracked && !r.archived);
  const blockedOrgs = d.orgs.filter((o) => o.repoCount === 0);
  if (!untracked.length && !blockedOrgs.length) return null;

  const manage = async (fullNames) => {
    setBusy(true);
    try {
      await workApi.trackRepos(fullNames);
      toast.success(fullNames.length === 1 ? `Managing ${fullNames[0]}` : `Managing ${fullNames.length} repos`);
      invalidate(keys.access());
      access.refresh();
      onTracked?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = all ? untracked : untracked.slice(0, limit);
  return (
    <Card title={title}
      right={untracked.length > limit && (
        <button onClick={() => setAll((v) => !v)} className="fs-12-5 text-[var(--link)] hover:underline">
          {all ? 'Show less' : `Show all ${untracked.length}`}
        </button>
      )}>
      {untracked.length > 0 && (
        <>
          <p className="fs-12-5 text-[var(--muted)] mb-2">Found on GitHub where you can push. One click to manage it here.</p>
          <ul className="-mx-1">
            {shown.map((r) => <RepoRow key={r.fullName} r={r} busy={busy} onManage={(n) => manage([n])} />)}
          </ul>
        </>
      )}
      {blockedOrgs.length > 0 && (
        <p className="fs-12-5 text-[var(--muted)] mt-3">
          No repos visible from {blockedOrgs.map((o) => o.login).join(', ')}? The org may need to approve OpenTriage.{' '}
          <a href={d.requestAccessUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--link)] hover:underline inline-flex items-center gap-1">
            Request access <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      )}
    </Card>
  );
}

/** Orgs you belong to, with your role. Used on your own profile. */
export function OrgList({ orgs }) {
  if (!orgs?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {orgs.map((o) => (
        <a key={o.login} href={`https://github.com/${o.login}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-[var(--line)] hover:bg-[var(--hover)] fs-13">
          <img src={o.avatarUrl} alt="" className="w-5 h-5 rounded-full" loading="lazy" />
          <span>{o.login}</span>
          {o.role && <span className="fs-11-5 text-[var(--muted)]">{o.role === 'admin' ? 'Owner' : 'Member'}</span>}
        </a>
      ))}
    </div>
  );
}
