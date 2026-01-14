import { X, Tag, ThumbsUp, ThumbsDown, MessageSquare, RefreshCw, ExternalLink, Bot } from 'lucide-react';
import { useState, useEffect } from 'react';
import useIssueStore from '../../stores/issueStore';
import axios from 'axios';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const IssueDetailPanel = () => {
  const { selectedIssue, clearSelectedIssue } = useIssueStore();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/maintainer/templates`);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  useEffect(() => {
    if (selectedIssue?.id) {
      fetchComments();
    }
  }, [selectedIssue?.id]);

  const fetchComments = async () => {
    if (!selectedIssue?.owner || !selectedIssue?.repo) return;

    setLoadingComments(true);
    try {
      const response = await axios.get(`${API}/maintainer/issues/${selectedIssue.id}/comments`);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  if (!selectedIssue) return null;

  const triage = selectedIssue.triage;

  const handleReply = async () => {
    if (!reply.trim()) return;

    setSending(true);
    try {
      // Use simpler endpoint path for better compatibility
      const response = await axios.post(`${API}/issues/reply`, {
        // Send both: direct identifiers and issueId as fallback
        issueId: selectedIssue.id,
        owner: selectedIssue.owner,
        repo: selectedIssue.repo,
        number: selectedIssue.number,
        message: reply
      });

      if (response.data.commentUrl) {
        toast.success(
          <div>
            <p>Reply posted to GitHub!</p>
            <a
              href={response.data.commentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(217,91%,65%)] underline text-sm"
            >
              View on GitHub →
            </a>
          </div>
        );
      } else {
        toast.success('Reply posted successfully!');
      }

      setReply('');
      setSelectedTemplate('');
      fetchComments();
    } catch (error) {
      console.error('Reply error:', error);
      toast.error(error.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);

    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setReply(template.body);
      }
    } else {
      setReply('');
    }
  };

  const sentimentColors = {
    POSITIVE: 'text-[hsl(142,70%,55%)]',
    NEUTRAL: 'text-[hsl(217,91%,65%)]',
    NEGATIVE: 'text-orange-400',
    FRUSTRATED: 'text-red-400'
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={clearSelectedIssue}
    >
      <div
        data-testid="issue-detail-panel"
        className="w-full max-w-2xl max-h-[90vh] bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[hsl(220,13%,15%)] flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">
                Issue #{selectedIssue.number}
              </h2>
              {selectedIssue.htmlUrl && (
                <a
                  href={selectedIssue.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-sm text-[hsl(210,11%,50%)]">{selectedIssue.repoName}</p>
          </div>
          <button
            data-testid="close-panel-button"
            onClick={clearSelectedIssue}
            className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,12%)] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Title */}
          <div>
            <h3 className="text-xs font-medium text-[hsl(210,11%,45%)] uppercase tracking-wider mb-2">Title</h3>
            <p className="text-[hsl(210,11%,90%)]">{selectedIssue.title}</p>
          </div>

          {/* Body */}
          <div>
            <h3 className="text-xs font-medium text-[hsl(210,11%,45%)] uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm text-[hsl(210,11%,70%)] leading-relaxed bg-[hsl(220,13%,6%)] p-3 rounded-lg border border-[hsl(220,13%,12%)]">
              {selectedIssue.body || 'No description provided'}
            </p>
          </div>

          {/* AI Triage */}
          {triage && (
            <div className="bg-[hsl(217,91%,60%,0.08)] border border-[hsl(217,91%,60%,0.2)] rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-[hsl(217,91%,65%)] flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI Triage Analysis
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[hsl(210,11%,45%)] mb-1">Classification</p>
                  <p className="text-sm font-medium text-[hsl(217,91%,70%)]">
                    {triage.classification.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(210,11%,45%)] mb-1">Suggested Label</p>
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[hsl(217,91%,65%)]" />
                    <span className="text-sm text-[hsl(217,91%,70%)]">{triage.suggestedLabel}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-[hsl(210,11%,45%)] mb-1">Summary</p>
                <p className="text-sm text-[hsl(210,11%,75%)]">{triage.summary}</p>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-xs text-[hsl(210,11%,45%)]">Sentiment:</p>
                <div className="flex items-center gap-1">
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
          )}

          {/* Comments */}
          {(selectedIssue.owner && selectedIssue.repo) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-[hsl(210,11%,45%)] uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Conversation ({comments.length})
                </h3>
                <button
                  onClick={fetchComments}
                  disabled={loadingComments}
                  className="text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingComments ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {loadingComments ? (
                  <div className="text-center py-4 text-[hsl(210,11%,45%)] text-sm">
                    Loading comments...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-4 text-[hsl(210,11%,45%)] text-sm">
                    No comments yet. Be the first to reply!
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-[hsl(220,13%,6%)] border border-[hsl(220,13%,12%)] rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={comment.user?.avatar_url || 'https://github.com/ghost.png'}
                          alt={comment.user?.login || 'User'}
                          className="w-7 h-7 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-[hsl(210,11%,80%)]">
                              {comment.user?.login || 'Unknown'}
                            </span>
                            <span className="text-xs text-[hsl(210,11%,40%)]">
                              {new Date(comment.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-[hsl(210,11%,70%)] whitespace-pre-wrap break-words">
                            {comment.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Quick Reply */}
          <div>
            <h3 className="text-xs font-medium text-[hsl(210,11%,45%)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Quick Reply
            </h3>

            {templates.length > 0 && (
              <div className="mb-3">
                <select
                  value={selectedTemplate}
                  onChange={handleTemplateSelect}
                  className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors"
                >
                  <option value="">Select template (optional)</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <AISuggestTextarea
                data-testid="reply-textarea"
                value={reply}
                onChange={setReply}
                placeholder="Type your reply..."
                contextType="issue_reply"
                conversationHistory={comments.map(c => ({ sender: 'other', content: c.body }))}
                issueContext={{ title: selectedIssue.title, body: selectedIssue.body, repoName: selectedIssue.repoName }}
                className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg p-3 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors resize-none"
                rows={4}
              />
            </div>

            <button
              data-testid="send-reply-button"
              onClick={handleReply}
              disabled={!reply.trim() || sending}
              className="mt-3 w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-black px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {sending ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueDetailPanel;