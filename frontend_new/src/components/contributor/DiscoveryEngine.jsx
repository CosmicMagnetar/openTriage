import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Search, RefreshCw, ExternalLink, Star, GitFork, MessageSquare,
    Filter, Code, Flame, Clock, Tag, AlertCircle, X, Sparkles, 
    ChevronRight, Bookmark, TrendingUp, Zap, Check, BookOpen
} from 'lucide-react';
import useAuthStore from '@/stores/authStore';

// Common issue labels for discovery with enhanced styling
const COMMON_LABELS = [
    { value: 'good first issue', label: 'Good First Issue', color: '7057ff', icon: '🌱' },
    { value: 'help wanted', label: 'Help Wanted', color: '008672', icon: '🙋' },
    { value: 'bug', label: 'Bug', color: 'd73a4a', icon: '🐛' },
    { value: 'enhancement', label: 'Enhancement', color: 'a2eeef', icon: '✨' },
    { value: 'documentation', label: 'Documentation', color: '0075ca', icon: '📝' },
    { value: 'hacktoberfest', label: 'Hacktoberfest', color: 'ff7518', icon: '🎃' },
    { value: 'beginner friendly', label: 'Beginner Friendly', color: '7057ff', icon: '👶' },
    { value: 'easy', label: 'Easy', color: '22c55e', icon: '✅' },
    { value: 'up for grabs', label: 'Up For Grabs', color: '10b981', icon: '🎯' },
    { value: 'first-timers-only', label: 'First Timers Only', color: 'ec4899', icon: '🎉' },
];

// Popular languages with icons
const LANGUAGE_CONFIG = {
    'JavaScript': { color: '#f7df1e', icon: '🟨' },
    'TypeScript': { color: '#3178c6', icon: '🔷' },
    'Python': { color: '#3776ab', icon: '🐍' },
    'Go': { color: '#00add8', icon: '🐹' },
    'Rust': { color: '#dea584', icon: '🦀' },
    'Java': { color: '#ed8b00', icon: '☕' },
    'C++': { color: '#00599c', icon: '⚙️' },
    'Ruby': { color: '#cc342d', icon: '💎' },
    'PHP': { color: '#777bb4', icon: '🐘' },
    'Swift': { color: '#fa7343', icon: '🍎' },
    'Kotlin': { color: '#7f52ff', icon: '🎯' },
    'C#': { color: '#512bd4', icon: '🎮' },
};

/**
 * DiscoveryEngine - Modern GitHub Issue Discovery
 * Beautiful UI with smart filtering and real-time search
 */
const DiscoveryEngine = ({ userLanguages = [], className = '' }) => {
    const { token } = useAuthStore();
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
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
    const debounceRef = useRef(null);

    // Default popular languages if user has none
    const defaultLanguages = ['JavaScript', 'Python', 'TypeScript', 'Go', 'Rust', 'Java', 'C++', 'Ruby', 'PHP', 'Swift'];
    const languages = userLanguages.length > 0 ? userLanguages : defaultLanguages;

    // Debounced fetch to prevent rate limiting
    const debouncedFetch = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchIssues();
        }, 500);
    }, [selectedLanguage, sortBy, selectedLabels]);

    useEffect(() => {
        debouncedFetch();
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [selectedLanguage, sortBy, selectedLabels]);

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

    const fetchIssues = async () => {
        setLoading(true);
        setError(null);

        try {
            // Try backend API first (authenticated, higher rate limits)
            const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const params = new URLSearchParams({
                labels: selectedLabels.join(','),
                language: selectedLanguage,
                sort: sortBy,
                per_page: '30'
            });

            let response;
            let data;

            // Try backend API with auth
            if (token) {
                try {
                    response = await fetch(`${backendUrl}/api/discover/issues?${params}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (response.ok) {
                        data = await response.json();
                    }
                } catch (e) {
                    // Backend not available, fall through to GitHub API
                }
            }

            // Fallback to direct GitHub API if backend fails
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
                
                // Get rate limit info from headers
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
        } catch (err) {
            setError(err.message);
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

    const isIssueSaved = (issueId) => savedIssues.some(i => i.id === issueId);

    return (
        <div className={`bg-gradient-to-br from-[#0d1117] to-[#161b22] rounded-2xl border border-[#30363d] overflow-hidden shadow-2xl ${className}`}>
            {/* Hero Header */}
            <div className="relative px-6 py-5 border-b border-[#30363d] bg-gradient-to-r from-[#238636]/10 via-transparent to-[#1f6feb]/10">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMzg2MzYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#238636]/20 rounded-xl">
                            <Sparkles className="w-5 h-5 text-[#3fb950]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Discovery Engine
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#238636]/30 text-[#3fb950] rounded-full uppercase tracking-wide">
                                    Live
                                </span>
                            </h2>
                            <p className="text-sm text-[#8b949e]">
                                Find your next open source contribution
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all ${
                                showFilters 
                                    ? 'bg-[#238636] text-white' 
                                    : 'bg-[#21262d] text-[#8b949e] hover:text-white hover:bg-[#30363d]'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {selectedLabels.length > 1 && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full">
                                    {selectedLabels.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={fetchIssues}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-[#21262d] text-[#8b949e] 
                                hover:text-white hover:bg-[#30363d] rounded-lg transition-all"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-[#161b22]/50 border-b border-[#21262d]">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-sm">
                        <TrendingUp className="w-4 h-4 text-[#3fb950]" />
                        <span className="text-[#8b949e]">{totalCount.toLocaleString()}</span>
                        <span className="text-[#484f58]">issues found</span>
                    </span>
                    {lastFetched && (
                        <span className="flex items-center gap-1.5 text-xs text-[#484f58]">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(lastFetched)}
                        </span>
                    )}
                </div>
                {rateLimitInfo && (
                    <span className="text-xs text-[#484f58]">
                        {rateLimitInfo.remaining}/{rateLimitInfo.limit} API calls
                    </span>
                )}
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="px-6 py-4 bg-[#0d1117] border-b border-[#21262d] space-y-4">
                    {/* Language & Sort Row */}
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Language Selector */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="flex items-center gap-2 text-xs text-[#8b949e] mb-2">
                                <Code className="w-3.5 h-3.5" />
                                Language
                            </label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedLanguage('all')}
                                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                                        selectedLanguage === 'all'
                                            ? 'bg-[#238636] text-white'
                                            : 'bg-[#21262d] text-[#8b949e] hover:text-white hover:bg-[#30363d]'
                                    }`}
                                >
                                    All
                                </button>
                                {languages.slice(0, 6).map(lang => (
                                    <button
                                        key={lang}
                                        onClick={() => setSelectedLanguage(lang)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                                            selectedLanguage === lang
                                                ? 'bg-[#238636] text-white'
                                                : 'bg-[#21262d] text-[#8b949e] hover:text-white hover:bg-[#30363d]'
                                        }`}
                                    >
                                        <span>{LANGUAGE_CONFIG[lang]?.icon || '📄'}</span>
                                        {lang}
                                    </button>
                                ))}
                                <select
                                    value={selectedLanguage}
                                    onChange={(e) => setSelectedLanguage(e.target.value)}
                                    className="px-3 py-1.5 text-xs bg-[#21262d] text-[#8b949e] rounded-lg border-0 
                                        focus:outline-none focus:ring-1 focus:ring-[#238636] cursor-pointer"
                                >
                                    <option value="">More...</option>
                                    {languages.slice(6).map(lang => (
                                        <option key={lang} value={lang}>{lang}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Sort */}
                        <div>
                            <label className="flex items-center gap-2 text-xs text-[#8b949e] mb-2">
                                <Filter className="w-3.5 h-3.5" />
                                Sort by
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-1.5 text-xs bg-[#21262d] text-[#c9d1d9] rounded-lg border-0 
                                    focus:outline-none focus:ring-1 focus:ring-[#238636] cursor-pointer"
                            >
                                <option value="created">🆕 Newest</option>
                                <option value="updated">🔄 Recently Updated</option>
                                <option value="comments">💬 Most Discussed</option>
                                <option value="reactions">🔥 Most Popular</option>
                            </select>
                        </div>
                    </div>

                    {/* Labels Section */}
                    <div>
                        <label className="flex items-center gap-2 text-xs text-[#8b949e] mb-2">
                            <Tag className="w-3.5 h-3.5" />
                            Issue Labels
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {COMMON_LABELS.map(label => {
                                const isSelected = selectedLabels.includes(label.value);
                                return (
                                    <button
                                        key={label.value}
                                        onClick={() => toggleLabel(label.value)}
                                        className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                                            isSelected 
                                                ? 'ring-2 ring-offset-1 ring-offset-[#0d1117]' 
                                                : 'opacity-60 hover:opacity-100'
                                        }`}
                                        style={{
                                            backgroundColor: `#${label.color}20`,
                                            color: `#${label.color}`,
                                            borderColor: `#${label.color}40`,
                                            ringColor: isSelected ? `#${label.color}` : undefined
                                        }}
                                    >
                                        <span>{label.icon}</span>
                                        {label.label}
                                        {isSelected && <Check className="w-3 h-3 ml-1" />}
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* Custom Label Input */}
                        <div className="flex gap-2 mt-3">
                            <input
                                type="text"
                                value={customLabel}
                                onChange={(e) => setCustomLabel(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCustomLabel()}
                                placeholder="Add custom label..."
                                className="flex-1 max-w-[200px] px-3 py-1.5 text-xs bg-[#0d1117] border border-[#30363d] 
                                    rounded-lg text-[#c9d1d9] placeholder-[#484f58] focus:outline-none focus:border-[#238636]"
                            />
                            <button
                                onClick={addCustomLabel}
                                disabled={!customLabel.trim()}
                                className="px-3 py-1.5 text-xs bg-[#238636] text-white rounded-lg hover:bg-[#2ea043] 
                                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Active Filters Summary */}
                    {(selectedLabels.length > 0 || selectedLanguage !== 'all') && (
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#21262d]">
                            <span className="text-xs text-[#484f58]">Active:</span>
                            {selectedLabels.map(label => {
                                const labelInfo = COMMON_LABELS.find(l => l.value === label);
                                return (
                                    <span
                                        key={label}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full cursor-pointer hover:opacity-80"
                                        style={{
                                            backgroundColor: labelInfo ? `#${labelInfo.color}20` : '#21262d',
                                            color: labelInfo ? `#${labelInfo.color}` : '#8b949e',
                                        }}
                                        onClick={() => selectedLabels.length > 1 && toggleLabel(label)}
                                    >
                                        {labelInfo?.icon} {labelInfo?.label || label}
                                        {selectedLabels.length > 1 && <X className="w-3 h-3" />}
                                    </span>
                                );
                            })}
                            {selectedLanguage !== 'all' && (
                                <span 
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[#1f6feb]/20 text-[#58a6ff] rounded-full cursor-pointer hover:opacity-80"
                                    onClick={() => setSelectedLanguage('all')}
                                >
                                    {LANGUAGE_CONFIG[selectedLanguage]?.icon} {selectedLanguage}
                                    <X className="w-3 h-3" />
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {loading && issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-2 border-[#238636]/30 border-t-[#238636] animate-spin" />
                            <Sparkles className="w-5 h-5 text-[#238636] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-sm text-[#8b949e]">Discovering issues...</p>
                    </div>
                ) : error ? (
                    <div className="px-6 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <p className="text-sm text-red-400 mb-2">{error}</p>
                        <button
                            onClick={fetchIssues}
                            className="mt-2 px-4 py-2 text-sm bg-[#21262d] text-[#c9d1d9] rounded-lg hover:bg-[#30363d] transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : issues.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#21262d] mb-4">
                            <Search className="w-8 h-8 text-[#484f58]" />
                        </div>
                        <p className="text-sm text-[#8b949e]">No issues found</p>
                        <p className="text-xs text-[#484f58] mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#21262d]">
                        {issues.map((issue, index) => {
                            const { owner, repo } = parseRepoInfo(issue.repository_url);
                            const isSaved = isIssueSaved(issue.id);
                            
                            return (
                                <a
                                    key={issue.id}
                                    href={issue.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block px-6 py-4 hover:bg-[#161b22] transition-all duration-200"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Issue Number Badge */}
                                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#238636]/10 flex items-center justify-center">
                                            <BookOpen className="w-5 h-5 text-[#3fb950]" />
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            {/* Repository */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <GitFork className="w-3.5 h-3.5 text-[#484f58]" />
                                                <span className="text-xs text-[#8b949e] hover:text-[#58a6ff] truncate">
                                                    {owner}/{repo}
                                                </span>
                                                <span className="text-[#30363d]">•</span>
                                                <span className="flex items-center gap-1 text-xs text-[#484f58]">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTimeAgo(issue.created_at)}
                                                </span>
                                            </div>

                                            {/* Title */}
                                            <h3 className="text-sm font-medium text-[#c9d1d9] group-hover:text-[#3fb950] transition-colors line-clamp-2 mb-2">
                                                {issue.title}
                                            </h3>

                                            {/* Labels */}
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {issue.labels?.slice(0, 4).map((label) => (
                                                    <span
                                                        key={label.id}
                                                        className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                                                        style={{
                                                            backgroundColor: `#${label.color}15`,
                                                            color: `#${label.color}`,
                                                            border: `1px solid #${label.color}30`
                                                        }}
                                                    >
                                                        {label.name}
                                                    </span>
                                                ))}
                                                {issue.labels?.length > 4 && (
                                                    <span className="px-2 py-0.5 text-[10px] text-[#484f58] bg-[#21262d] rounded-full">
                                                        +{issue.labels.length - 4}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Stats */}
                                            <div className="flex items-center gap-4 text-xs text-[#484f58]">
                                                <span className="flex items-center gap-1">
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    {issue.comments}
                                                </span>
                                                {issue.reactions?.total_count > 0 && (
                                                    <span className="flex items-center gap-1 text-orange-400">
                                                        <Flame className="w-3.5 h-3.5" />
                                                        {issue.reactions.total_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => toggleSaveIssue(issue, e)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    isSaved 
                                                        ? 'bg-[#1f6feb]/20 text-[#58a6ff]' 
                                                        : 'bg-[#21262d] text-[#484f58] hover:text-[#c9d1d9]'
                                                }`}
                                            >
                                                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                                            </button>
                                            <div className="p-2 bg-[#21262d] rounded-lg text-[#484f58] group-hover:text-[#3fb950] group-hover:bg-[#238636]/20 transition-colors">
                                                <ExternalLink className="w-4 h-4" />
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
            <div className="px-6 py-3 border-t border-[#21262d] bg-[#0d1117] flex items-center justify-between">
                <p className="text-xs text-[#484f58]">
                    Powered by GitHub Search API
                </p>
                {savedIssues.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-[#58a6ff]">
                        <Bookmark className="w-3.5 h-3.5 fill-current" />
                        {savedIssues.length} saved
                    </span>
                )}
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0d1117;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #30363d;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #484f58;
                }
            `}</style>
        </div>
    );
};

export default DiscoveryEngine;
