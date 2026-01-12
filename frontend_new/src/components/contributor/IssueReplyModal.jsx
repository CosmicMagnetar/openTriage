import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const IssueReplyModal = ({ issue, onClose, onReplySent }) => {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');
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
            toast.success('Reply posted');
            setMessage('');
            loadComments();
            if (onReplySent) onReplySent();
        } catch (error) {
            console.error('Error sending reply:', error);
            toast.error(error.response?.data?.detail || 'Failed to send reply');
        } finally {
            setSending(false);
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
                {/* Header - Clean */}
                <div className="px-5 py-4 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-[hsl(210,11%,50%)]">#{issue.number}</span>
                            <span className="text-xs text-[hsl(210,11%,40%)]">·</span>
                            <span className="text-xs text-[hsl(210,11%,50%)]">{issue.repoName}</span>
                        </div>
                        <h2 className="text-base font-medium text-[hsl(210,11%,85%)] truncate">{issue.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] p-2 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Issue Body - If present */}
                {issue.body && (
                    <div className="px-5 py-3 border-b border-[hsl(220,13%,12%)]">
                        <p className="text-sm text-[hsl(210,11%,60%)] line-clamp-3">{issue.body}</p>
                    </div>
                )}

                {/* Comments */}
                <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 text-[hsl(210,11%,40%)] animate-spin" />
                        </div>
                    )}

                    {!loading && comments.length === 0 && (
                        <div className="text-center py-8 text-[hsl(210,11%,40%)] text-sm">
                            No comments yet
                        </div>
                    )}

                    {comments.map((comment, idx) => (
                        <div key={idx} className="flex gap-3">
                            <img
                                src={comment.user?.avatar_url || 'https://github.com/ghost.png'}
                                alt={comment.user?.login}
                                className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-[hsl(210,11%,75%)]">
                                        {comment.user?.login || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-[hsl(210,11%,40%)]">
                                        {formatDate(comment.created_at)}
                                    </span>
                                </div>
                                <p className="text-sm text-[hsl(210,11%,65%)] whitespace-pre-wrap leading-relaxed">{comment.body}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Reply Input - Simple and clean */}
                <div className="px-5 py-4 border-t border-[hsl(220,13%,15%)] space-y-3">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write your reply..."
                        disabled={sending}
                        rows={3}
                        className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-3 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(220,13%,30%)] resize-none"
                    />

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <a
                            href={issue.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[hsl(210,11%,45%)] hover:text-[hsl(210,11%,65%)] flex items-center gap-1 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            View on GitHub
                        </a>
                        <button
                            onClick={handleSend}
                            disabled={!message.trim() || sending}
                            className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-black px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            {sending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IssueReplyModal;
