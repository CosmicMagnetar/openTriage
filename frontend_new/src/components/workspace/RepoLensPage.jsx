/**
 * Repo Lens: orientation for an unfamiliar repository, from facts GitHub already has.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, BookOpen, Compass, FolderTree, Search, ShieldAlert, Terminal, Users } from 'lucide-react';
import { parseGitHubRef, workApi } from '../../services/workApi';
import {
  Chip, Empty, ErrorBox, ExtLink, Loading, Page, Panel, RESPONSIVENESS, buttonClass, ghostButtonClass, inputClass, timeAgo,
} from './ui';

function RepoPicker({ initial }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial || '');
  const submit = (e) => {
    e.preventDefault();
    const ref = parseGitHubRef(value);
    if (ref) navigate(`/dashboard/lens/${ref.owner}/${ref.repo}`);
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/repo or GitHub URL" className={`${inputClass} w-72`} />
      <button className={buttonClass} disabled={!parseGitHubRef(value)}><Search className="w-4 h-4" /> Open</button>
    </form>
  );
}

export default function RepoLensPage() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const [lens, setLens] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    if (!owner || !repo) return;
    setLens(null);
    setError(null);
    workApi.repoLens(owner, repo).then(setLens).catch((e) => setError(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [owner, repo]);

  if (!owner || !repo) {
    return (
      <Page title="Repo lens" subtitle="Understand a repository before contributing: stack, layout, setup, who reviews what, and whether maintainers respond.">
        <RepoPicker />
      </Page>
    );
  }

  const header = (
    <div className="flex flex-wrap gap-2">
      <RepoPicker initial={`${owner}/${repo}`} />
      <button onClick={() => navigate(`/dashboard/find?repo=${owner}/${repo}`)} className={ghostButtonClass}><Compass className="w-4 h-4" /> Find work here</button>
    </div>
  );

  if (error) return <Page title={`${owner}/${repo}`} actions={header}><ErrorBox message={error} onRetry={load} /></Page>;
  if (!lens) return <Page title={`${owner}/${repo}`} actions={header}><Loading label="Reading the repository…" /></Page>;

  const resp = lens.responsiveness ? RESPONSIVENESS[lens.responsiveness.level] : null;
  const docs = lens.docs;

  return (
    <Page title={lens.repo.fullName} subtitle={lens.repo.description} actions={header}>
      {lens.warnings.length > 0 && (
        <div className="mb-4 space-y-2">
          {lens.warnings.map((w) => (
            <div key={w} className="flex items-center gap-2 text-sm text-[hsl(38,92%,65%)] p-3 rounded-lg border border-[hsl(38,92%,50%,0.25)] bg-[hsl(38,92%,50%,0.06)]">
              <ShieldAlert className="w-4 h-4 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {lens.stack.map((s) => <Chip key={s.ecosystem} color="blue" title={s.evidence}>{s.ecosystem}</Chip>)}
        {lens.repo.license && <Chip>{lens.repo.license}</Chip>}
        <Chip>{lens.fileCount.toLocaleString()} files</Chip>
        <Chip>last push {timeAgo(lens.repo.pushedAt)}</Chip>
        {lens.newcomerIssuesOpen !== null && (
          <button onClick={() => navigate(`/dashboard/find?repo=${owner}/${repo}`)}>
            <Chip color={lens.newcomerIssuesOpen ? 'green' : 'gray'}>{lens.newcomerIssuesOpen} unassigned good-first issues</Chip>
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Will anyone respond?" icon={Activity}>
          {resp ? (
            <>
              <Chip color={resp.color}>{resp.label}</Chip>
              <p className="text-sm text-[hsl(210,11%,65%)] mt-2">{lens.responsiveness.summary}</p>
            </>
          ) : <p className="text-sm text-[hsl(210,11%,55%)]">Couldn't measure.</p>}
        </Panel>

        <Panel title="Contribution docs" icon={BookOpen}>
          <ul className="text-sm space-y-1 text-[hsl(210,11%,70%)]">
            {[
              ['README', docs.readme], ['Contributing guide', docs.contributing], ['Code of conduct', docs.codeOfConduct],
              ['PR template', docs.prTemplate],
            ].map(([label, path]) => (
              <li key={label} className="flex items-center gap-2">
                <Chip color={path ? 'green' : 'gray'}>{path ? 'yes' : 'none'}</Chip>
                {path ? <ExtLink href={`${lens.repo.url}/blob/${lens.repo.defaultBranch}/${path}`}>{label}</ExtLink> : label}
              </li>
            ))}
            <li className="flex items-center gap-2"><Chip>{docs.issueTemplates}</Chip> issue templates</li>
            <li className="flex items-center gap-2"><Chip>{docs.ci.length}</Chip> CI workflows</li>
          </ul>
        </Panel>

        <Panel title="Set up and run" icon={Terminal} className="md:col-span-2">
          {lens.setup.length === 0 && Object.keys(lens.scripts).length === 0 ? (
            <p className="text-sm text-[hsl(210,11%,55%)]">No setup commands found in README or CONTRIBUTING.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {lens.setup.map((b) => (
                <div key={`${b.source}-${b.section}`}>
                  <p className="text-xs text-[hsl(210,11%,50%)] mb-1">{b.section} — {b.source}</p>
                  <pre className="text-xs bg-[hsl(220,13%,5%)] border border-[hsl(220,13%,14%)] rounded-lg p-3 overflow-x-auto text-[hsl(210,11%,80%)]">{b.commands.join('\n')}</pre>
                </div>
              ))}
              {Object.keys(lens.scripts).length > 0 && (
                <div>
                  <p className="text-xs text-[hsl(210,11%,50%)] mb-1">package.json scripts</p>
                  <ul className="text-xs font-mono space-y-1">
                    {Object.entries(lens.scripts).map(([k, v]) => (
                      <li key={k}><span className="text-[hsl(217,91%,70%)]">{k}</span> <span className="text-[hsl(210,11%,50%)]">{v}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Layout" icon={FolderTree}>
          <ul className="space-y-1">
            {lens.layout.map((d) => (
              <li key={d.path} className="flex items-center justify-between text-sm">
                <ExtLink href={`${lens.repo.url}/tree/${lens.repo.defaultBranch}/${d.path}`} className="font-mono text-xs">{d.path}/</ExtLink>
                <span className="flex items-center gap-2">
                  {d.role && <Chip>{d.role}</Chip>}
                  <span className="text-xs text-[hsl(210,11%,45%)] w-14 text-right">{d.files} files</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Where work is happening" icon={Users}>
          {lens.activeAreas.length === 0 ? <p className="text-sm text-[hsl(210,11%,55%)]">No recent merged PRs.</p> : (
            <ul className="space-y-2">
              {lens.activeAreas.map((a) => (
                <li key={a.area} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[hsl(210,11%,80%)]">{a.area}</span>
                    <span className="text-xs text-[hsl(210,11%,45%)]">{a.changes} recent changes</span>
                  </div>
                  {a.people.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">{a.people.map((p) => <Chip key={p}>@{p}</Chip>)}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {lens.codeowners.length > 0 && (
          <Panel title="Code owners (who reviews what)" className="md:col-span-2">
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {lens.codeowners.map((r) => (
                <li key={r.pattern} className="text-xs flex items-center justify-between gap-2">
                  <span className="font-mono text-[hsl(210,11%,75%)] truncate">{r.pattern}</span>
                  <span className="text-[hsl(210,11%,55%)] truncate">{r.owners.join(' ')}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {lens.layout.length === 0 && <Empty title="Empty repository" />}
    </Page>
  );
}
