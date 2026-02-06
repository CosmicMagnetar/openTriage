import { useState } from 'react';
import { Calendar, CheckCircle2, Clock, AlertCircle, MessageSquare, ExternalLink, GitPullRequest, Eye, EyeOff } from 'lucide-react';
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

  // Get review status for PRs
  const getReviewStatus = () => {
    if (!issue.isPR) return null;

    const reviewStatus = issue.reviewStatus || issue.review_status;

    if (reviewStatus === 'approved' || reviewStatus === 'submitted') {
      return {
        text: 'Review Submitted',
        icon: Eye,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      };
    }

    if (reviewStatus === 'pending' || reviewStatus === 'changes_requested') {
      return {
        text: 'Review Pending',
        icon: Clock,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      };
    }

    // Default: needs review
    return {
      text: 'Needs Review',
      icon: EyeOff,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    };
  };

  const status = getStatus();
  const StatusIcon = status.icon;
  const reviewStatus = getReviewStatus();

  return (
    <>
      <div
        data-testid={`participant-issue-${issue.number}`}
        className="bg-[hsl(220,13%,8%)] backdrop-blur-sm border border-[hsl(220,13%,15%)] rounded-xl p-6 hover:border-[hsl(142,70%,50%)] hover:scale-[1.01] transition-all duration-300"
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Type Badge + Review Status */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {issue.isPR ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <GitPullRequest className="w-3 h-3" />
                  PR
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] border border-[hsl(217,91%,60%,0.25)]">
                  Issue
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${issue.state === 'open'
                ? 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.25)]'
                : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,50%)] border border-[hsl(220,13%,20%)]'
                }`}>
                {issue.state}
              </span>

              {/* Review Status Badge for PRs */}
              {reviewStatus && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${reviewStatus.color}`}>
                  <reviewStatus.icon className="w-3 h-3" />
                  {reviewStatus.text}
                </span>
              )}
            </div>

            {/* Issue Title */}
            <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-2">
              #{issue.number} {issue.title}
            </h3>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-sm text-[hsl(210,11%,50%)] mb-4">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Submitted {new Date(issue.createdAt).toLocaleDateString()}</span>
              </div>
              <span className="text-[hsl(142,70%,55%)]">{issue.repoName}</span>
            </div>

            {/* Plain English Status */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${status.color}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{status.text}</span>
            </div>

            {/* AI Summary */}
            {triage && (
              <div className="mt-4 pt-4 border-t border-[hsl(220,13%,15%)]">
                <p className="text-sm text-[hsl(210,11%,50%)]">
                  <span className="font-medium text-[hsl(210,11%,75%)]">Summary:</span> {triage.summary}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {/* Show Review button for PRs that need review */}
            {issue.isPR && reviewStatus?.text === 'Needs Review' && (
              <a
                href={`${issue.htmlUrl}/files`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all"
              >
                <Eye className="w-4 h-4" />
                Review
              </a>
            )}
            <button
              onClick={() => setShowReplyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black rounded-lg text-sm font-medium transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              Reply
            </button>
            <a
              href={issue.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,18%)] text-[hsl(210,11%,75%)] rounded-lg text-sm font-medium transition-all border border-[hsl(220,13%,18%)]"
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