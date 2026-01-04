import { useState } from 'react';
import { Calendar, CheckCircle2, Clock, AlertCircle, MessageSquare, ExternalLink, GitPullRequest } from 'lucide-react';
import IssueReplyModal from './IssueReplyModal';

const ParticipantIssueCard = ({ issue }) => {
  const [showReplyModal, setShowReplyModal] = useState(false);
  const triage = issue.triage;

  const getStatus = () => {
    if (!triage) {
      return {
        text: 'AI is analyzing your issue...',
        icon: Clock,
        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
      };
    }

    if (triage.classification === 'CRITICAL_BUG') {
      return {
        text: 'High priority - Team is reviewing',
        icon: AlertCircle,
        color: 'text-red-400 bg-red-500/10 border-red-500/30'
      };
    }

    if (triage.classification === 'BUG') {
      return {
        text: 'Bug confirmed - In triage queue',
        icon: CheckCircle2,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30'
      };
    }

    return {
      text: 'Triage complete - Waiting for maintainer',
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <>
      <div
        data-testid={`participant-issue-${issue.number}`}
        className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-emerald-400 hover:scale-[1.01] transition-all duration-300"
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Type Badge */}
            <div className="flex items-center gap-2 mb-2">
              {issue.isPR ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <GitPullRequest className="w-3 h-3" />
                  PR
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Issue
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${issue.state === 'open'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}>
                {issue.state}
              </span>
            </div>

            {/* Issue Title */}
            <h3 className="text-lg font-semibold text-slate-200 mb-2">
              #{issue.number} {issue.title}
            </h3>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Submitted {new Date(issue.createdAt).toLocaleDateString()}</span>
              </div>
              <span className="text-emerald-400">{issue.repoName}</span>
            </div>

            {/* Plain English Status */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${status.color}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{status.text}</span>
            </div>

            {/* AI Summary */}
            {triage && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  <span className="font-medium text-slate-300">Summary:</span> {triage.summary}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowReplyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              Reply
            </button>
            <a
              href={issue.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Reply Modal */}
      {showReplyModal && (
        <IssueReplyModal
          issue={issue}
          onClose={() => setShowReplyModal(false)}
          onReplySent={() => { }}
        />
      )}
    </>
  );
};

export default ParticipantIssueCard;