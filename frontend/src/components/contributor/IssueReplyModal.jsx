import { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Loader2, MessageSquare, Sparkles, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const IssueReplyModal = ({ issue, onClose, onReplySent }) => {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [message, setMessage] = useState('');
    const [suggestionType, setSuggestionType] = useState('clarify');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadComments();
    }, [issue.id]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API}/contributor/issues/${issue.id}/comments`);
            setComments(response.data.comments || []);
        } catch (error) {
            console.error('Error loading comments:', error);
            toast.error('Failed to load comments');
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!message.trim() || sending) return;

        setSending(true);
        try {
            await axios.post(`${API}/contributor/action/reply`, {
                issueId: issue.id,
                message: message.trim()
            });
            toast.success('Reply posted successfully!');
            setMessage('');
            loadComments(); // Refresh comments
            if (onReplySent) onReplySent();
        } catch (error) {
            console.error('Error sending reply:', error);
            toast.error(error.response?.data?.detail || 'Failed to send reply');
        } finally {
            setSending(false);
        }
    };

    const handleAISuggest = async () => {
        if (suggesting) return;

        setSuggesting(true);
        try {
            // Get recent comment context
            const recentContext = comments.slice(-3)
                .map(c => `${c.user?.login || 'Unknown'}: ${c.body?.slice(0, 300) || ''}`)
                .join('\n');

            const response = await axios.post(`${API}/contributor/suggest-reply`, {
                issueTitle: issue.title,
                issueBody: issue.body || '',
                context: recentContext || 'No previous comments',
                suggestionType: suggestionType
            });

            setMessage(response.data.suggestion || '');
            toast.success('AI suggestion generated!');
        } catch (error) {
            console.error('Error getting AI suggestion:', error);
            toast.error('Failed to generate suggestion');
        } finally {
            setSuggesting(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-blue-500/10">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                #{issue.number}
                            </span>
                            <span className="text-xs text-slate-400">{issue.repoName}</span>
                        </div>
                        <h2 className="text-lg font-bold text-slate-200 truncate">{issue.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors ml-4"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Comments Area */}
                <div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-900/50">
                    {/* Original Issue */}
                    <div className="bg-slate-800/80 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <span className="text-sm font-medium text-slate-200">{issue.authorName}</span>
                                <span className="text-xs text-slate-500 ml-2">Author</span>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">
                            {issue.body || 'No description provided.'}
                        </p>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                            <span className="ml-2 text-slate-400">Loading comments...</span>
                        </div>
                    )}

                    {/* Comments */}
                    {!loading && comments.length === 0 && (
                        <div className="text-center py-8">
                            <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-400">No comments yet. Be the first to reply!</p>
                        </div>
                    )}

                    {comments.map((comment, index) => (
                        <div
                            key={comment.id || index}
                            className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <img
                                    src={comment.user?.avatar_url || 'https://github.com/identicons/default.png'}
                                    alt={comment.user?.login}
                                    className="w-8 h-8 rounded-full"
                                />
                                <div className="flex-1">
                                    <span className="text-sm font-medium text-slate-200">
                                        {comment.user?.login || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-slate-500 ml-2">
                                        {formatDate(comment.created_at)}
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{comment.body}</p>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Reply Input */}
                <div className="p-4 border-t border-slate-700 bg-slate-800 space-y-3">
                    {/* AI Suggestion Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">AI Assist:</span>
                        <select
                            value={suggestionType}
                            onChange={(e) => setSuggestionType(e.target.value)}
                            className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="clarify">Clarify</option>
                            <option value="update">Give Update</option>
                            <option value="thank">Thank Maintainer</option>
                            <option value="question">Ask Question</option>
                        </select>
                        <button
                            onClick={handleAISuggest}
                            disabled={suggesting}
                            className="flex items-center gap-1 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                            {suggesting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Sparkles className="w-3 h-3" />
                            )}
                            {suggesting ? 'Generating...' : 'Suggest Reply'}
                        </button>
                    </div>

                    {/* Text Input with Inline AI Suggestions */}
                    <div className="flex gap-2">
                        <AISuggestTextarea
                            value={message}
                            onChange={setMessage}
                            contextType="contributor_reply"
                            placeholder="Write your reply... (AI suggestions appear after a pause)"
                            disabled={sending}
                            rows={3}
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none disabled:opacity-50"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={loadComments}
                            disabled={loading}
                            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <div className="flex gap-2">
                            <a
                                href={issue.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-emerald-400 hover:text-emerald-300 px-4 py-2 transition-colors"
                            >
                                View on GitHub
                            </a>
                            <button
                                onClick={handleSend}
                                disabled={!message.trim() || sending}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                {sending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                {sending ? 'Sending...' : 'Send Reply'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IssueReplyModal;
