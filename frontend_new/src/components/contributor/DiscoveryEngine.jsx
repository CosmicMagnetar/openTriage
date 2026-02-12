import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Search, RefreshCw, ExternalLink, GitFork, MessageSquare,
    Filter, Code, Flame, Clock, Tag, AlertCircle, X, Sparkles,
    Bookmark, TrendingUp, Check, BookOpen, Sprout, HelpCircle,
    Bug, Lightbulb, FileText, Calendar, Baby, CheckCircle, Target,
    PartyPopper, ArrowUpDown, Plus, Hash, Circle
} from 'lucide-react';
import useAuthStore from '@/stores/authStore';

// Common issue labels with Lucide icons
const COMMON_LABELS = [
    { value: 'good first issue', label: 'Good First Issue', color: '7057ff', Icon: Sprout },
    { value: 'help wanted', label: 'Help Wanted', color: '008672', Icon: HelpCircle },
    { value: 'bug', label: 'Bug', color: 'd73a4a', Icon: Bug },
    { value: 'enhancement', label: 'Enhancement', color: 'a2eeef', Icon: Lightbulb },
    { value: 'documentation', label: 'Documentation', color: '0075ca', Icon: FileText },
    { value: 'hacktoberfest', label: 'Hacktoberfest', color: 'ff7518', Icon: Calendar },
    { value: 'beginner friendly', label: 'Beginner Friendly', color: '7057ff', Icon: Baby },
    { value: 'easy', label: 'Easy', color: '22c55e', Icon: CheckCircle },
    { value: 'up for grabs', label: 'Up For Grabs', color: '10b981', Icon: Target },
    { value: 'first-timers-only', label: 'First Timers Only', color: 'ec4899', Icon: PartyPopper },
];

/**
 * DiscoveryEngine - GitHub Issue Discovery with search bar + local filtering.
 * Caches API results per filter combo for 5 minutes to avoid rate-limit exhaustion.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const issueCache = new Map(); // key → { data, timestamp }

function cacheKey(labels, language, sort) {
    return `${labels.join(',')}|${language}|${sort}`;
}

const DiscoveryEngine = ({ userLanguages = [], className = '' }) => {
    const { token } = useAuthStore();
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('all');
    const [selectedLabels, setSelectedLabels] = useState(['good first issue']);
    const [customLabel, setCustomLabel] = useState('');
    const [sortBy, setSortBy] = useState('created');
    const [lastFetched, setLastFetched] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [rateLimitInfo, setRateLimitInfo] = useState(null);
    const [savedIssues, setSavedIssues] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('savedIssues') || '[]');
        } catch { return []; }
    });
    const hasFetchedRef = useRef(false);

    const defaultLanguages = ['JavaScript', 'Python', 'TypeScript', 'Go', 'Rust', 'Java', 'C++', 'Ruby', 'PHP', 'Swift'];
    const languages = userLanguages.length > 0 ? userLanguages : defaultLanguages;

    // Fetch only on filter changes, with caching to avoid burning rate limit
    useEffect(() => {
        const key = cacheKey(selectedLabels, selectedLanguage, sortBy);
        const cached = issueCache.get(key);

        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
            // Use cached data, no API call
            setIssues(cached.data.items);
            setTotalCount(cached.data.total_count);
            setLastFetched(new Date(cached.timestamp));
            if (cached.data.rate_limit) setRateLimitInfo(cached.data.rate_limit);
            return;
        }

        fetchIssues();
    }, [selectedLanguage, sortBy, selectedLabels]);

    // Local filtering: filter fetched issues by search query (no API call)
    const filteredIssues = useMemo(() => {
        if (!searchQuery.trim()) return issues;
        const q = searchQuery.toLowerCase();
        return issues.filter(issue => {
            const { owner, repo } = parseRepoInfo(issue.repository_url);
            const repoStr = `${owner}/${repo}`.toLowerCase();
            const title = (issue.title || '').toLowerCase();
            const labels = (issue.labels || []).map(l => l.name.toLowerCase()).join(' ');
            return title.includes(q) || repoStr.includes(q) || labels.includes(q);
        });
    }, [issues, searchQuery]);

    const toggleLabel = (labelValue) => {
        setSelectedLabels(prev => {
            if (prev.includes(labelValue)) {
                if (prev.length === 1) return prev;
                return prev.filter(l => l !== labelValue);
            }
            return [...prev, labelValue];
        });
    };

    const addCustomLabel = () => {
        if (customLabel.trim() && !selectedLabels.includes(customLabel.trim().toLowerCase())) {
            setSelectedLabels(prev => [...prev, customLabel.trim().toLowerCase()]);
            setCustomLabel('');
        }
    };

    const toggleSaveIssue = (issue, e) => {
        e.preventDefault();
        e.stopPropagation();
        setSavedIssues(prev => {
            const exists = prev.some(i => i.id === issue.id);
            const newList = exists ? prev.filter(i => i.id !== issue.id) : [...prev, issue];
            localStorage.setItem('savedIssues', JSON.stringify(newList));
            return newList;
        });
    };

    const fetchIssues = async (force = false) => {
        const key = cacheKey(selectedLabels, selectedLanguage, sortBy);

        // Check cache unless forced refresh
        if (!force) {
            const cached = issueCache.get(key);
            if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
                setIssues(cached.data.items);
                setTotalCount(cached.data.total_count);
                setLastFetched(new Date(cached.timestamp));
                if (cached.data.rate_limit) setRateLimitInfo(cached.data.rate_limit);
                return;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const params = new URLSearchParams({
                labels: selectedLabels.join(','),
                language: selectedLanguage,
                sort: sortBy,
                per_page: '30'
            });

            let response;
            let data;

            if (token) {
                try {
                    response = await fetch(`${backendUrl}/api/explore/tickets?${params}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (response.ok) {
                        data = await response.json();
                    }
                } catch (e) {
                    // Backend not available
                }
            }

            if (!data) {
                let query = 'is:issue is:open';
                if (selectedLabels.length > 0) {
                    const labelQuery = selectedLabels.map(l => `label:"${l}"`).join(' ');
                    query += ` ${labelQuery}`;
                }
                if (selectedLanguage !== 'all') {
                    query += ` language:${selectedLanguage}`;
                }

                const sortOptions = { created: 'created', updated: 'updated', comments: 'comments', reactions: 'reactions-+1' };
                const searchParams = new URLSearchParams({
                    q: query,
                    sort: sortOptions[sortBy] || 'created',
                    order: 'desc',
                    per_page: '30'
                });

                response = await fetch(`https://api.github.com/search/issues?${searchParams}`, {
                    headers: { Accept: 'application/vnd.github+json' }
                });

                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error('Rate limit exceeded. Try again in a minute.');
                    }
                    throw new Error('Failed to fetch issues');
                }

                data = await response.json();
                setRateLimitInfo({
                    remaining: response.headers.get('x-ratelimit-remaining'),
                    limit: response.headers.get('x-ratelimit-limit'),
                });
            }

            setIssues(data.items || []);
            setTotalCount(data.total_count || 0);
            setLastFetched(new Date());

            if (data.rate_limit) {
                setRateLimitInfo(data.rate_limit);
            }

            // Cache results
            issueCache.set(key, {
                data: {
                    items: data.items || [],
                    total_count: data.total_count || 0,
                    rate_limit: data.rate_limit || rateLimitInfo,
                },
                timestamp: Date.now(),
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const parseRepoInfo = (url) => {
        const match = url?.match(/repos\/([^/]+)\/([^/]+)/);
        return match ? { owner: match[1], repo: match[2] } : { owner: '', repo: '' };
    };

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

    const isIssueSaved = (issueId) => savedIssues.some(i => i.id === issueId);

    return (
        <div className={`bg-[hsl(220,13%,8%)] rounded-xl border border-[hsl(220,13%,15%)] overflow-hidden ${className}`}>
            {/* Header Bar with Search */}
            <div className="px-4 py-2.5 border-b border-[hsl(220,13%,15%)] flex items-center gap-3">
                {/* Search bar — filters locally, no API call */}
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(210,11%,40%)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search issues by title, repo, or label..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-md text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(210,11%,40%)] hover:text-[hsl(210,11%,70%)]"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <span className="text-xs text-[hsl(210,11%,50%)] whitespace-nowrap">
                    <span className="text-[hsl(210,11%,85%)] font-medium">{filteredIssues.length}</span>{searchQuery ? ` / ${issues.length}` : ''} issues
                </span>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${showFilters
                            ? 'bg-[hsl(142,70%,45%)] text-black'
                            : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,18%)] border border-[hsl(220,13%,20%)]'
                            }`}
                    >
                        <Filter className="w-3 h-3" />
                        Filters
                    </button>
                    <button
                        onClick={() => fetchIssues(true)}
                        disabled={loading}
                        className="p-1.5 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,18%)] rounded-md transition-colors border border-[hsl(220,13%,20%)]" title="Force refresh (ignores cache)"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="px-5 py-4 bg-[#161b22] border-b border-[#21262d] space-y-4">
                    {/* Language & Sort */}
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="flex items-center gap-1.5 text-xs text-[#8b949e] mb-2">
                                <Code className="w-3 h-3" />
                                Language
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => setSelectedLanguage('all')}
                                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${selectedLanguage === 'all'
                                        ? 'bg-[#238636] text-white'
                                        : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d]'
                                        }`}
                                >
                                    All
                                </button>
                                {languages.slice(0, 6).map(lang => (
                                    <button
                                        key={lang}
                                        onClick={() => setSelectedLanguage(lang)}
                                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${selectedLanguage === lang
                                            ? 'bg-[#238636] text-white'
                                            : 'bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d]'
                                            }`}
                                    >
                                        {lang}
                                    </button>
                                ))}
                                <select
                                    value={selectedLanguage}
                                    onChange={(e) => e.target.value && setSelectedLanguage(e.target.value)}
                                    className="px-2 py-1 text-xs bg-[#21262d] text-[#8b949e] rounded-md border-0 
                                        focus:outline-none focus:ring-1 focus:ring-[#238636] cursor-pointer"
                                >
                                    <option value="">More...</option>
                                    {languages.slice(6).map(lang => (
                                        <option key={lang} value={lang}>{lang}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-xs text-[#8b949e] mb-2">
                                <ArrowUpDown className="w-3 h-3" />
                                Sort
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-2.5 py-1 text-xs bg-[#21262d] text-[#c9d1d9] rounded-md border-0 
                                    focus:outline-none focus:ring-1 focus:ring-[#238636] cursor-pointer"
                            >
                                <option value="created">Newest</option>
                                <option value="updated">Recently Updated</option>
                                <option value="comments">Most Discussed</option>
                                <option value="reactions">Most Popular</option>
                            </select>
                        </div>
                    </div>

                    {/* Labels */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs text-[#8b949e] mb-2">
                            <Tag className="w-3 h-3" />
                            Labels
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {COMMON_LABELS.map(({ value, label, color, Icon }) => {
                                const isSelected = selectedLabels.includes(value);
                                return (
                                    <button
                                        key={value}
                                        onClick={() => toggleLabel(value)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all ${isSelected ? 'ring-1 ring-offset-1 ring-offset-[#161b22]' : 'opacity-70 hover:opacity-100'
                                            }`}
                                        style={{
                                            backgroundColor: `#${color}18`,
                                            color: `#${color}`,
                                            ringColor: isSelected ? `#${color}` : undefined
                                        }}
                                    >
                                        <Icon className="w-3 h-3" />
                                        {label}
                                        {isSelected && <Check className="w-3 h-3" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom Label */}
                        <div className="flex gap-2 mt-3">
                            <div className="relative flex-1 max-w-[200px]">
                                <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6e7681]" />
                                <input
                                    type="text"
                                    value={customLabel}
                                    onChange={(e) => setCustomLabel(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCustomLabel()}
                                    placeholder="Custom label..."
                                    className="w-full pl-7 pr-3 py-1.5 text-xs bg-[#0d1117] border border-[#30363d] 
                                        rounded-md text-[#c9d1d9] placeholder-[#6e7681] focus:outline-none focus:border-[#238636]"
                                />
                            </div>
                            <button
                                onClick={addCustomLabel}
                                disabled={!customLabel.trim()}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#238636] text-white rounded-md 
                                    hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Active Filters */}
                    {(selectedLabels.length > 0 || selectedLanguage !== 'all') && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[#21262d]">
                            <span className="text-[10px] text-[#6e7681] mr-1">Active:</span>
                            {selectedLabels.map(labelVal => {
                                const labelInfo = COMMON_LABELS.find(l => l.value === labelVal);
                                const LabelIcon = labelInfo?.Icon || Tag;
                                return (
                                    <span
                                        key={labelVal}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded cursor-pointer hover:opacity-80"
                                        style={{
                                            backgroundColor: labelInfo ? `#${labelInfo.color}18` : '#21262d',
                                            color: labelInfo ? `#${labelInfo.color}` : '#8b949e',
                                        }}
                                        onClick={() => selectedLabels.length > 1 && toggleLabel(labelVal)}
                                    >
                                        <LabelIcon className="w-2.5 h-2.5" />
                                        {labelInfo?.label || labelVal}
                                        {selectedLabels.length > 1 && <X className="w-2.5 h-2.5" />}
                                    </span>
                                );
                            })}
                            {selectedLanguage !== 'all' && (
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[#1f6feb]/15 text-[#58a6ff] rounded cursor-pointer hover:opacity-80"
                                    onClick={() => setSelectedLanguage('all')}
                                >
                                    <Code className="w-2.5 h-2.5" />
                                    {selectedLanguage}
                                    <X className="w-2.5 h-2.5" />
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="max-h-[550px] overflow-y-auto">
                {loading && issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-[#30363d] border-t-[#238636] animate-spin" />
                        <p className="text-sm text-[#8b949e]">Searching issues...</p>
                    </div>
                ) : error ? (
                    <div className="px-5 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-3">
                            <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                        <p className="text-sm text-red-400 mb-2">{error}</p>
                        <button
                            onClick={fetchIssues}
                            className="px-3 py-1.5 text-xs bg-[#21262d] text-[#c9d1d9] rounded-md hover:bg-[#30363d] transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : issues.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#21262d] mb-3">
                            <Search className="w-6 h-6 text-[#6e7681]" />
                        </div>
                        <p className="text-sm text-[#8b949e]">No issues found</p>
                        <p className="text-xs text-[#6e7681] mt-1">Try different filters</p>
                    </div>
                ) : filteredIssues.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#21262d] mb-3">
                            <Search className="w-6 h-6 text-[#6e7681]" />
                        </div>
                        <p className="text-sm text-[#8b949e]">No issues match "{searchQuery}"</p>
                        <p className="text-xs text-[#6e7681] mt-1">Try a different search term</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#21262d]">
                        {filteredIssues.map((issue) => {
                            const { owner, repo } = parseRepoInfo(issue.repository_url);
                            const isSaved = isIssueSaved(issue.id);

                            return (
                                <a
                                    key={issue.id}
                                    href={issue.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block px-5 py-3.5 hover:bg-[#161b22] transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-0.5">
                                            <Circle className="w-4 h-4 text-[#3fb950]" fill="#3fb950" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {/* Repo & Time */}
                                            <div className="flex items-center gap-2 mb-1 text-xs text-[#8b949e]">
                                                <GitFork className="w-3 h-3 text-[#6e7681]" />
                                                <span className="hover:text-[#58a6ff] truncate">
                                                    {owner}/{repo}
                                                </span>
                                                <span className="text-[#30363d]">·</span>
                                                <span className="text-[#6e7681]">
                                                    {formatTimeAgo(issue.created_at)}
                                                </span>
                                            </div>

                                            {/* Title */}
                                            <h3 className="text-sm text-[#e6edf3] group-hover:text-[#58a6ff] transition-colors line-clamp-2 mb-2">
                                                {issue.title}
                                            </h3>

                                            {/* Labels */}
                                            {issue.labels?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {issue.labels.slice(0, 3).map((label) => (
                                                        <span
                                                            key={label.id}
                                                            className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                                                            style={{
                                                                backgroundColor: `#${label.color}18`,
                                                                color: `#${label.color}`,
                                                            }}
                                                        >
                                                            {label.name}
                                                        </span>
                                                    ))}
                                                    {issue.labels.length > 3 && (
                                                        <span className="px-1.5 py-0.5 text-[10px] text-[#6e7681]">
                                                            +{issue.labels.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Stats */}
                                            <div className="flex items-center gap-3 text-xs text-[#6e7681]">
                                                <span className="flex items-center gap-1">
                                                    <MessageSquare className="w-3 h-3" />
                                                    {issue.comments}
                                                </span>
                                                {issue.reactions?.total_count > 0 && (
                                                    <span className="flex items-center gap-1 text-[#f78166]">
                                                        <Flame className="w-3 h-3" />
                                                        {issue.reactions.total_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex-shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => toggleSaveIssue(issue, e)}
                                                className={`p-1.5 rounded-md transition-colors ${isSaved
                                                    ? 'bg-[#1f6feb]/15 text-[#58a6ff]'
                                                    : 'bg-[#21262d] text-[#6e7681] hover:text-[#c9d1d9]'
                                                    }`}
                                            >
                                                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                                            </button>
                                            <div className="p-1.5 bg-[#21262d] rounded-md text-[#6e7681] group-hover:text-[#3fb950]">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t border-[#21262d] bg-[#0d1117] flex items-center justify-between">
                <p className="text-[10px] text-[#6e7681]">
                    {rateLimitInfo?.remaining != null
                        ? `API: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} requests left`
                        : 'GitHub Search API'}
                    {lastFetched && ` · Cached ${formatTimeAgo(lastFetched.toISOString())}`}
                </p>
                {savedIssues.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-[#58a6ff]">
                        <Bookmark className="w-3 h-3 fill-current" />
                        {savedIssues.length} saved
                    </span>
                )}
            </div>
        </div>
    );
};

export default DiscoveryEngine;
