import { Calendar, User, Tag } from 'lucide-react';
import useIssueStore from '../../stores/issueStore';

const IssueCard = ({ issue }) => {
  const { setSelectedIssue } = useIssueStore();
  const triage = issue.triage;

  const classificationColors = {
    CRITICAL_BUG: 'bg-red-500/20 text-red-400 border-red-500/30',
    BUG: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    FEATURE_REQUEST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    QUESTION: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    DOCS: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    NEEDS_INFO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    DUPLICATE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    SPAM: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
  };

  return (
    <div
      data-testid={`issue-card-${issue.number}`}
      onClick={() => setSelectedIssue(issue)}
      className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-blue-500 hover:scale-[1.01] transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Issue Title */}
          <div className="flex items-center gap-2 mb-2">
            {issue.isPR && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-xs font-medium">
                PR
              </span>
            )}
            <h3 className="text-lg font-semibold text-slate-200 line-clamp-1">
              #{issue.number} {issue.title}
            </h3>
          </div>

          {/* Issue Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mb-3">
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
              <span className="text-blue-400">{issue.repoName}</span>
            </div>
          </div>

          {/* Triage Summary */}
          {triage && (
            <p className="text-sm text-slate-400 line-clamp-2">{triage.summary}</p>
          )}
        </div>

        {/* Classification Badge */}
        {triage && (
          <div
            className={`px-4 py-2 rounded-lg border font-medium text-sm whitespace-nowrap ${classificationColors[triage.classification] || classificationColors.NEEDS_INFO
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