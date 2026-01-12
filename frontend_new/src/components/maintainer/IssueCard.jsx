import { Calendar, User, Tag, GitPullRequest } from 'lucide-react';
import useIssueStore from '../../stores/issueStore';

const IssueCard = ({ issue }) => {
  const { setSelectedIssue } = useIssueStore();
  const triage = issue.triage;

  const classificationColors = {
    CRITICAL_BUG: 'bg-red-500/15 text-red-400 border-red-500/30',
    BUG: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    FEATURE_REQUEST: 'bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] border-[hsl(217,91%,60%,0.3)]',
    QUESTION: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    DOCS: 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border-[hsl(142,70%,45%,0.3)]',
    NEEDS_INFO: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    DUPLICATE: 'bg-[hsl(220,13%,30%,0.3)] text-[hsl(210,11%,55%)] border-[hsl(220,13%,30%)]',
    SPAM: 'bg-pink-500/15 text-pink-400 border-pink-500/30'
  };

  return (
    <div
      data-testid={`issue-card-${issue.number}`}
      onClick={() => setSelectedIssue(issue)}
      className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-5 hover:border-[hsl(142,70%,45%,0.4)] transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Issue Title */}
          <div className="flex items-center gap-2 mb-2">
            {issue.isPR && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded text-xs font-medium">
                <GitPullRequest className="w-3 h-3" />
                PR
              </span>
            )}
            <h3 className="text-base font-medium text-[hsl(210,11%,90%)] line-clamp-1">
              #{issue.number} {issue.title}
            </h3>
          </div>

          {/* Issue Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(210,11%,50%)] mb-3">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>{issue.authorName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              <span className="text-[hsl(217,91%,65%)]">{issue.repoName}</span>
            </div>
          </div>

          {/* Triage Summary */}
          {triage && (
            <p className="text-sm text-[hsl(210,11%,55%)] line-clamp-2">{triage.summary}</p>
          )}
        </div>

        {/* Classification Badge */}
        {triage && (
          <div
            className={`px-3 py-1.5 rounded-md border text-sm font-medium whitespace-nowrap ${classificationColors[triage.classification] || classificationColors.NEEDS_INFO
              }`}
          >
            {triage.classification.replace('_', ' ')}
          </div>
        )}
      </div>
    </div>
  );
};

export default IssueCard;