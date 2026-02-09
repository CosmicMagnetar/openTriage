import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Tag, ThumbsUp, ThumbsDown, ExternalLink, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

import useIssueDetail from '../../../hooks/useIssueDetail';
import { mergePullRequest, closeIssueOrPR } from '../../../services/githubService';

import IssueDetailHeader from './IssueDetailHeader';
import ConversationThread from './ConversationThread';
import ReplyComposer from './ReplyComposer';
import MaintainerLeaderboardWidget from './MaintainerLeaderboardWidget';
import ResourceSharingWidget from './ResourceSharingWidget';
import MetadataWidget from './MetadataWidget';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * IssueDetailPage — Dedicated full-page view for Issue/PR details.
 *
 * Route: /dashboard/issue/:issueId
 *
 * Layout (sits right of the global Sidebar):
 *   ┌──────────────────────────────────────────────┐
 *   │  Sticky Header (breadcrumbs + actions)       │
 *   ├───────────────────────┬──────────────────────┤
 *   │  Main Column (70%)    │  Side Column (30%)   │
 *   │  - Title & Status     │  - Leaderboard (AI)  │
 *   │  - Description        │  - Resources         │
 *   │  - AI Triage          │  - Metadata          │
 *   │  - Conversation       │                      │
 *   │  - Reply Composer     │                      │
 *   └───────────────────────┴──────────────────────┘
 */
const IssueDetailPage = () => {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  const {
    issue,
    comments,
    loading,
    commentsLoading,
    error,
    refetchIssue,
    refetchComments,
  } = useIssueDetail(issueId);

  // ── Actions ──────────────────────────────────────────
  const handleMergePR = async () => {
    if (!issue?.isPR || !issue?.owner || !issue?.repo) return;
    if (!window.confirm(`Are you sure you want to merge PR #${issue.number}?`)) return;

    setProcessing(true);
    try {
      const userRes = await axios.get(`${API}/user/me`);
      const githubToken = userRes.data.githubAccessToken;
      if (!githubToken) {
        toast.error('GitHub token not found. Please reconnect your GitHub account.');
        return;
      }
      await mergePullRequest(githubToken, issue.owner, issue.repo, issue.number, 'merge');
      toast.success(`PR #${issue.number} merged successfully!`);
      refetchIssue();
    } catch (err) {
      console.error('Error merging PR:', err);
      toast.error(err.message || 'Failed to merge PR');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = async () => {
    if (!issue?.owner || !issue?.repo) return;
    const itemType = issue.isPR ? 'PR' : 'issue';
    if (!window.confirm(`Are you sure you want to close this ${itemType} #${issue.number}?`)) return;

    setProcessing(true);
    try {
      const userRes = await axios.get(`${API}/user/me`);
      const githubToken = userRes.data.githubAccessToken;
      if (!githubToken) {
        toast.error('GitHub token not found. Please reconnect your GitHub account.');
        return;
      }
      await closeIssueOrPR(githubToken, issue.owner, issue.repo, issue.number, issue.isPR);
      toast.success(`${itemType} #${issue.number} closed successfully!`);
      refetchIssue();
    } catch (err) {
      console.error(`Error closing ${issue.isPR ? 'PR' : 'issue'}:`, err);
      toast.error(err.message || `Failed to close ${itemType}`);
    } finally {
      setProcessing(false);
    }
  };

  // Assign a contributor from the ranking widget
  const handleAssign = async (username) => {
    if (!issue?.id || !username) return;
    try {
      await axios.post(`${API}/issues/${issue.id}/assign-multiple`, {
        assignees: [username],
      });
      toast.success(`${username} assigned to ${issue.isPR ? 'PR' : 'issue'} #${issue.number}`);
      refetchIssue();
    } catch (err) {
      console.error('Failed to assign:', err);
      toast.error(err.response?.data?.error || 'Failed to assign contributor');
    }
  };

  // ── Loading State ────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[hsl(220,13%,5%)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[hsl(217,91%,60%)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[hsl(210,11%,50%)]">Loading issue details...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────
  if (error || !issue) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[hsl(220,13%,5%)]">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[hsl(210,11%,85%)] mb-2">
            {error || 'Issue not found'}
          </h2>
          <p className="text-sm text-[hsl(210,11%,50%)] mb-4">
            The issue you're looking for could not be loaded.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] text-white rounded-lg text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const triage = issue.triage;
  const sentimentColors = {
    POSITIVE: 'text-[hsl(142,70%,55%)]',
    NEUTRAL: 'text-[hsl(217,91%,65%)]',
    NEGATIVE: 'text-orange-400',
    FRUSTRATED: 'text-red-400',
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-[hsl(220,13%,5%)] h-screen overflow-hidden">
      {/* Sticky Header */}
      <IssueDetailHeader
        issue={issue}
        onMerge={handleMergePR}
        onClose={handleClose}
        processing={processing}
      />

      {/* 2-Column Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Main Column (70%) ──────────────────────── */}
        <div className="w-[70%] flex flex-col overflow-hidden border-r border-[hsl(220,13%,14%)]">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Title & Status */}
            <div>
              <div className="flex items-start gap-3 mb-2">
                {issue.isPR && (
                  <span className="mt-1 flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded text-xs font-medium shrink-0">
                    PR
                  </span>
                )}
                <h1 className="text-xl font-semibold text-[hsl(210,11%,93%)] leading-snug">
                  {issue.title}
                </h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-[hsl(210,11%,50%)]">
                <span>#{issue.number}</span>
                <span>·</span>
                <span>{issue.authorName || 'Unknown'}</span>
                <span>·</span>
                <span>{new Date(issue.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {issue.htmlUrl && (
                  <>
                    <span>·</span>
                    <a
                      href={issue.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[hsl(217,91%,65%)] hover:text-[hsl(217,91%,75%)] flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      GitHub
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xs font-medium text-[hsl(210,11%,45%)] uppercase tracking-wider mb-2">
                Description
              </h3>
              <div className="bg-[hsl(220,13%,7%)] border border-[hsl(220,13%,13%)] rounded-lg p-4">
                <p className="text-sm text-[hsl(210,11%,70%)] leading-relaxed whitespace-pre-wrap">
                  {issue.body || 'No description provided.'}
                </p>
              </div>
            </div>

            {/* AI Triage Analysis */}
            {triage && (
              <div className="bg-[hsl(217,91%,60%,0.06)] border border-[hsl(217,91%,60%,0.15)] rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-[hsl(217,91%,65%)] flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  AI Triage Analysis
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-1">Classification</p>
                    <p className="text-sm font-medium text-[hsl(217,91%,70%)]">
                      {triage.classification?.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-1">Suggested Label</p>
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[hsl(217,91%,65%)]" />
                      <span className="text-sm text-[hsl(217,91%,70%)]">{triage.suggestedLabel}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-1">Sentiment</p>
                    <div className="flex items-center gap-1">
                      {triage.sentiment === 'POSITIVE' || triage.sentiment === 'NEUTRAL' ? (
                        <ThumbsUp className={`w-3.5 h-3.5 ${sentimentColors[triage.sentiment]}`} />
                      ) : (
                        <ThumbsDown className={`w-3.5 h-3.5 ${sentimentColors[triage.sentiment]}`} />
                      )}
                      <span className={`text-sm font-medium ${sentimentColors[triage.sentiment]}`}>
                        {triage.sentiment}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[hsl(210,11%,40%)] mb-1">Summary</p>
                  <p className="text-sm text-[hsl(210,11%,75%)] leading-relaxed">{triage.summary}</p>
                </div>
              </div>
            )}

            {/* Conversation Thread */}
            <ConversationThread
              comments={comments}
              loading={commentsLoading}
              onRefresh={refetchComments}
            />
          </div>

          {/* Reply Composer (pinned to bottom of main column) */}
          <ReplyComposer
            issue={issue}
            comments={comments}
            onReplySent={refetchComments}
          />
        </div>

        {/* ── Side Column (30%) — sticky sidebar ────── */}
        <div className="w-[30%] overflow-y-auto p-5 space-y-4 custom-scrollbar">
          <MaintainerLeaderboardWidget issue={issue} onAssign={handleAssign} />
          <ResourceSharingWidget issue={issue} />
          <MetadataWidget issue={issue} />
        </div>
      </div>
    </div>
  );
};

export default IssueDetailPage;
