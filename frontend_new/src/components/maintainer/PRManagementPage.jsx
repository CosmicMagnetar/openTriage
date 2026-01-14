import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    GitPullRequest, RefreshCw, Bot, FileCode, Check, X, AlertTriangle,
    MessageSquare, ChevronRight, ExternalLink, Clock, User,
    GitBranch, Plus, Minus, Loader2, Lightbulb
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
            const [owner, repoName] = repo.name.split('/');

            // First try to get PRs from our database
            const issuesRes = await axios.get(`${API}/maintainer/issues`);
            // API returns { items: [...], total, pages, ... } or legacy array
            const issuesData = issuesRes.data.items || issuesRes.data || [];
            const repoPRs = issuesData.filter(
                item => item.isPR && item.repoName === repo.name
            );

            // Always fetch from GitHub to get ALL open PRs for this repo
            try {
                const ghPRsRes = await axios.get(`${API}/maintainer/github/prs?owner=${owner}&repo=${repoName}`);
                const githubPRs = (ghPRsRes.data || []).map(pr => ({
                    id: `gh-${pr.number}`,
                    number: pr.number,
                    title: pr.title,
                    body: pr.body,
                    authorName: pr.user?.login || 'unknown',
                    htmlUrl: pr.html_url,
                    createdAt: pr.created_at,
                    state: pr.state,
                    isPR: true,
                    repoName: repo.name,
                    owner,
                    repo: repoName
                }));

                // Merge DB PRs with GitHub PRs (avoid duplicates by number)
                const dbPRNumbers = new Set(repoPRs.map(p => p.number));
                const mergedPRs = [
                    ...repoPRs,
                    ...githubPRs.filter(pr => !dbPRNumbers.has(pr.number))
                ];
                setPullRequests(mergedPRs);
            } catch (ghError) {
                console.log('Could not fetch from GitHub directly:', ghError);
                // Fall back to just DB PRs
                setPullRequests(repoPRs);
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
            case 'APPROVE': return 'text-[hsl(142,70%,55%)] bg-[hsl(142,70%,45%,0.15)] border-[hsl(142,70%,45%,0.3)]';
            case 'REQUEST_CHANGES': return 'text-red-400 bg-red-500/15 border-red-500/30';
            default: return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30';
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
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-[hsl(210,11%,45%)] flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Loading PR Management...
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-hidden flex flex-col">
            {/* Top Bar */}
            <div className="border-b border-[hsl(220,13%,14%)] px-6 py-4 flex items-center gap-4 bg-[hsl(220,13%,7%)]">
                <div className="flex items-center gap-3">
                    <GitPullRequest className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                    <h1 className="text-lg font-semibold text-[hsl(210,11%,90%)]">PR Management</h1>
                </div>

                <div className="flex-1 flex items-center gap-3">
                    <select
                        value={selectedRepo?.id || ''}
                        onChange={(e) => {
                            const repo = repositories.find(r => r.id === e.target.value);
                            if (repo) handleSelectRepo(repo);
                        }}
                        className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2 text-sm text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(220,13%,28%)] min-w-[240px]"
                    >
                        <option value="">Select a repository</option>
                        {repositories.map(repo => (
                            <option key={repo.id} value={repo.id}>{repo.name}</option>
                        ))}
                    </select>

                    {selectedRepo && (
                        <button
                            onClick={() => handleSelectRepo(selectedRepo)}
                            disabled={loadingPRs}
                            className="text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)] p-2 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingPRs ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-[hsl(210,11%,50%)] bg-[hsl(220,13%,12%)] px-3 py-1.5 rounded-lg border border-[hsl(220,13%,16%)]">
                        {pullRequests.length} open PRs
                    </span>
                    <a
                        href="/"
                        className="text-xs text-[hsl(142,70%,55%)] hover:text-[hsl(142,70%,65%)] flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(142,70%,45%,0.1)] rounded-lg border border-[hsl(142,70%,45%,0.2)] transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Repo
                    </a>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* PR List - Left sidebar */}
                <div className="w-72 border-r border-[hsl(220,13%,14%)] bg-[hsl(220,13%,6%)] flex flex-col">
                    <div className="px-4 py-3 border-b border-[hsl(220,13%,12%)]">
                        <p className="text-[10px] text-[hsl(210,11%,45%)] uppercase tracking-wider">Open Pull Requests</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                        {loadingPRs ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-5 h-5 text-[hsl(142,70%,55%)] animate-spin" />
                            </div>
                        ) : pullRequests.length === 0 ? (
                            <div className="text-center py-12">
                                <GitPullRequest className="w-10 h-10 text-[hsl(210,11%,20%)] mx-auto mb-3" />
                                <p className="text-sm text-[hsl(210,11%,45%)]">
                                    {selectedRepo ? 'No open PRs' : 'Select a repository'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {pullRequests.map(pr => (
                                    <button
                                        key={pr.id}
                                        onClick={() => handleSelectPR(pr)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors ${selectedPR?.id === pr.id
                                            ? 'bg-[hsl(142,70%,45%,0.12)] border border-[hsl(142,70%,45%,0.25)]'
                                            : 'hover:bg-[hsl(220,13%,10%)] border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-mono font-medium ${selectedPR?.id === pr.id ? 'text-[hsl(142,70%,55%)]' : 'text-[hsl(210,11%,55%)]'
                                                }`}>
                                                #{pr.number}
                                            </span>
                                            <span className="text-[10px] text-[hsl(210,11%,40%)]">by {pr.authorName}</span>
                                        </div>
                                        <p className="text-sm text-[hsl(210,11%,70%)] line-clamp-2">{pr.title}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* PR Details - Right */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!selectedPR ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <GitPullRequest className="w-16 h-16 text-[hsl(220,13%,20%)] mx-auto mb-4" />
                                <p className="text-[hsl(210,11%,50%)]">Select a PR to review</p>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* PR Header */}
                            <div className="bg-[hsl(220,13%,8%)] rounded-lg p-6 border border-[hsl(220,13%,15%)]">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-[hsl(210,11%,90%)]">
                                            #{selectedPR.number} {selectedPR.title}
                                        </h2>
                                        <div className="flex items-center gap-4 mt-3 text-sm text-[hsl(210,11%,50%)]">
                                            <span className="flex items-center gap-1">
                                                <User className="w-4 h-4" />
                                                {selectedPR.authorName}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {new Date(selectedPR.createdAt).toLocaleDateString()}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedPR.state === 'open'
                                                ? 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)]'
                                                : 'bg-purple-500/15 text-purple-400'
                                                }`}>
                                                {selectedPR.state}
                                            </span>
                                        </div>
                                    </div>
                                    <a
                                        href={selectedPR.htmlUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] rounded-lg text-sm text-[hsl(210,11%,70%)] transition-all border border-[hsl(220,13%,18%)]"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        View on GitHub
                                    </a>
                                </div>

                                {selectedPR.body && (
                                    <p className="mt-4 text-[hsl(210,11%,70%)] text-sm bg-[hsl(220,13%,6%)] p-3 rounded-lg border border-[hsl(220,13%,12%)]">
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
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] rounded-lg font-medium text-white transition-colors"
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
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] rounded-lg font-medium text-black transition-colors"
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
                                <div className="bg-[hsl(220,13%,8%)] rounded-lg p-6 border border-[hsl(220,13%,15%)] space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] flex items-center gap-2">
                                            <Bot className="w-5 h-5 text-[hsl(217,91%,65%)]" />
                                            AI Code Review
                                        </h3>
                                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getVerdictColor(prAnalysis.analysis?.verdict)}`}>
                                            {getVerdictIcon(prAnalysis.analysis?.verdict)}
                                            {prAnalysis.analysis?.verdict?.replace('_', ' ')}
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="bg-[hsl(220,13%,6%)] rounded-lg p-3 text-center border border-[hsl(220,13%,12%)]">
                                            <div className="text-2xl font-bold text-[hsl(217,91%,65%)]">{prAnalysis.filesChanged}</div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">Files</div>
                                        </div>
                                        <div className="bg-[hsl(220,13%,6%)] rounded-lg p-3 text-center border border-[hsl(220,13%,12%)]">
                                            <div className="text-2xl font-bold text-[hsl(142,70%,55%)] flex items-center justify-center gap-1">
                                                <Plus className="w-4 h-4" />{prAnalysis.additions}
                                            </div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">Additions</div>
                                        </div>
                                        <div className="bg-[hsl(220,13%,6%)] rounded-lg p-3 text-center border border-[hsl(220,13%,12%)]">
                                            <div className="text-2xl font-bold text-red-400 flex items-center justify-center gap-1">
                                                <Minus className="w-4 h-4" />{prAnalysis.deletions}
                                            </div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">Deletions</div>
                                        </div>
                                        <div className="bg-[hsl(220,13%,6%)] rounded-lg p-3 text-center border border-[hsl(220,13%,12%)]">
                                            <div className="text-2xl font-bold text-yellow-400">{prAnalysis.analysis?.qualityScore}/10</div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">Quality</div>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    {prAnalysis.analysis?.summary && (
                                        <div className="bg-[hsl(220,13%,6%)] rounded-lg p-4 border border-[hsl(220,13%,12%)]">
                                            <p className="text-[hsl(210,11%,75%)]">{prAnalysis.analysis.summary}</p>
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
                                                    <li key={i} className="text-sm text-[hsl(210,11%,75%)] bg-red-500/10 rounded px-3 py-2 border-l-2 border-red-500">
                                                        {issue}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Suggestions */}
                                    {prAnalysis.analysis?.suggestions?.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium text-[hsl(217,91%,65%)] mb-2 flex items-center gap-1">
                                                <Lightbulb className="w-4 h-4" /> Suggestions
                                            </h4>
                                            <ul className="space-y-1">
                                                {prAnalysis.analysis.suggestions.map((suggestion, i) => (
                                                    <li key={i} className="text-sm text-[hsl(210,11%,75%)] bg-[hsl(217,91%,60%,0.1)] rounded px-3 py-2 border-l-2 border-[hsl(217,91%,60%)]">
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
                                            <p className="text-sm text-[hsl(210,11%,75%)]">{prAnalysis.analysis.security}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Summary Results */}
                            {prSummary && (
                                <div className="bg-[hsl(220,13%,8%)] rounded-lg border border-[hsl(220,13%,15%)] overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-[hsl(220,13%,10%)] px-6 py-4 border-b border-[hsl(220,13%,15%)]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Logo size="sm" />
                                                <div>
                                                    <h3 className="text-lg font-bold text-[hsl(210,11%,90%)] flex items-center gap-2">
                                                        <FileCode className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                                                        AI-Generated Summary
                                                    </h3>
                                                    <p className="text-xs text-[hsl(210,11%,50%)]">Powered by OpenTriage AI</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-1 bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] text-xs font-medium rounded-full border border-[hsl(142,70%,45%,0.3)] flex items-center gap-1">
                                                    <Bot className="w-3 h-3" /> AI Generated
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary Content */}
                                    <div className="p-6">
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            {prSummary.split('\n\n').map((paragraph, idx) => (
                                                <div key={idx} className="mb-4 last:mb-0">
                                                    {paragraph.startsWith('#') ? (
                                                        <h4 className="text-base font-semibold text-[hsl(210,11%,90%)] mb-2 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 bg-[hsl(142,70%,55%)] rounded-full"></span>
                                                            {paragraph.replace(/^#+\s*/, '')}
                                                        </h4>
                                                    ) : paragraph.startsWith('-') || paragraph.startsWith('•') || paragraph.startsWith('*') ? (
                                                        <ul className="space-y-1.5 ml-4">
                                                            {paragraph.split('\n').map((item, i) => (
                                                                <li key={i} className="text-[hsl(210,11%,75%)] text-sm flex items-start gap-2">
                                                                    <span className="text-[hsl(142,70%,55%)] mt-1">→</span>
                                                                    <span>{item.replace(/^[-•*]\s*/, '')}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : paragraph.includes(':') && paragraph.split(':')[0].length < 30 ? (
                                                        <div className="bg-[hsl(220,13%,6%)] rounded-lg p-3 border-l-2 border-[hsl(217,91%,60%)]">
                                                            <span className="text-[hsl(217,91%,65%)] font-medium text-sm">{paragraph.split(':')[0]}:</span>
                                                            <span className="text-[hsl(210,11%,75%)] text-sm ml-1">{paragraph.split(':').slice(1).join(':')}</span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[hsl(210,11%,75%)] text-sm leading-relaxed">{paragraph}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="px-6 py-3 bg-[hsl(220,13%,6%)] border-t border-[hsl(220,13%,12%)] flex items-center justify-between">
                                        <p className="text-xs text-[hsl(210,11%,40%)]">
                                            Summary generated for PR #{selectedPR?.number}
                                        </p>
                                        <button
                                            onClick={handleSummarizePR}
                                            className="text-xs text-[hsl(217,91%,65%)] hover:text-[hsl(217,91%,75%)] flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Regenerate
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Comment Section */}
                            <div className="bg-[hsl(220,13%,8%)] rounded-lg p-6 border border-[hsl(220,13%,15%)]">
                                <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] flex items-center gap-2 mb-4">
                                    <MessageSquare className="w-5 h-5 text-[hsl(217,91%,65%)]" />
                                    Write Comment
                                </h3>

                                {/* Comment Type & Template */}
                                <div className="flex gap-3 mb-4">
                                    <select
                                        value={commentType}
                                        onChange={(e) => setCommentType(e.target.value)}
                                        className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(217,91%,60%)]"
                                    >
                                        <option value="review">General Review</option>
                                        <option value="approval">Approval</option>
                                        <option value="request_changes">Request Changes</option>
                                        <option value="question">Question</option>
                                    </select>
                                    <select
                                        value={selectedTemplate}
                                        onChange={handleTemplateChange}
                                        className="flex-1 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(217,91%,60%)]"
                                    >
                                        <option value="">Use Template...</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleSuggestComment}
                                        disabled={suggesting}
                                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(217,91%,50%)] hover:bg-[hsl(217,91%,55%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] rounded-lg text-sm font-medium text-white transition-colors"
                                    >
                                        {suggesting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Lightbulb className="w-4 h-4" />
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
                                    className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-3 text-[hsl(210,11%,80%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(220,13%,28%)]"
                                />

                                {/* Post Button */}
                                <div className="flex justify-end mt-4">
                                    <button
                                        onClick={handlePostComment}
                                        disabled={!commentText.trim() || posting}
                                        className="flex items-center gap-2 px-5 py-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] rounded-lg text-sm font-medium text-black transition-colors"
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
        </div>
    );
};

export default PRManagementPage;
