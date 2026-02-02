import { useState, useEffect, useMemo } from 'react';
import { 
    Search, RefreshCw, ExternalLink, Star, GitFork, MessageSquare,
    Filter, ChevronDown, Code, Flame, Clock, Tag, AlertCircle
} from 'lucide-react';

/**
 * DiscoveryEngine - Live GitHub Search for good first issues
 * Replaces curated lists with real-time GitHub API queries
 * Filters by user's preferred languages from their profile
 */
const DiscoveryEngine = ({ userLanguages = [], className = '' }) => {
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState('all');
    const [sortBy, setSortBy] = useState('created');
    const [lastFetched, setLastFetched] = useState(null);

    // Default popular languages if user has none
    const defaultLanguages = ['JavaScript', 'Python', 'TypeScript', 'Go', 'Rust', 'Java'];
    const languages = userLanguages.length > 0 ? userLanguages : defaultLanguages;

    useEffect(() => {
        fetchIssues();
    }, [selectedLanguage, sortBy]);

    const fetchIssues = async () => {
        setLoading(true);
        setError(null);

        try {
            // Build GitHub search query
            let query = 'is:issue is:open label:"good first issue"';
            
            // Add language filter
            if (selectedLanguage !== 'all') {
                query += ` language:${selectedLanguage}`;
            }

            // Sort options
            const sortOptions = {
                created: 'created',
                updated: 'updated',
                comments: 'comments',
                reactions: 'reactions-+1'
            };

            const searchParams = new URLSearchParams({
                q: query,
                sort: sortOptions[sortBy] || 'created',
                order: 'desc',
                per_page: '30'
            });

            const response = await fetch(
                `https://api.github.com/search/issues?${searchParams.toString()}`,
                {
                    headers: {
                        Accept: 'application/vnd.github+json',
                        // Note: Using unauthenticated API has lower rate limits
                        // In production, use user's GitHub token for higher limits
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Rate limit exceeded. Please try again in a minute.');
                }
                throw new Error('Failed to fetch issues');
            }

            const data = await response.json();
            setIssues(data.items || []);
            setLastFetched(new Date());
        } catch (err) {
            setError(err.message);
            console.error('Discovery fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Parse repo info from issue URL
    const parseRepoInfo = (url) => {
        const match = url?.match(/repos\/([^/]+)\/([^/]+)/);
        return match ? { owner: match[1], repo: match[2] } : { owner: '', repo: '' };
    };

    // Format relative time
    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return `${Math.floor(days / 30)}mo ago`;
    };

    return (
        <div className={`bg-[hsl(220,13%,8%)] rounded-xl border border-[hsl(220,13%,15%)] overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-[hsl(220,13%,15%)] bg-[hsl(220,13%,6%)]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                        <h2 className="text-sm font-semibold text-[hsl(210,11%,90%)]">
                            Discover Good First Issues
                        </h2>
                    </div>
                    <button
                        onClick={fetchIssues}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[hsl(210,11%,60%)] 
                            hover:text-[hsl(210,11%,80%)] hover:bg-[hsl(220,13%,12%)] rounded transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
                <p className="text-xs text-[hsl(210,11%,50%)] mt-1">
                    Live results from GitHub • Good first issues for beginners
                </p>
            </div>

            {/* Filters */}
            <div className="px-4 py-2 border-b border-[hsl(220,13%,12%)] flex flex-wrap items-center gap-3">
                {/* Language Filter */}
                <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-[hsl(210,11%,50%)]" />
                    <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded px-2 py-1 
                            text-xs text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(220,13%,28%)]"
                    >
                        <option value="all">All Languages</option>
                        {languages.map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-[hsl(210,11%,50%)]" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded px-2 py-1 
                            text-xs text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(220,13%,28%)]"
                    >
                        <option value="created">Newest</option>
                        <option value="updated">Recently Updated</option>
                        <option value="comments">Most Discussed</option>
                        <option value="reactions">Most Popular</option>
                    </select>
                </div>

                {lastFetched && (
                    <span className="text-[10px] text-[hsl(210,11%,40%)] ml-auto">
                        Updated {formatTimeAgo(lastFetched)}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="max-h-[500px] overflow-y-auto">
                {loading && issues.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-5 h-5 text-[hsl(142,70%,55%)] animate-spin" />
                    </div>
                ) : error ? (
                    <div className="px-4 py-8 text-center">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <p className="text-sm text-red-400">{error}</p>
                        <button
                            onClick={fetchIssues}
                            className="mt-3 text-xs text-[hsl(217,91%,60%)] hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : issues.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[hsl(210,11%,50%)]">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No issues found</p>
                        <p className="text-xs mt-1">Try selecting a different language</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[hsl(220,13%,12%)]">
                        {issues.map((issue) => {
                            const { owner, repo } = parseRepoInfo(issue.repository_url);
                            
                            return (
                                <a
                                    key={issue.id}
                                    href={issue.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block px-4 py-3 hover:bg-[hsl(220,13%,10%)] transition-colors group"
                                >
                                    {/* Repository */}
                                    <div className="flex items-center gap-2 text-xs text-[hsl(210,11%,50%)] mb-1">
                                        <GitFork className="w-3 h-3" />
                                        <span className="hover:text-[hsl(217,91%,60%)]">
                                            {owner}/{repo}
                                        </span>
                                        <span className="text-[hsl(210,11%,30%)]">•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTimeAgo(issue.created_at)}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-sm font-medium text-[hsl(210,11%,85%)] group-hover:text-[hsl(142,70%,55%)] transition-colors line-clamp-2 mb-2">
                                        {issue.title}
                                    </h3>

                                    {/* Labels */}
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {issue.labels?.slice(0, 4).map((label) => (
                                            <span
                                                key={label.id}
                                                className="px-1.5 py-0.5 text-[10px] rounded-full"
                                                style={{
                                                    backgroundColor: `#${label.color}20`,
                                                    color: `#${label.color}`,
                                                    border: `1px solid #${label.color}40`
                                                }}
                                            >
                                                {label.name}
                                            </span>
                                        ))}
                                        {issue.labels?.length > 4 && (
                                            <span className="px-1.5 py-0.5 text-[10px] text-[hsl(210,11%,50%)]">
                                                +{issue.labels.length - 4}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-xs text-[hsl(210,11%,45%)]">
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="w-3 h-3" />
                                            {issue.comments}
                                        </span>
                                        {issue.reactions?.total_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Flame className="w-3 h-3 text-orange-400" />
                                                {issue.reactions.total_count}
                                            </span>
                                        )}
                                        <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[hsl(220,13%,12%)] bg-[hsl(220,13%,6%)]">
                <p className="text-[10px] text-[hsl(210,11%,40%)] text-center">
                    Powered by GitHub Search API • {issues.length} issues found
                </p>
            </div>
        </div>
    );
};

export default DiscoveryEngine;
