import { Tag, User, ExternalLink } from 'lucide-react';

/**
 * Metadata sidebar widget showing labels, assignees, and links.
 */
const MetadataWidget = ({ issue }) => {
  if (!issue) return null;

  const labels = issue.labels || [];
  const assignees = issue.assignees || [];

  const labelColors = {
    bug: 'bg-red-500/15 text-red-400 border-red-500/30',
    feature: 'bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] border-[hsl(217,91%,60%,0.3)]',
    enhancement: 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border-[hsl(142,70%,45%,0.3)]',
    documentation: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    default: 'bg-[hsl(220,13%,18%)] text-[hsl(210,11%,65%)] border-[hsl(220,13%,25%)]',
  };

  const getLabelColor = (labelName) => {
    const name = (typeof labelName === 'string' ? labelName : labelName?.name || '').toLowerCase();
    return labelColors[name] || labelColors.default;
  };

  return (
    <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[hsl(220,13%,15%)]">
        <h3 className="text-sm font-semibold text-[hsl(210,11%,85%)]">Metadata</h3>
      </div>

      <div className="p-4 space-y-5">
        {/* Status */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-2">Status</p>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            issue.state === 'open'
              ? 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.3)]'
              : issue.state === 'merged'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
              : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              issue.state === 'open' ? 'bg-[hsl(142,70%,55%)]' :
              issue.state === 'merged' ? 'bg-purple-400' : 'bg-red-400'
            }`} />
            {issue.state?.charAt(0).toUpperCase() + issue.state?.slice(1)}
          </span>
        </div>

        {/* Repository */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-2">Repository</p>
          <p className="text-sm text-[hsl(217,91%,65%)]">{issue.repoName || `${issue.owner}/${issue.repo}`}</p>
        </div>

        {/* Labels */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-2 flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            Labels
          </p>
          {labels.length === 0 ? (
            <p className="text-xs text-[hsl(210,11%,35%)]">No labels</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label, i) => {
                const name = typeof label === 'string' ? label : label?.name || 'label';
                return (
                  <span
                    key={i}
                    className={`px-2 py-0.5 rounded border text-[11px] font-medium ${getLabelColor(label)}`}
                  >
                    {name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignees */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-2 flex items-center gap-1.5">
            <User className="w-3 h-3" />
            Assignees
          </p>
          {assignees.length === 0 ? (
            <p className="text-xs text-[hsl(210,11%,35%)]">Unassigned</p>
          ) : (
            <div className="space-y-2">
              {assignees.map((assignee, i) => {
                const login = typeof assignee === 'string' ? assignee : assignee?.login || 'user';
                const avatar = typeof assignee === 'object' ? assignee?.avatar_url : null;
                return (
                  <div key={i} className="flex items-center gap-2">
                    {avatar ? (
                      <img src={avatar} alt={login} className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[hsl(220,13%,18%)] flex items-center justify-center">
                        <User className="w-3 h-3 text-[hsl(210,11%,50%)]" />
                      </div>
                    )}
                    <span className="text-sm text-[hsl(210,11%,75%)]">{login}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* External Link */}
        {issue.htmlUrl && (
          <div>
            <a
              href={issue.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[hsl(217,91%,65%)] hover:text-[hsl(217,91%,75%)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on GitHub
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetadataWidget;
