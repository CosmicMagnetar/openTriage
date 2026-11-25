/**
 * Repo lens: orientation for an unfamiliar repository, from facts GitHub has.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keys, parseGitHubRef, workApi } from '../../services/workApi';
import { useQuery } from '../../lib/query';
import { useSignals } from './opportunities';
import { toast } from 'sonner';
import { BACKEND_URL } from '../../lib/config';
import { Block, Button, Dot, Empty, ErrorLine, ExtLink, Input, Page, RESPONSIVENESS, SkeletonRows, Tag, timeAgo } from './ui';
import { RepoContext } from './repoContext';

function RepoPicker({ initial = '' }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const ref = parseGitHubRef(value);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ref) navigate(`/dashboard/lens/${ref.owner}/${ref.repo}`); }} className="flex items-center gap-1.5">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/repo or GitHub URL" className="w-60" />
      <Button disabled={!ref}>Open</Button>
    </form>
  );
}

/** Maintainers can show newcomers, right in their README, that help is wanted and answered. */
function ReadmeBadge({ fullName }) {
  const src = `${BACKEND_URL}/api/badge/${fullName}`;
  const md = `[![OpenTriage](${src})](${window.location.origin}/dashboard/lens/${fullName})`;
  const copy = () => navigator.clipboard?.writeText(md).then(() => toast.success('Badge Markdown copied')).catch(() => toast.error('Copy failed'));
  return (
    <details className="py-2 border-b border-[var(--line-soft)] fs-12-5">
      <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text-2)]">README badge for this repo</summary>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <img src={src} alt="OpenTriage badge preview" height="20" />
        <code className="mono fs-11 px-2 py-1 rounded bg-[var(--inset)] border border-[var(--line-soft)] max-w-full truncate">{md}</code>
        <Button size="sm" onClick={copy}>Copy Markdown</Button>
      </div>
      <p className="mt-1.5 fs-12 text-[var(--muted)]">Shows open, unassigned good-first issues and how fast maintainers usually reply. Updates hourly.</p>
    </details>
  );
}

/** Starting point: repos you already touch, one click away. */
function LensStart() {
  const navigate = useNavigate();
  const sig = useSignals();
  const groups = [
    ['You contributed to', sig.data?.contributedTo ?? []],
    ['You starred', sig.data?.starred ?? []],
  ].filter(([, list]) => list.length);
  return (
    <div className="px-5 pb-10 max-w-4xl">
      <Empty art="search" title="Pick a repository to read">
        Stack, layout, how to run it, who reviews which area, and whether maintainers answer outside contributors.
      </Empty>
      {groups.map(([label, list]) => (
        <div key={label} className="mt-2 mb-5">
          <h2 className="fs-11 font-medium uppercase tracking-[0.06em] text-[var(--faint)] mb-2">{label}</h2>
          <div className="flex flex-wrap gap-1.5">
            {list.slice(0, 12).map((full) => (
              <button key={full} onClick={() => navigate(`/dashboard/lens/${full}`)}
                className="lens-chip mono h-7 px-2.5 rounded-md border border-[var(--line)] bg-[var(--panel)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--accent)]">
                {full}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RepoLensPage() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const q = useQuery(owner && repo ? keys.lens(owner, repo) : null, () => workApi.repoLens(owner, repo), { staleMs: 30 * 60_000 });
  const lens = q.data;

  if (!owner || !repo) {
    return (
      <Page title="Repo lens" subtitle="Understand a repository before contributing: stack, layout, how to run it, who reviews what, and whether maintainers respond.">
        <div className="px-5 py-6"><RepoPicker /></div>
        <LensStart />
      </Page>
    );
  }

  const resp = lens?.responsiveness ? RESPONSIVENESS[lens.responsiveness.level] : null;
  const docs = lens?.docs;

  return (
    <Page title={lens?.repo.fullName ?? `${owner}/${repo}`} subtitle={lens?.repo.description}
      refreshing={q.isRefreshing} updatedAt={q.updatedAt}
      actions={<>
        <RepoPicker initial={`${owner}/${repo}`} />
        <Button onClick={() => navigate(`/dashboard/find?repo=${owner}/${repo}&newcomer=false`)}>Find work here</Button>
      </>}>
      {q.error && <ErrorLine message={q.error.message} onRetry={q.refresh} />}
      {q.isLoading && <SkeletonRows n={8} />}
      {lens && (
        <div className="px-5 pb-10 max-w-5xl">
          <div className="flex flex-wrap items-center gap-1.5 py-3 border-b border-[var(--line-soft)]">
            {lens.stack.map((s) => <Tag key={s.ecosystem} title={s.evidence}>{s.ecosystem}</Tag>)}
            {lens.repo.license && <Tag>{lens.repo.license}</Tag>}
            <Tag mono>{lens.fileCount.toLocaleString()} files</Tag>
            <Tag>pushed {timeAgo(lens.repo.pushedAt)} ago</Tag>
            {resp && <Tag color={resp.color} title={lens.responsiveness.summary}>{resp.label}</Tag>}
            {lens.newcomerIssuesOpen !== null && (
              <button onClick={() => navigate(`/dashboard/find?repo=${owner}/${repo}`)}>
                <Tag color={lens.newcomerIssuesOpen ? 'green' : 'gray'}>{lens.newcomerIssuesOpen} open good-first issues</Tag>
              </button>
            )}
            <ExtLink href={lens.repo.url} className="ml-auto fs-12 text-[var(--muted)]">GitHub</ExtLink>
          </div>

          <ReadmeBadge fullName={lens.repo.fullName} />

          <RepoContext owner={owner} repo={repo} />

          {lens.warnings.map((w) => (
            <p key={w} className="flex items-center gap-2 py-2 fs-12-5 text-[var(--text-2)] border-b border-[var(--line-soft)]">
              <Dot color="amber" /> {w}
            </p>
          ))}

          <div className="grid md:grid-cols-2 md:gap-x-8">
            <Block title="Will anyone respond?">
              <p className="fs-12-5 text-[var(--text-2)]">{lens.responsiveness?.summary ?? 'Could not measure.'}</p>
            </Block>

            <Block title="Contribution docs">
              <ul className="grid grid-cols-2 gap-y-1 fs-12-5">
                {[['README', docs.readme], ['Contributing guide', docs.contributing], ['Code of conduct', docs.codeOfConduct], ['PR template', docs.prTemplate]].map(([label, path]) => (
                  <li key={label} className="flex items-center gap-2">
                    <Dot color={path ? 'green' : 'gray'} />
                    {path ? <ExtLink href={`${lens.repo.url}/blob/${lens.repo.defaultBranch}/${path}`} className="text-[var(--text-2)]">{label}</ExtLink>
                      : <span className="text-[var(--faint)]">{label}</span>}
                  </li>
                ))}
                <li className="text-[var(--muted)]">{docs.issueTemplates} issue templates</li>
                <li className="text-[var(--muted)]">{docs.ci.length} CI workflows</li>
              </ul>
            </Block>
          </div>

          <Block title="Run it locally">
            {lens.setup.length === 0 && Object.keys(lens.scripts).length === 0 ? (
              <p className="fs-12-5 text-[var(--muted)]">No setup commands found in the README or contributing guide.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {lens.setup.map((b) => (
                  <div key={`${b.source}-${b.section}`}>
                    <p className="fs-11-5 text-[var(--faint)] mb-1">{b.section} · {b.source}</p>
                    <pre className="mono fs-11-5 bg-[var(--bg)] border border-[var(--line-soft)] rounded-md p-2.5 overflow-x-auto text-[var(--text-2)]">{b.commands.join('\n')}</pre>
                  </div>
                ))}
                {Object.keys(lens.scripts).length > 0 && (
                  <div>
                    <p className="fs-11-5 text-[var(--faint)] mb-1">package.json scripts</p>
                    <ul className="mono fs-11-5 space-y-0.5">
                      {Object.entries(lens.scripts).map(([k, v]) => (
                        <li key={k} className="truncate"><span className="text-[var(--text)]">{k}</span> <span className="text-[var(--faint)]">{v}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Block>

          <div className="grid md:grid-cols-2 md:gap-x-8">
            <Block title="Layout">
              <ul className="space-y-0.5">
                {lens.layout.map((d) => (
                  <li key={d.path} className="flex items-center gap-2 fs-12-5">
                    <ExtLink href={`${lens.repo.url}/tree/${lens.repo.defaultBranch}/${d.path}`} className="mono text-[var(--text-2)]">{d.path}/</ExtLink>
                    {d.role && <span className="text-[var(--faint)]">{d.role}</span>}
                    <span className="ml-auto mono text-[var(--faint)]">{d.files}</span>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title="Where work is happening">
              {lens.activeAreas.length === 0 ? <p className="fs-12-5 text-[var(--muted)]">No recently merged PRs.</p> : (
                <ul className="space-y-1">
                  {lens.activeAreas.map((a) => (
                    <li key={a.area} className="flex items-center gap-2 fs-12-5">
                      <span className="mono text-[var(--text-2)] truncate">{a.area}</span>
                      <span className="text-[var(--faint)]">{a.people.map((p) => `@${p}`).join(' ')}</span>
                      <span className="ml-auto mono text-[var(--faint)]">{a.changes}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          </div>

          {lens.codeowners.length > 0 && (
            <Block title="Who reviews what (CODEOWNERS)">
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-0.5">
                {lens.codeowners.map((r) => (
                  <li key={r.pattern} className="flex items-center justify-between gap-3 fs-12">
                    <span className="mono text-[var(--text-2)] truncate">{r.pattern}</span>
                    <span className="text-[var(--muted)] truncate">{r.owners.join(' ')}</span>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {lens.layout.length === 0 && <Empty art="search" title="This repository looks empty." />}
        </div>
      )}
    </Page>
  );
}
