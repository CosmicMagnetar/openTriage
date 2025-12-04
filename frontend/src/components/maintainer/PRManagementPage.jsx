import { useState, useEffect } from 'react';
import { fetchMaintainerRepos, fetchUnmergedPullRequests, commentOnPullRequest } from '../../services/githubService';
import useAuthStore from '../../stores/authStore';

const PRManagementPage = () => {
    const { user } = useAuthStore();
    const [repos, setRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [pullRequests, setPullRequests] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedPR, setSelectedPR] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [commentText, setCommentText] = useState('');
    const [existingRepos, setExistingRepos] = useState([]);

    // Fetch user's repositories and templates on mount
    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            // Fetch existing repos
            const reposResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/repositories`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const reposData = await reposResponse.json();
            setExistingRepos(reposData.map(r => r.name));

            // Fetch templates
            const templatesResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/maintainer/templates`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const templatesData = await templatesResponse.json();
            setTemplates(templatesData);
        } catch (err) {
            console.error('Error fetching user data:', err);
        }
    };

    const handleFetchRepos = async () => {
        if (!user?.githubAccessToken) {
            setError('GitHub access token not found. Please re-authenticate.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const fetchedRepos = await fetchMaintainerRepos(user.githubAccessToken, existingRepos);
            setRepos(fetchedRepos);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRepo = async (repo) => {
        setSelectedRepo(repo);
        setLoading(true);
        setError(null);
        try {
            const prs = await fetchUnmergedPullRequests(user.githubAccessToken, repo.owner, repo.repo);
            setPullRequests(prs);
        } catch (err) {
            setError(err.message);
            setPullRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCommentModal = (pr) => {
        setSelectedPR(pr);
        setShowCommentModal(true);
        setCommentText('');
        setSelectedTemplate('');
    };

    const handleTemplateChange = (e) => {
        const templateId = e.target.value;
        setSelectedTemplate(templateId);
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setCommentText(template.body);
        }
    };

    const handlePostComment = async () => {
        if (!commentText.trim()) {
            setError('Comment text cannot be empty');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await commentOnPullRequest(
                user.githubAccessToken,
                selectedRepo.owner,
                selectedRepo.repo,
                selectedPR.number,
                commentText
            );
            setShowCommentModal(false);
            alert('Comment posted successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen overflow-y-auto bg-slate-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">GitHub PR Management</h1>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {/* Fetch Repos Section */}
                <div className="bg-slate-800 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Your Repositories</h2>
                    <button
                        onClick={handleFetchRepos}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded transition"
                    >
                        {loading ? 'Loading...' : 'Fetch My Repos'}
                    </button>

                    {repos.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {repos.map((repo) => (
                                <div
                                    key={repo.fullName}
                                    onClick={() => handleSelectRepo(repo)}
                                    className={`p-4 rounded border cursor-pointer transition ${selectedRepo?.fullName === repo.fullName
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-slate-700 hover:border-slate-600 bg-slate-700/50'
                                        }`}
                                >
                                    <h3 className="font-semibold">{repo.fullName}</h3>
                                    {repo.description && (
                                        <p className="text-sm text-gray-400 mt-1">{repo.description}</p>
                                    )}
                                    {repo.isPrivate && (
                                        <span className="inline-block mt-2 text-xs bg-yellow-600 px-2 py-1 rounded">
                                            Private
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pull Requests Section */}
                {selectedRepo && (
                    <div className="bg-slate-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">
                            Unmerged Pull Requests - {selectedRepo.fullName}
                        </h2>

                        {pullRequests.length === 0 ? (
                            <p className="text-gray-400">No unmerged pull requests found.</p>
                        ) : (
                            <div className="space-y-3">
                                {pullRequests.map((pr) => (
                                    <div
                                        key={pr.number}
                                        className="flex items-center justify-between p-4 bg-slate-700 rounded border border-slate-600"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-mono text-gray-400">#{pr.number}</span>
                                                <h3 className="font-semibold">{pr.title}</h3>
                                            </div>
                                            <p className="text-sm text-gray-400 mt-1">
                                                by {pr.user} • {new Date(pr.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <a
                                                href={pr.htmlUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm transition"
                                            >
                                                View on GitHub
                                            </a>
                                            <button
                                                onClick={() => handleOpenCommentModal(pr)}
                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
                                            >
                                                Comment
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Comment Modal */}
                {showCommentModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold mb-4">
                                Comment on PR #{selectedPR.number}
                            </h2>
                            <p className="text-gray-400 mb-4">{selectedPR.title}</p>

                            {/* Template Selector */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">
                                    Select Template (Optional)
                                </label>
                                <select
                                    value={selectedTemplate}
                                    onChange={handleTemplateChange}
                                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2"
                                >
                                    <option value="">-- No Template --</option>
                                    {templates.map((template) => (
                                        <option key={template.id} value={template.id}>
                                            {template.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Comment Text */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2">Comment</label>
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    rows={8}
                                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 resize-none"
                                    placeholder="Write your comment here..."
                                />
                            </div>

                            {/* Preview */}
                            {commentText && (
                                <div className="mb-4 p-4 bg-slate-700 rounded border border-slate-600">
                                    <p className="text-sm font-medium mb-2">Preview:</p>
                                    <div className="text-sm whitespace-pre-wrap">{commentText}</div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCommentModal(false)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePostComment}
                                    disabled={loading || !commentText.trim()}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition"
                                >
                                    {loading ? 'Posting...' : 'Post Comment'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PRManagementPage;
