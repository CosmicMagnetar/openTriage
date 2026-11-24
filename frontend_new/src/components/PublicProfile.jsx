/**
 * /u/:login — public profile anyone can open, only when its owner turned the
 * link on. Shows the GitHub identity, level, the numbers and badges the
 * owner chose, and the contribution graph. Nothing else.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, Lock, MapPin, Users } from 'lucide-react';
import { workApi } from '../services/workApi';
import Logo from './Logo';
import BadgeArt from './workspace/badges/BadgeArt';
import { TIERS, evaluateAll, featuredBadges, levelTitle } from './workspace/badges/registry';
import { ContributionGraph } from './workspace/ContributionGraph';
import { HUES } from './workspace/nav';
import { OrgList } from './workspace/repoAccess';
import './workspace/theme.css';

const STAT_LABELS = {
  merged: ['PRs merged', (d) => d.stats.prsMerged],
  opened: ['PRs opened', (d) => d.stats.prsOpened],
  issues: ['Issues opened', (d) => d.stats.issuesOpened],
  reviews: ['Reviews given', (d) => d.stats.reviews],
  repos: ['Repositories', (d) => d.stats.repos],
  streak: ['Longest streak', (d) => d.graph?.streak?.longestStreak ?? 0],
  lines: ['Lines added', (d) => d.stats.additions],
};

export default function PublicProfile() {
  const { login } = useParams();
  const [state, setState] = useState({ loading: true });
  const [gh, setGh] = useState(null);

  useEffect(() => {
    let off = false;
    workApi.publicProfile(login)
      .then((data) => !off && setState({ data }))
      .catch((err) => !off && setState({ error: err?.response?.status === 404 ? 'private' : 'failed' }));
    fetch(`https://api.github.com/users/${encodeURIComponent(login)}`).then((r) => (r.ok ? r.json() : null)).then((g) => !off && setGh(g)).catch(() => {});
    return () => { off = true; };
  }, [login]);

  const d = state.data;
  const results = useMemo(() => evaluateAll(d), [d]);
  const visible = results.filter((r) => r.tier >= 0 && !d?.settings.hidden.includes(r.badge.id));
  const shelf = d ? featuredBadges(results, d.settings, 6) : [];
  const hue = HUES[d?.settings.hue] ?? HUES.indigo;

  useEffect(() => { document.title = `${gh?.name || login} · OpenTriage`; }, [gh, login]);

  return (
    <div className="ot min-h-screen" data-text="15" data-density="comfortable" style={{ '--hue': hue }}>
      <header className="ctx flex items-center gap-3 px-6">
        <Link to="/" className="flex items-center gap-2"><Logo size="sm" /><span className="fs-14 font-semibold">OpenTriage</span></Link>
        <span className="fs-13 text-[var(--muted)] hidden sm:inline">Grow in open source, one clear next step a day.</span>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {state.error === 'private' && (
          <section className="card p-10 text-center">
            <Lock className="w-8 h-8 mx-auto text-[var(--muted)]" />
            <h1 className="fs-19 font-semibold mt-3">This profile is private</h1>
            <p className="fs-14 text-[var(--muted)] mt-1">@{login} hasn't shared their OpenTriage profile, or it doesn't exist.</p>
          </section>
        )}
        {state.error === 'failed' && <p className="fs-14 text-[var(--muted)]">Couldn't load this profile right now. Try again in a minute.</p>}
        {state.loading && !d && <p className="fs-14 text-[var(--muted)]">Loading @{login}'s profile from GitHub.</p>}

        {d && (
          <>
            <section className="card overflow-hidden">
              <div className="h-28 flex items-end justify-end pr-6 pb-3" style={{ background: `color-mix(in srgb, ${hue} 16%, var(--inset))` }}>
                {d.settings.banner === 'graph' && d.graph?.weeks && <div className="opacity-80"><ContributionGraph weeks={d.graph.weeks.slice(-30)} compact /></div>}
              </div>
              <div className="px-6 pb-6 flex flex-wrap items-end gap-5 -mt-10">
                <img src={gh?.avatar_url ?? `https://github.com/${login}.png`} alt="" className="w-24 h-24 rounded-full border-4 border-[var(--panel)] bg-[var(--panel)]" />
                <div className="flex-1 min-w-[220px] pt-12">
                  <h1 className="fs-24 font-semibold leading-tight">{gh?.name || d.login}</h1>
                  <p className="fs-14 text-[var(--muted)]">@{d.login} · <span className="font-semibold" style={{ color: hue }}>Level {d.level.level} · {levelTitle(d.level.level)}</span></p>
                  {gh?.bio && <p className="fs-14 text-[var(--text-2)] mt-1.5">{gh.bio}</p>}
                  <p className="fs-13 text-[var(--muted)] mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {gh?.company && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{gh.company}</span>}
                    {gh?.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{gh.location}</span>}
                    {gh && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{gh.followers} followers</span>}
                  </p>
                  {d.orgs?.length > 0 && <div className="mt-3"><OrgList orgs={d.orgs} /></div>}
                </div>
                <a href={`https://github.com/${d.login}`} target="_blank" rel="noopener noreferrer" className="fs-13 text-[var(--link)] hover:underline">View on GitHub</a>
              </div>
            </section>

            {d.settings.stats.length > 0 && (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {d.settings.stats.filter((k) => STAT_LABELS[k]).map((k) => (
                  <div key={k} className="card p-4">
                    <p className="fs-13 text-[var(--text-2)]">{STAT_LABELS[k][0]}</p>
                    <p className="fs-30 font-semibold leading-none mt-1.5 tnum">{Number(STAT_LABELS[k][1](d)).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}

            {shelf.length > 0 && (
              <section className="card p-5">
                <h2 className="fs-16 font-semibold mb-4">Featured badges</h2>
                <div className="flex flex-wrap gap-6">
                  {shelf.map((r) => (
                    <div key={r.badge.id} className="flex flex-col items-center gap-1.5 w-[104px]">
                      <BadgeArt badge={r.badge} tier={r.tier} size={76} />
                      <span className="fs-13 font-semibold text-center leading-tight">{r.badge.name}</span>
                      <span className="fs-11-5" style={{ color: TIERS[r.tier].color }}>{TIERS[r.tier].label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {visible.length > shelf.length && (
              <section className="card p-5">
                <h2 className="fs-16 font-semibold mb-4">All badges <span className="fs-13 font-normal text-[var(--muted)]">{visible.length}</span></h2>
                <div className="flex flex-wrap gap-4">
                  {visible.map((r) => (
                    <div key={r.badge.id} title={`${r.badge.name} · ${TIERS[r.tier].label}`} className="flex flex-col items-center w-[72px]">
                      <BadgeArt badge={r.badge} tier={r.tier} size={52} />
                      <span className="fs-11-5 text-center text-[var(--text-2)] mt-1 leading-tight">{r.badge.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {d.graph?.weeks && (
              <section className="card p-5">
                <h2 className="fs-16 font-semibold mb-3">Contributions <span className="fs-13 font-normal text-[var(--muted)]">{d.graph.totalContributions.toLocaleString()} in the last year</span></h2>
                <ContributionGraph weeks={d.graph.weeks} />
              </section>
            )}

            <p className="fs-12-5 text-[var(--muted)] text-center">Built from public GitHub activity with <Link to="/" className="text-[var(--link)] hover:underline">OpenTriage</Link>.</p>
          </>
        )}
      </main>
    </div>
  );
}
