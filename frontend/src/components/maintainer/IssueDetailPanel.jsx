import { X, Tag, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import useIssueStore from '../../stores/issueStore';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const IssueDetailPanel = () => {
  const { selectedIssue, clearSelectedIssue } = useIssueStore();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  if (!selectedIssue) return null;

  const triage = selectedIssue.triage;

  const handleReply = async () => {
    if (!reply.trim()) return;

    setSending(true);
    try {
      await axios.post(`${API}/maintainer/action/reply`, {
        issueId: selectedIssue.id,
        message: reply
      });
      toast.success('Reply sent successfully (mock)');
      setReply('');
    } catch (error) {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const sentimentColors = {
    POSITIVE: 'text-emerald-400',
    NEUTRAL: 'text-blue-400',
    NEGATIVE: 'text-orange-400',
    FRUSTRATED: 'text-red-400'
  };

  return (
    <div
      data-testid="issue-detail-panel"
      className="w-[400px] h-full bg-slate-800/90 backdrop-blur-sm border-l border-slate-700 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-700 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-200 mb-1">
            Issue #{selectedIssue.number}
          </h2>
          <p className="text-sm text-slate-400">{selectedIssue.repoName}</p>
        </div>
        <button
          data-testid="close-panel-button"
          onClick={clearSelectedIssue}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Title */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Title</h3>
          <p className="text-slate-200">{selectedIssue.title}</p>
        </div>

        {/* Body */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Description</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            {selectedIssue.body || 'No description provided'}
          </p>
        </div>

        {/* AI Triage */}
        {triage && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              AI Triage Analysis
            </h3>

            <div>
              <p className="text-xs text-slate-400 mb-1">Classification</p>
              <p className="text-sm font-medium text-blue-300">
                {triage.classification.replace('_', ' ')}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Summary</p>
              <p className="text-sm text-slate-300">{triage.summary}</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Suggested Label</p>
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm text-blue-300">{triage.suggestedLabel}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Sentiment</p>
                <div className="flex items-center gap-1.5">
                  {triage.sentiment === 'POSITIVE' || triage.sentiment === 'NEUTRAL' ? (
                    <ThumbsUp className={`w-3.5 h-3.5 ${sentimentColors[triage.sentiment]}`} />
                  ) : (
                    <ThumbsDown className={`w-3.5 h-3.5 ${sentimentColors[triage.sentiment]}`} />
                  )}
                  <span className={`text-sm ${sentimentColors[triage.sentiment]}`}>
                    {triage.sentiment}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Reply */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Quick Reply
          </h3>
          <textarea
            data-testid="reply-textarea"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply..."
            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            rows={4}
          />
          <button
            data-testid="send-reply-button"
            onClick={handleReply}
            disabled={!reply.trim() || sending}
            className="mt-3 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 active:scale-[0.98]"
          >
            {sending ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssueDetailPanel;