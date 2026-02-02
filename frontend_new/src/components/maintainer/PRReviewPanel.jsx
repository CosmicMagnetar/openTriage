import { useState, useEffect } from 'react';
import { Check, X, MessageSquare, FileCode, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import DiffViewer from './DiffViewer';
import { fetchPullRequestDiff, fetchPullRequestFiles, submitPullRequestReview } from '../../services/githubService';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * PRReviewPanel - Code review tab for PRs with diff viewing and review actions
 */
const PRReviewPanel = ({ pr, repoName }) => {
    const [diff, setDiff] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reviewBody, setReviewBody] = useState('');
    const [reviewEvent, setReviewEvent] = useState(null);
    const [showReviewForm, setShowReviewForm] = useState(false);

    useEffect(() => {
        if (pr && repoName) {
            loadDiff();
        }
    }, [pr?.id, repoName]);

    const loadDiff = async () => {
        if (!pr || !repoName) return;
        
        setLoading(true);
        try {
            const userRes = await axios.get(`${API}/user/me`);
            const githubToken = userRes.data.githubAccessToken;

            if (!githubToken) {
                toast.error('GitHub token not found. Please reconnect your account.');
                return;
            }

            const [owner, repo] = repoName.split('/');
            
            // Fetch both diff and files in parallel
            const [diffData, filesData] = await Promise.all([
                fetchPullRequestDiff(githubToken, owner, repo, pr.number),
                fetchPullRequestFiles(githubToken, owner, repo, pr.number)
            ]);

            setDiff(diffData);
            setFiles(filesData);
        } catch (error) {
            console.error('Failed to load diff:', error);
            toast.error('Failed to load PR diff');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitReview = async (event) => {
        if (!pr || !repoName) return;

        // If starting a review without a body, show the form
        if (!reviewBody.trim() && !showReviewForm) {
            setReviewEvent(event);
            setShowReviewForm(true);
            return;
        }

        setSubmitting(true);
        try {
            const userRes = await axios.get(`${API}/user/me`);
            const githubToken = userRes.data.githubAccessToken;

            if (!githubToken) {
                toast.error('GitHub token not found. Please reconnect your account.');
                return;
            }

            const [owner, repo] = repoName.split('/');
            const eventToUse = event || reviewEvent;

            await submitPullRequestReview(
                githubToken,
                owner,
                repo,
                pr.number,
                eventToUse,
                reviewBody.trim()
            );

            const eventLabels = {
                APPROVE: 'approved',
                REQUEST_CHANGES: 'requested changes on',
                COMMENT: 'commented on'
            };

            toast.success(`Successfully ${eventLabels[eventToUse]} PR #${pr.number}`);
            setReviewBody('');
            setShowReviewForm(false);
            setReviewEvent(null);
        } catch (error) {
            console.error('Failed to submit review:', error);
            toast.error(error.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelReview = () => {
        setShowReviewForm(false);
        setReviewEvent(null);
        setReviewBody('');
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header with review actions */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,13%,15%)] bg-[hsl(220,13%,7%)]">
                <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[hsl(217,91%,60%)]" />
                    <span className="text-sm font-medium text-[hsl(210,11%,90%)]">
                        Code Review
                    </span>
                    {files.length > 0 && (
                        <span className="text-xs text-[hsl(210,11%,50%)] bg-[hsl(220,13%,12%)] px-2 py-0.5 rounded">
                            {files.length} file{files.length !== 1 ? 's' : ''} changed
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadDiff}
                        disabled={loading}
                        className="p-1.5 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)] hover:bg-[hsl(220,13%,12%)] rounded transition-colors"
                        title="Refresh diff"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Review actions bar */}
            {!showReviewForm && (
                <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(220,13%,8%)] border-b border-[hsl(220,13%,15%)]">
                    <span className="text-sm text-[hsl(210,11%,60%)] mr-2">Review:</span>
                    
                    <button
                        onClick={() => handleSubmitReview('APPROVE')}
                        disabled={submitting || loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] 
                            rounded-lg hover:bg-[hsl(142,70%,45%,0.25)] transition-colors text-sm font-medium
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-4 h-4" />
                        Approve
                    </button>
                    
                    <button
                        onClick={() => handleSubmitReview('REQUEST_CHANGES')}
                        disabled={submitting || loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 
                            rounded-lg hover:bg-red-500/25 transition-colors text-sm font-medium
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X className="w-4 h-4" />
                        Request Changes
                    </button>
                    
                    <button
                        onClick={() => handleSubmitReview('COMMENT')}
                        disabled={submitting || loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(220,13%,15%)] text-[hsl(210,11%,70%)] 
                            rounded-lg hover:bg-[hsl(220,13%,20%)] transition-colors text-sm font-medium
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Comment
                    </button>
                </div>
            )}

            {/* Review form (shown when action selected) */}
            {showReviewForm && (
                <div className="px-4 py-3 bg-[hsl(220,13%,8%)] border-b border-[hsl(220,13%,15%)]">
                    <div className="flex items-center gap-2 mb-2">
                        {reviewEvent === 'APPROVE' && (
                            <span className="flex items-center gap-1 text-sm text-[hsl(142,70%,55%)]">
                                <Check className="w-4 h-4" />
                                Approving PR
                            </span>
                        )}
                        {reviewEvent === 'REQUEST_CHANGES' && (
                            <span className="flex items-center gap-1 text-sm text-red-400">
                                <AlertTriangle className="w-4 h-4" />
                                Requesting Changes
                            </span>
                        )}
                        {reviewEvent === 'COMMENT' && (
                            <span className="flex items-center gap-1 text-sm text-[hsl(210,11%,70%)]">
                                <MessageSquare className="w-4 h-4" />
                                Leaving Comment
                            </span>
                        )}
                    </div>
                    
                    <textarea
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                        placeholder="Add an optional comment for your review..."
                        rows={3}
                        className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 
                            text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,40%)] 
                            focus:outline-none focus:border-[hsl(220,13%,28%)] resize-none"
                    />
                    
                    <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                            onClick={cancelReview}
                            disabled={submitting}
                            className="px-3 py-1.5 text-sm text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,80%)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleSubmitReview()}
                            disabled={submitting}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                disabled:opacity-50 disabled:cursor-not-allowed
                                ${reviewEvent === 'APPROVE' 
                                    ? 'bg-[hsl(142,70%,45%)] text-black hover:bg-[hsl(142,70%,50%)]'
                                    : reviewEvent === 'REQUEST_CHANGES'
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-[hsl(217,91%,60%)] text-white hover:bg-[hsl(217,91%,65%)]'
                                }`}
                        >
                            {submitting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Submit Review
                        </button>
                    </div>
                </div>
            )}

            {/* Diff viewer */}
            <div className="flex-1 overflow-y-auto p-4">
                <DiffViewer diff={diff} loading={loading} />
            </div>
        </div>
    );
};

export default PRReviewPanel;
