import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const ParticipantIssueCard = ({ issue }) => {
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
    <div
      data-testid={`participant-issue-${issue.number}`}
      className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-emerald-400 hover:scale-[1.01] transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
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
      </div>
    </div>
  );
};

export default ParticipantIssueCard;