/**
 * Community (maintainer): the people around your repos. First-time
 * contributors waiting on you, who has been active lately, claims going
 * stale, and how often outside pull requests get merged.
 */
import { GitPullRequest, Hourglass, UserPlus, Users } from 'lucide-react';
import { keys, workApi } from '../../services/workApi';
import { REFRESH_MS, useQuery } from '../../lib/query';
import { useItemPanel, prefetchItem } from './useWorkspace';
import { Card, ErrorLine, ExtLink, LiveNumber, Page, Progress, SkeletonRows, Stat, timeAgo } from './ui';
import { HUES } from './nav';

const itemOf = (x) => {
  const [owner, repo] = x.repo.split('/');
  return { kind: x.isPR ? 'pr' : 'issue', owner, repo, number: x.number };
};

export default function CommunityPage() {
  const q = useQuery(keys.community(), (o) => workApi.community(o), { staleMs: REFRESH_MS });
  const { open } = useItemPanel();
  const d = q.data;
  const ratio = d?.mergeRatio?.ratio;

  return (
    <Page title="Community"
      subtitle="The people around your repos: who is new and waiting, who is active, and where work is going quiet."
      refreshing={q.isRefreshing} updatedAt={q.updatedAt} onRefresh={() => q.refresh()}>
      <div className="px-8 py-6 space-y-6">
        {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
        {!d && !q.error && <SkeletonRows />}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Stat label="First-timers waiting" value={d ? d.newcomersWaiting.length : null} color={d?.newcomersWaiting.length ? 'var(--purple)' : undefined} />
          <Stat label="Active in 30 days" value={d ? d.activeContributors.length : null} />
          <Stat label="Claims going quiet" value={d ? d.staleClaims.length : null} color={d?.staleClaims.length ? 'var(--amber)' : undefined} />
          <Stat label="Outside PRs merged (%)" value={d && ratio != null ? Math.round(ratio * 100) : null}
            hint={d ? `${d.mergeRatio.outsideMerged ?? 0} of ${(d.mergeRatio.outsideMerged ?? 0) + (d.mergeRatio.outsideClosed ?? 0)} outside PRs merged in 90 days` : undefined} />
        </div>

        {d && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
            <div className="space-y-5 min-w-0">
              <Card title="First-time contributors waiting" icon={UserPlus} hue={HUES.pink} bodyClass="">
                {d.newcomersWaiting.length === 0 && <p className="px-5 pb-5 fs-13-5 text-[var(--muted)]">Nobody new is waiting. A friendly first reply is the best way to keep newcomers coming back.</p>}
                <ul>
                  {d.newcomersWaiting.map((n) => (
                    <li key={`${n.repo}#${n.number}`} className="border-t border-[var(--line)]">
                      <button onClick={() => open(itemOf(n))} onMouseEnter={() => prefetchItem(itemOf(n))}
                        className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-[var(--hover)]">
                        <img src={n.avatarUrl} alt="" className="w-8 h-8 rounded-full shrink-0" loading="lazy" />
                        <span className="flex-1 min-w-0">
                          <span className="block fs-14 truncate">{n.isPR && <GitPullRequest className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-[var(--muted)]" />}{n.title}</span>
                          <span className="block fs-12-5 text-[var(--muted)]">@{n.author} · <span className="mono">{n.repo}#{n.number}</span></span>
                        </span>
                        <span className="fs-13 font-semibold shrink-0" style={{ color: n.waitingDays >= 7 ? 'var(--amber)' : 'var(--text-2)' }}>
                          {n.waitingDays === 0 ? 'today' : `${n.waitingDays}d waiting`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Claims going quiet" icon={Hourglass} hue={HUES.amber} bodyClass="">
                {d.staleClaims.length === 0 && <p className="px-5 pb-5 fs-13-5 text-[var(--muted)]">No claimed issues have gone quiet.</p>}
                <ul>
                  {d.staleClaims.map((s) => (
                    <li key={`${s.repo}#${s.number}`} className="border-t border-[var(--line)]">
                      <button onClick={() => open(itemOf(s))} className="w-full text-left flex items-start gap-3 px-5 py-3 hover:bg-[var(--hover)]">
                        <span className="flex-1 min-w-0">
                          <span className="block fs-14 truncate">{s.title}</span>
                          <span className="block fs-12-5 text-[var(--muted)]">{s.claimant ? `@${s.claimant} · ` : ''}<span className="mono">{s.repo}#{s.number}</span>{s.idleDays != null ? ` · quiet ${s.idleDays}d` : ''}</span>
                          {s.summary && <span className="block fs-12-5 text-[var(--text-2)] mt-0.5">{s.summary}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="space-y-5">
              <Card title="Active contributors" icon={Users} hue={HUES.blue}>
                {d.activeContributors.length === 0 && <p className="fs-13-5 text-[var(--muted)]">No outside activity in the last 30 days.</p>}
                <ul className="space-y-3">
                  {d.activeContributors.map((p) => (
                    <li key={p.login} className="flex items-center gap-3">
                      <img src={p.avatarUrl} alt="" className="w-9 h-9 rounded-full" loading="lazy" />
                      <span className="flex-1 min-w-0">
                        <ExtLink href={`https://github.com/${p.login}`} className="fs-14 text-[var(--text)]">@{p.login}</ExtLink>
                        <span className="block fs-12-5 text-[var(--muted)]">
                          <LiveNumber value={p.mergedLast30} delta={false} /> merged · {p.openPRs} open · active {timeAgo(p.lastActiveAt)} ago
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              {ratio != null && (
                <Card title="Outside pull requests">
                  <p className="fs-30 font-semibold leading-none tnum">{Math.round(ratio * 100)}%</p>
                  <p className="fs-13 text-[var(--muted)] mt-1.5">merged in the last 90 days ({d.mergeRatio.outsideMerged} merged, {d.mergeRatio.outsideClosed} closed without merge).</p>
                  <div className="mt-3"><Progress value={ratio} color="var(--green)" /></div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
