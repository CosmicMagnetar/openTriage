import { useState, useEffect, useCallback } from 'react';
import { 
    GitPullRequest, 
    FileCode, 
    MessageSquare, 
    ChevronDown, 
    ChevronRight,
    Plus,
    Minus,
    X,
    Send,
    RefreshCw,
    ExternalLink,
    Loader2,
    Check,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../stores/authStore';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * PRReviewInterface Component
 * 
 * In-app code review interface for viewing PR diffs and adding comments.
 */
const PRReviewInterface = ({ pr, onClose }) => {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [files, setFiles] = useState([]);
    const [expandedFiles, setExpandedFiles] = useState(new Set());
    const [comments, setComments] = useState([]);
    const [pendingComments, setPendingComments] = useState([]);
    const [reviewBody, setReviewBody] = useState('');
    const [reviewType, setReviewType] = useState('COMMENT'); // COMMENT, APPROVE, REQUEST_CHANGES
    const [activeCommentLine, setActiveCommentLine] = useState(null);
    const [newCommentText, setNewCommentText] = useState('');
    const [aiSuggesting, setAiSuggesting] = useState(false);

    useEffect(() => {
        if (pr) {
            loadPRDetails();
        }
    }, [pr]);

    const loadPRDetails = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            
            // Fetch PR files and diff
            const [filesRes, commentsRes] = await Promise.all([
                fetch(`${API_BASE}/api/github/pr/${pr.owner}/${pr.repo}/${pr.number}/files`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/api/github/pr/${pr.owner}/${pr.repo}/${pr.number}/comments`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (!filesRes.ok || !commentsRes.ok) {
                throw new Error('Failed to load PR details');
            }

            const filesData = await filesRes.json();
            const commentsData = await commentsRes.json();

            setFiles(filesData.files || []);
            setComments(commentsData.comments || []);
            
            // Auto-expand first few files
            const initialExpanded = new Set(
                (filesData.files || []).slice(0, 3).map((_, idx) => idx)
            );
            setExpandedFiles(initialExpanded);
        } catch (error) {
            console.error('Failed to load PR details:', error);
            toast.error('Failed to load PR details');
        } finally {
            setLoading(false);
        }
    };

    const toggleFile = (index) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const addPendingComment = (fileIndex, lineNumber, side) => {
        if (!newCommentText.trim()) {
            toast.error('Please enter a comment');
            return;
        }

        const file = files[fileIndex];
        const newComment = {
            id: `pending-${Date.now()}`,
            path: file.filename,
            line: lineNumber,
            side: side,
            body: newCommentText,
            pending: true,
        };

        setPendingComments(prev => [...prev, newComment]);
        setNewCommentText('');
        setActiveCommentLine(null);
        toast.success('Comment added to review');
    };

    const removePendingComment = (commentId) => {
        setPendingComments(prev => prev.filter(c => c.id !== commentId));
    };

    const getAISuggestion = async (fileIndex, lineNumber, codeContext) => {
        setAiSuggesting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/api/ai/review-suggestion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    code: codeContext,
                    filename: files[fileIndex]?.filename,
                    language: getLanguageFromFilename(files[fileIndex]?.filename)
                })
            });

            if (!response.ok) throw new Error('AI suggestion failed');
            
            const data = await response.json();
            setNewCommentText(data.suggestion || '');
            toast.success('AI suggestion generated');
        } catch (error) {
            console.error('AI suggestion error:', error);
            toast.error('Failed to get AI suggestion');
        } finally {
            setAiSuggesting(false);
        }
    };

    const submitReview = async () => {
        if (pendingComments.length === 0 && !reviewBody.trim()) {
            toast.error('Please add comments or a review summary');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/api/github/pr/${pr.owner}/${pr.repo}/${pr.number}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    body: reviewBody,
                    event: reviewType,
                    comments: pendingComments.map(c => ({
                        path: c.path,
                        line: c.line,
                        side: c.side || 'RIGHT',
                        body: c.body,
                    }))
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to submit review');
            }

            toast.success('Review submitted successfully!');
            setPendingComments([]);
            setReviewBody('');
            loadPRDetails(); // Refresh to show new comments
        } catch (error) {
            console.error('Submit review error:', error);
            toast.error(error.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const getLanguageFromFilename = (filename) => {
        if (!filename) return 'text';
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap = {
            js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
            py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
            cpp: 'cpp', c: 'c', cs: 'csharp', php: 'php', swift: 'swift',
            kt: 'kotlin', scala: 'scala', md: 'markdown', json: 'json',
            yml: 'yaml', yaml: 'yaml', css: 'css', scss: 'scss', html: 'html',
        };
        return langMap[ext] || 'text';
    };

    if (!pr) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[hsl(220,13%,15%)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <GitPullRequest className="w-5 h-5 text-purple-400" />
                        <div>
                            <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">
                                {pr.title}
                            </h2>
                            <p className="text-sm text-[hsl(210,11%,50%)]">
                                #{pr.number} · {pr.owner}/{pr.repo}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href={pr.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,80%)] hover:bg-[hsl(220,13%,12%)] rounded-lg transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            View on GitHub
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,80%)] hover:bg-[hsl(220,13%,12%)] rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Files Panel */}
                    <div className="flex-1 overflow-y-auto border-r border-[hsl(220,13%,15%)]">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[hsl(142,70%,45%)]" />
                            </div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-12 text-[hsl(210,11%,50%)]">
                                No files changed in this PR
                            </div>
                        ) : (
                            <div className="divide-y divide-[hsl(220,13%,12%)]">
                                {files.map((file, fileIndex) => (
                                    <FileSection
                                        key={file.filename}
                                        file={file}
                                        fileIndex={fileIndex}
                                        expanded={expandedFiles.has(fileIndex)}
                                        onToggle={() => toggleFile(fileIndex)}
                                        comments={[
                                            ...comments.filter(c => c.path === file.filename),
                                            ...pendingComments.filter(c => c.path === file.filename)
                                        ]}
                                        activeCommentLine={activeCommentLine}
                                        setActiveCommentLine={setActiveCommentLine}
                                        newCommentText={newCommentText}
                                        setNewCommentText={setNewCommentText}
                                        onAddComment={(line, side) => addPendingComment(fileIndex, line, side)}
                                        onRemovePendingComment={removePendingComment}
                                        onGetAISuggestion={(line, context) => getAISuggestion(fileIndex, line, context)}
                                        aiSuggesting={aiSuggesting}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Review Panel */}
                    <div className="w-80 flex flex-col shrink-0 bg-[hsl(220,13%,6%)]">
                        <div className="p-4 border-b border-[hsl(220,13%,15%)]">
                            <h3 className="text-sm font-medium text-[hsl(210,11%,90%)] mb-3">
                                Review Summary
                            </h3>
                            <textarea
                                value={reviewBody}
                                onChange={(e) => setReviewBody(e.target.value)}
                                placeholder="Leave a review comment..."
                                className="w-full h-24 px-3 py-2 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg text-sm text-[hsl(210,11%,90%)] placeholder-[hsl(210,11%,40%)] resize-none focus:outline-none focus:border-[hsl(142,70%,45%)]"
                            />
                        </div>

                        {/* Pending Comments */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <h4 className="text-xs font-medium text-[hsl(210,11%,50%)] mb-2">
                                Pending Comments ({pendingComments.length})
                            </h4>
                            {pendingComments.length === 0 ? (
                                <p className="text-xs text-[hsl(210,11%,40%)]">
                                    Click on a line number to add comments
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {pendingComments.map(comment => (
                                        <div
                                            key={comment.id}
                                            className="bg-[hsl(220,13%,10%)] rounded-lg p-3 border border-[hsl(220,13%,18%)]"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-[hsl(210,11%,50%)] truncate">
                                                        {comment.path}:{comment.line}
                                                    </p>
                                                    <p className="text-sm text-[hsl(210,11%,80%)] mt-1">
                                                        {comment.body}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removePendingComment(comment.id)}
                                                    className="p-1 text-[hsl(210,11%,40%)] hover:text-red-400"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit Section */}
                        <div className="p-4 border-t border-[hsl(220,13%,15%)]">
                            <div className="flex gap-2 mb-3">
                                {[
                                    { value: 'COMMENT', label: 'Comment', icon: MessageSquare, color: 'blue' },
                                    { value: 'APPROVE', label: 'Approve', icon: Check, color: 'green' },
                                    { value: 'REQUEST_CHANGES', label: 'Request Changes', icon: AlertCircle, color: 'red' },
                                ].map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => setReviewType(option.value)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg transition-colors ${
                                            reviewType === option.value
                                                ? option.color === 'green' 
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : option.color === 'red'
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,50%)] border border-transparent hover:bg-[hsl(220,13%,12%)]'
                                        }`}
                                    >
                                        <option.icon className="w-3 h-3" />
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={submitReview}
                                disabled={submitting || (pendingComments.length === 0 && !reviewBody.trim())}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                Submit Review
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FileSection = ({
    file,
    fileIndex,
    expanded,
    onToggle,
    comments,
    activeCommentLine,
    setActiveCommentLine,
    newCommentText,
    setNewCommentText,
    onAddComment,
    onRemovePendingComment,
    onGetAISuggestion,
    aiSuggesting
}) => {
    const lines = file.patch ? file.patch.split('\n') : [];
    const fileComments = comments || [];

    const getLineInfo = (line) => {
        if (line.startsWith('+')) return { type: 'addition', color: 'bg-green-500/20 text-green-400' };
        if (line.startsWith('-')) return { type: 'deletion', color: 'bg-red-500/20 text-red-400' };
        if (line.startsWith('@@')) return { type: 'hunk', color: 'bg-blue-500/20 text-blue-400' };
        return { type: 'context', color: '' };
    };

    const getLineNumber = (lineIndex) => {
        // Simple line number tracking (for demo; real impl would parse @@ hunks)
        let addLine = 1, delLine = 1;
        for (let i = 0; i < lineIndex; i++) {
            const line = lines[i];
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
                if (match) {
                    delLine = parseInt(match[1]);
                    addLine = parseInt(match[2]);
                }
            } else if (line.startsWith('+')) {
                addLine++;
            } else if (line.startsWith('-')) {
                delLine++;
            } else {
                addLine++;
                delLine++;
            }
        }
        return { addLine, delLine };
    };

    return (
        <div className="border-b border-[hsl(220,13%,12%)] last:border-b-0">
            {/* File Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[hsl(220,13%,10%)] transition-colors"
            >
                {expanded ? (
                    <ChevronDown className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                )}
                <FileCode className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                <span className="text-sm text-[hsl(210,11%,80%)] flex-1 text-left truncate">
                    {file.filename}
                </span>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-400">+{file.additions}</span>
                    <span className="text-red-400">-{file.deletions}</span>
                </div>
            </button>

            {/* File Content */}
            {expanded && (
                <div className="bg-[hsl(220,13%,6%)] overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                        <tbody>
                            {lines.map((line, lineIndex) => {
                                const { type, color } = getLineInfo(line);
                                const lineNum = getLineNumber(lineIndex);
                                const lineKey = `${fileIndex}-${lineIndex}`;
                                const lineComments = fileComments.filter(c => c.line === lineNum.addLine);
                                const isActiveComment = activeCommentLine?.fileIndex === fileIndex && activeCommentLine?.line === lineIndex;

                                return (
                                    <tr key={lineIndex} className="group">
                                        {/* Line Number */}
                                        <td className="w-12 px-2 py-0.5 text-right text-[hsl(210,11%,35%)] select-none border-r border-[hsl(220,13%,15%)]">
                                            {type !== 'hunk' && type !== 'deletion' && (
                                                <button
                                                    onClick={() => setActiveCommentLine({ fileIndex, line: lineIndex, lineNum: lineNum.addLine })}
                                                    className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300"
                                                    title="Add comment"
                                                >
                                                    +
                                                </button>
                                            )}
                                        </td>
                                        {/* Line Content */}
                                        <td className={`px-4 py-0.5 whitespace-pre ${color}`}>
                                            {line}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Inline Comment Form */}
                    {activeCommentLine?.fileIndex === fileIndex && (
                        <div className="border-t border-[hsl(220,13%,15%)] p-3 bg-[hsl(220,13%,8%)]">
                            <div className="flex gap-2">
                                <textarea
                                    value={newCommentText}
                                    onChange={(e) => setNewCommentText(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="flex-1 px-3 py-2 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg text-sm text-[hsl(210,11%,90%)] placeholder-[hsl(210,11%,40%)] resize-none focus:outline-none focus:border-[hsl(142,70%,45%)]"
                                    rows={2}
                                    autoFocus
                                />
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <button
                                    onClick={() => {
                                        const context = lines.slice(
                                            Math.max(0, activeCommentLine.line - 3),
                                            activeCommentLine.line + 4
                                        ).join('\n');
                                        onGetAISuggestion(activeCommentLine.lineNum, context);
                                    }}
                                    disabled={aiSuggesting}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {aiSuggesting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <MessageSquare className="w-3 h-3" />
                                    )}
                                    AI Suggest
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveCommentLine(null)}
                                        className="px-3 py-1.5 text-xs text-[hsl(210,11%,50%)] hover:bg-[hsl(220,13%,12%)] rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => onAddComment(activeCommentLine.lineNum, 'RIGHT')}
                                        disabled={!newCommentText.trim()}
                                        className="px-3 py-1.5 text-xs bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Add Comment
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Existing Comments */}
                    {fileComments.length > 0 && (
                        <div className="border-t border-[hsl(220,13%,15%)] p-3 space-y-2">
                            {fileComments.map((comment, idx) => (
                                <div
                                    key={comment.id || idx}
                                    className={`p-3 rounded-lg ${
                                        comment.pending 
                                            ? 'bg-yellow-500/10 border border-yellow-500/20' 
                                            : 'bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)]'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            {comment.user && (
                                                <p className="text-xs text-[hsl(210,11%,50%)] mb-1">
                                                    {comment.user.login} · Line {comment.line}
                                                </p>
                                            )}
                                            {comment.pending && (
                                                <p className="text-xs text-yellow-400 mb-1">
                                                    Pending · Line {comment.line}
                                                </p>
                                            )}
                                            <p className="text-sm text-[hsl(210,11%,80%)]">
                                                {comment.body}
                                            </p>
                                        </div>
                                        {comment.pending && (
                                            <button
                                                onClick={() => onRemovePendingComment(comment.id)}
                                                className="p-1 text-[hsl(210,11%,40%)] hover:text-red-400"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PRReviewInterface;
