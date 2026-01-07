import { X, Tag, ThumbsUp, ThumbsDown, MessageSquare, RefreshCw, Bot } from 'lucide-react';
import MaintainerAIChat from './MaintainerAIChat';
import { useState, useEffect } from 'react';
import useIssueStore from '../../stores/issueStore';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const IssueDetailPanel = () => {
  const { selectedIssue, clearSelectedIssue } = useIssueStore();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showAiChat, setShowAiChat] = useState(false);

  // Fetch templates on mount
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

  // Fetch comments when issue is selected
  useEffect(() => {
    if (selectedIssue?.id) {
      fetchComments();
    }
  }, [selectedIssue?.id]);

  const fetchComments = async () => {
    if (!selectedIssue?.owner || !selectedIssue?.repo) {
      // Issue doesn't have GitHub metadata, skip fetching
      return;
    }

    setLoadingComments(true);
    try {
      const response = await axios.get(`${API}/maintainer/issues/${selectedIssue.id}/comments`);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      // Don't show error toast, just fail silently
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
      const response = await axios.post(`${API}/maintainer/action/reply`, {
        issueId: selectedIssue.id,
        message: reply
      });

      // Show success with GitHub comment URL
      if (response.data.commentUrl) {
        toast.success(
          <div>
            <p>Reply posted to GitHub!</p>
            <a
              href={response.data.commentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-sm"
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
      // Refresh comments after posting
      fetchComments();
    } catch (error) {
      console.error('Reply error:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to send reply';
      toast.error(errorMessage);
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
    POSITIVE: 'text-emerald-400',
    NEUTRAL: 'text-blue-400',
    NEGATIVE: 'text-orange-400',
    FRUSTRATED: 'text-red-400'
  };

  return (
    // Popup Overlay/Backdrop
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={clearSelectedIssue}
    >
      {/* Popup Modal */}
      <div
        data-testid="issue-detail-panel"
        className="w-full max-w-2xl max-h-[90vh] bg-slate-800 border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-start justify-between bg-gradient-to-r from-slate-800 to-slate-800/80">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-200 mb-1">
              Issue #{selectedIssue.number}
            </h2>
            <p className="text-sm text-slate-400">{selectedIssue.repoName}</p>
          </div>
          <button
            data-testid="close-panel-button"
            onClick={clearSelectedIssue}
            className="text-slate-400 hover:text-slate-200 transition-colors p-2 hover:bg-slate-700 rounded-lg"
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

          {/* Chat Conversation */}
          {(selectedIssue.owner && selectedIssue.repo) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Conversation ({comments.length})
                </h3>
                <button
                  onClick={fetchComments}
                  disabled={loadingComments}
                  className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                  title="Refresh comments"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingComments ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {loadingComments ? (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    Loading comments...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    No comments yet. Be the first to reply!
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={comment.user?.avatar_url || 'https://github.com/ghost.png'}
                          alt={comment.user?.login || 'User'}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-300">
                              {comment.user?.login || 'Unknown'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(comment.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
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
            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Quick Reply
            </h3>

            {/* Template Selector */}
            {templates.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-slate-500 mb-1 block">
                  Use Template (optional)
                </label>
                <select
                  value={selectedTemplate}
                  onChange={handleTemplateSelect}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Manual Reply</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <textarea
                data-testid="reply-textarea"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-y min-h-[100px]"
                rows={4}
              />
              <button
                onClick={() => setShowAiChat(true)}
                className="absolute bottom-3 right-3 p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 rounded-lg transition-colors"
                title="Ask AI Assistant"
              >
                <Bot className="w-4 h-4" />
              </button>
            </div>
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

      {/* Maintainer AI Chat */}
      {showAiChat && (
        <MaintainerAIChat
          issue={selectedIssue}
          onClose={() => setShowAiChat(false)}
        />
      )}
    </div>
  );
};

export default IssueDetailPanel;