import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    GitPullRequest, RefreshCw, Bot, FileCode, Check, X, AlertTriangle,
    MessageSquare, Sparkles, ChevronRight, ExternalLink, Clock, User,
    GitBranch, Plus, Minus, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../ui/AISuggestTextarea';
import Logo from '../Logo';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const PRManagementPage = () => {
    const [repositories, setRepositories] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [pullRequests, setPullRequests] = useState([]);
    const [selectedPR, setSelectedPR] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingPRs, setLoadingPRs] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [summarizing, setSummarizing] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [posting, setPosting] = useState(false);

    // PR Detail states
    const [prAnalysis, setPrAnalysis] = useState(null);
    const [prSummary, setPrSummary] = useState(null);

    // Comment states
    const [commentText, setCommentText] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [commentType, setCommentType] = useState('review');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [reposRes, templatesRes] = await Promise.all([
                axios.get(`${API}/repositories`),
                axios.get(`${API}/maintainer/templates`)
            ]);
            setRepositories(reposRes.data);
            setTemplates(templatesRes.data);
            setLoading(false);

            // Auto-select first repo if any (after setting loading to false)
            if (reposRes.data.length > 0 && !selectedRepo) {
                await handleSelectRepo(reposRes.data[0]);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load repositories');
            setLoading(false);
        }
    };

    const handleSelectRepo = async (repo) => {
        setSelectedRepo(repo);
        setSelectedPR(null);
        setPrAnalysis(null);
        setPrSummary(null);
        setPullRequests([]);
        setLoadingPRs(true);

        try {
            // Fetch PRs directly from GitHub via our backend
            const [owner, repoName] = repo.name.split('/');

            // First try to get PRs from our database (maintainer issues endpoint)
            const issuesRes = await axios.get(`${API}/maintainer/issues`);
            const repoPRs = issuesRes.data.filter(
                item => item.isPR && item.repoName === repo.name
            );

            if (repoPRs.length > 0) {
                setPullRequests(repoPRs);
            } else {
                // If no PRs in DB, try fetching from GitHub directly
                // We need to use the user's GitHub token for this
                try {
                    const userRes = await axios.get(`${API}/user/me`);
                    if (userRes.data.githubAccessToken) {
                        const ghPRsRes = await axios.post(`${API}/maintainer/github/prs`, {
                            githubAccessToken: userRes.data.githubAccessToken,
                            owner,
                            repo: repoName
                        });

                        // Transform GitHub PR format to match our PR format
                        const githubPRs = (ghPRsRes.data.pullRequests || []).map(pr => ({
                            id: `gh-${pr.number}`,
                            number: pr.number,
                            title: pr.title,
                            authorName: pr.user,
                            htmlUrl: pr.htmlUrl,
                            createdAt: pr.createdAt,
                            state: 'open',
                            isPR: true,
                            repoName: repo.name,
                            owner,
                            repo: repoName
                        }));
                        setPullRequests(githubPRs);
                    }
                } catch (ghError) {
                    console.log('Could not fetch from GitHub directly:', ghError);
                }
            }
        } catch (error) {
            console.error('Error fetching PRs:', error);
            setPullRequests([]);
        } finally {
            setLoadingPRs(false);
        }
    };

    const handleSelectPR = (pr) => {
        setSelectedPR(pr);
        setPrAnalysis(null);
        setPrSummary(null);
        setCommentText('');
    };

    const handleAnalyzePR = async () => {
        if (!selectedPR || !selectedRepo) return;

        setAnalyzing(true);
        setPrAnalysis(null);
        try {
            const [owner, repo] = selectedRepo.name.split('/');
            const response = await axios.post(`${API}/maintainer/pr/analyze`, {
                owner,
                repo,
                prNumber: selectedPR.number
            });
            setPrAnalysis(response.data);
            toast.success('PR analyzed successfully');
        } catch (error) {
            console.error('Error analyzing PR:', error);
            toast.error(error.response?.data?.detail || 'Failed to analyze PR');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSummarizePR = async () => {
        if (!selectedPR || !selectedRepo) return;

        setSummarizing(true);
        setPrSummary(null);
        try {
            const [owner, repo] = selectedRepo.name.split('/');
            const response = await axios.post(`${API}/maintainer/pr/summarize`, {
                owner,
                repo,
                prNumber: selectedPR.number
            });
            setPrSummary(response.data.summary);
            toast.success('Summary generated');
        } catch (error) {
            console.error('Error summarizing PR:', error);
            toast.error(error.response?.data?.detail || 'Failed to summarize PR');
        } finally {
            setSummarizing(false);
        }
    };

    const handleSuggestComment = async () => {
        if (!selectedPR) return;

        setSuggesting(true);
        try {
            const response = await axios.post(`${API}/maintainer/pr/suggest-comment`, {
                prTitle: selectedPR.title,
                prBody: selectedPR.body || '',
                context: prAnalysis?.analysis?.summary || 'Review this PR',
                commentType
            });
            setCommentText(response.data.suggestion);
            toast.success('Suggestion generated');
        } catch (error) {
            console.error('Error getting suggestion:', error);
            toast.error('Failed to generate suggestion');
        } finally {
            setSuggesting(false);
        }
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
        if (!commentText.trim() || !selectedPR) return;

        setPosting(true);
        try {
            await axios.post(`${API}/maintainer/action/reply`, {
                issueId: selectedPR.id,
                message: commentText
            });
            toast.success('Comment posted to GitHub!');
            setCommentText('');
            setSelectedTemplate('');
        } catch (error) {
            console.error('Error posting comment:', error);
            toast.error(error.response?.data?.detail || 'Failed to post comment');
        } finally {
            setPosting(false);
        }
    };

    const getVerdictColor = (verdict) => {
        switch (verdict) {
            case 'APPROVE': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
            case 'REQUEST_CHANGES': return 'text-red-400 bg-red-500/20 border-red-500/30';
            default: return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
        }
    };

    const getVerdictIcon = (verdict) => {
        switch (verdict) {
            case 'APPROVE': return <Check className="w-4 h-4" />;
            case 'REQUEST_CHANGES': return <X className="w-4 h-4" />;
            default: return <AlertTriangle className="w-4 h-4" />;
        }
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <div className="text-slate-400 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Loading PR Management...
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-hidden bg-slate-900 flex">
            {/* Left Panel - Repository & PR List */}
            <div className="w-80 border-r border-slate-700 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700">
                    <h1 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                        <GitPullRequest className="w-5 h-5 text-blue-400" />
                        PR Management
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Review & analyze pull requests</p>
                </div>

                {/* Repository Selector */}
                <div className="p-3 border-b border-slate-700">
                    <select
                        value={selectedRepo?.id || ''}
                        onChange={(e) => {
                            const repo = repositories.find(r => r.id === e.target.value);
                            if (repo) handleSelectRepo(repo);
                        }}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">Select Repository</option>
                        {repositories.map(repo => (
                            <option key={repo.id} value={repo.id}>{repo.name}</option>
                        ))}
                    </select>
                </div>

                {/* PR List */}
                <div className="flex-1 overflow-y-auto">
                    {loadingPRs ? (
                        <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading PRs...
                        </div>
                    ) : pullRequests.length === 0 ? (
                        <div className="p-4 text-center">
                            <p className="text-slate-400 text-sm mb-3">
                                {selectedRepo ? 'No open PRs found' : 'Select a repository'}
                            </p>
                            {selectedRepo && (
                                <button
                                    onClick={() => handleSelectRepo(selectedRepo)}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Refresh
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700/50">
                            {pullRequests.map(pr => (
                                <button
                                    key={pr.id}
                                    onClick={() => handleSelectPR(pr)}
                                    className={`w-full p-3 text-left transition-all hover:bg-slate-800 ${selectedPR?.id === pr.id ? 'bg-blue-500/10 border-l-2 border-blue-500' : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <GitPullRequest className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-200 truncate">
                                                #{pr.number} {pr.title}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                                <User className="w-3 h-3" />
                                                {pr.authorName}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-500" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - PR Details */}
            <div className="flex-1 overflow-y-auto p-6">
                {!selectedPR ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <GitPullRequest className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400">Select a PR to review</p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* PR Header */}
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-slate-200">
                                        #{selectedPR.number} {selectedPR.title}
                                    </h2>
                                    <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <User className="w-4 h-4" />
                                            {selectedPR.authorName}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {new Date(selectedPR.createdAt).toLocaleDateString()}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedPR.state === 'open'
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-purple-500/20 text-purple-400'
                                            }`}>
                                            {selectedPR.state}
                                        </span>
                                    </div>
                                </div>
                                <a
                                    href={selectedPR.htmlUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    View on GitHub
                                </a>
                            </div>

                            {selectedPR.body && (
                                <p className="mt-4 text-slate-300 text-sm bg-slate-900/50 p-3 rounded-lg">
                                    {selectedPR.body.length > 300
                                        ? selectedPR.body.substring(0, 300) + '...'
                                        : selectedPR.body}
                                </p>
                            )}
                        </div>

                        {/* AI Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleAnalyzePR}
                                disabled={analyzing}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 rounded-lg font-medium text-white transition-all"
                            >
                                {analyzing ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Bot className="w-5 h-5" />
                                )}
                                {analyzing ? 'Analyzing...' : 'AI Code Review'}
                            </button>
                            <button
                                onClick={handleSummarizePR}
                                disabled={summarizing}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg font-medium text-white transition-all"
                            >
                                {summarizing ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <FileCode className="w-5 h-5" />
                                )}
                                {summarizing ? 'Summarizing...' : 'Get Summary'}
                            </button>
                        </div>

                        {/* Analysis Results */}
                        {prAnalysis && (
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                                        <Bot className="w-5 h-5 text-purple-400" />
                                        AI Code Review
                                    </h3>
                                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getVerdictColor(prAnalysis.analysis?.verdict)}`}>
                                        {getVerdictIcon(prAnalysis.analysis?.verdict)}
                                        {prAnalysis.analysis?.verdict?.replace('_', ' ')}
                                    </span>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-blue-400">{prAnalysis.filesChanged}</div>
                                        <div className="text-xs text-slate-400">Files</div>
                                    </div>
                                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                                            <Plus className="w-4 h-4" />{prAnalysis.additions}
                                        </div>
                                        <div className="text-xs text-slate-400">Additions</div>
                                    </div>
                                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-red-400 flex items-center justify-center gap-1">
                                            <Minus className="w-4 h-4" />{prAnalysis.deletions}
                                        </div>
                                        <div className="text-xs text-slate-400">Deletions</div>
                                    </div>
                                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                        <div className="text-2xl font-bold text-yellow-400">{prAnalysis.analysis?.qualityScore}/10</div>
                                        <div className="text-xs text-slate-400">Quality</div>
                                    </div>
                                </div>

                                {/* Summary */}
                                {prAnalysis.analysis?.summary && (
                                    <div className="bg-slate-900/50 rounded-lg p-4">
                                        <p className="text-slate-300">{prAnalysis.analysis.summary}</p>
                                    </div>
                                )}

                                {/* Issues */}
                                {prAnalysis.analysis?.issues?.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                                            <AlertTriangle className="w-4 h-4" /> Issues Found
                                        </h4>
                                        <ul className="space-y-1">
                                            {prAnalysis.analysis.issues.map((issue, i) => (
                                                <li key={i} className="text-sm text-slate-300 bg-red-500/10 rounded px-3 py-2 border-l-2 border-red-500">
                                                    {issue}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Suggestions */}
                                {prAnalysis.analysis?.suggestions?.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-1">
                                            <Sparkles className="w-4 h-4" /> Suggestions
                                        </h4>
                                        <ul className="space-y-1">
                                            {prAnalysis.analysis.suggestions.map((suggestion, i) => (
                                                <li key={i} className="text-sm text-slate-300 bg-blue-500/10 rounded px-3 py-2 border-l-2 border-blue-500">
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Security */}
                                {prAnalysis.analysis?.security && prAnalysis.analysis.security !== 'No issues detected' && (
                                    <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                                        <h4 className="text-sm font-medium text-yellow-400 mb-1 flex items-center gap-1">
                                            <AlertTriangle className="w-4 h-4" /> Security Note
                                        </h4>
                                        <p className="text-sm text-slate-300">{prAnalysis.analysis.security}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Summary Results */}
                        {prSummary && (
                            <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl border border-slate-700 overflow-hidden">
                                {/* Header with OpenTriage branding */}
                                <div className="bg-gradient-to-r from-emerald-600/20 via-blue-600/20 to-purple-600/20 px-6 py-4 border-b border-slate-700/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* OpenTriage Logo */}
                                            <Logo size="sm" />
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                                    <FileCode className="w-5 h-5 text-emerald-400" />
                                                    AI-Generated Summary
                                                </h3>
                                                <p className="text-xs text-slate-400">Powered by OpenTriage AI</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/30 flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" /> AI Generated
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Content */}
                                <div className="p-6">
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        {/* Split summary into paragraphs for better readability */}
                                        {prSummary.split('\n\n').map((paragraph, idx) => (
                                            <div key={idx} className="mb-4 last:mb-0">
                                                {paragraph.startsWith('#') ? (
                                                    <h4 className="text-base font-semibold text-slate-200 mb-2 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                                        {paragraph.replace(/^#+\s*/, '')}
                                                    </h4>
                                                ) : paragraph.startsWith('-') || paragraph.startsWith('•') || paragraph.startsWith('*') ? (
                                                    <ul className="space-y-1.5 ml-4">
                                                        {paragraph.split('\n').map((item, i) => (
                                                            <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                                                                <span className="text-emerald-400 mt-1">→</span>
                                                                <span>{item.replace(/^[-•*]\s*/, '')}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : paragraph.includes(':') && paragraph.split(':')[0].length < 30 ? (
                                                    <div className="bg-slate-900/50 rounded-lg p-3 border-l-2 border-blue-500">
                                                        <span className="text-blue-400 font-medium text-sm">{paragraph.split(':')[0]}:</span>
                                                        <span className="text-slate-300 text-sm ml-1">{paragraph.split(':').slice(1).join(':')}</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-300 text-sm leading-relaxed">{paragraph}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-3 bg-slate-900/30 border-t border-slate-700/50 flex items-center justify-between">
                                    <p className="text-xs text-slate-500">
                                        Summary generated for PR #{selectedPR?.number}
                                    </p>
                                    <button
                                        onClick={handleSummarizePR}
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Regenerate
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Comment Section */}
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 mb-4">
                                <MessageSquare className="w-5 h-5 text-blue-400" />
                                Write Comment
                            </h3>

                            {/* Comment Type & Template */}
                            <div className="flex gap-3 mb-4">
                                <select
                                    value={commentType}
                                    onChange={(e) => setCommentType(e.target.value)}
                                    className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="review">General Review</option>
                                    <option value="approval">Approval</option>
                                    <option value="request_changes">Request Changes</option>
                                    <option value="question">Question</option>
                                </select>
                                <select
                                    value={selectedTemplate}
                                    onChange={handleTemplateChange}
                                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="">Use Template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleSuggestComment}
                                    disabled={suggesting}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 rounded-lg text-sm font-medium text-white transition-all"
                                >
                                    {suggesting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    AI Suggest
                                </button>
                            </div>

                            {/* Comment Text */}
                            <AISuggestTextarea
                                value={commentText}
                                onChange={setCommentText}
                                contextType="pr_comment"
                                rows={6}
                                placeholder="Write your comment here... (AI suggestions appear after a pause)"
                                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />

                            {/* Post Button */}
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={handlePostComment}
                                    disabled={!commentText.trim() || posting}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 rounded-lg font-medium text-white transition-all"
                                >
                                    {posting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <MessageSquare className="w-4 h-4" />
                                    )}
                                    {posting ? 'Posting...' : 'Post Comment'}
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
