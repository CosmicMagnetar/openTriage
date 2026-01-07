import { useState, useEffect } from 'react';
import { Users, Star, ArrowRight, Sparkles, Search, X, AlertCircle, MessageSquare } from 'lucide-react';
import { mentorApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import MentorshipChatWidget from '../ui/MentorshipChatWidget';

// Mock data for when API is unavailable
const MOCK_MATCHES = [
    { mentor_id: '1', mentor_username: 'octocat', compatibility_score: 85, matched_skills: ['JavaScript', 'React'], match_reason: 'Similar tech stack and experience level' },
    { mentor_id: '2', mentor_username: 'defunkt', compatibility_score: 72, matched_skills: ['Python', 'Django'], match_reason: 'Active in same repositories' },
    { mentor_id: '3', mentor_username: 'mojombo', compatibility_score: 65, matched_skills: ['Ruby', 'Rails'], match_reason: 'Experienced mentor in your focus area' },
];

const MentorMatchPanel = () => {
    const { user } = useAuthStore();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingRequest, setLoadingRequest] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMessage, setSearchMessage] = useState(null);
    const [activeChat, setActiveChat] = useState(null); // { id, name, avatar }

    useEffect(() => {
        loadMatches();
    }, [user]);

    const loadMatches = async (skillFilter = null) => {
        if (!user) {
            setMatches(MOCK_MATCHES);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setSearchMessage(null);
            const data = await mentorApi.findMentorsForUser(user.id, user.username, 10, skillFilter);
            setMatches(data.matches || []);

            // Show message from API if no matches
            if (data.message) {
                setSearchMessage(data.message);
            }
        } catch (error) {
            console.error('Failed to load mentor matches:', error);
            setMatches(MOCK_MATCHES);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (searchQuery.trim()) {
            loadMatches(searchQuery.trim());
        } else {
            loadMatches();
        }
    };

    const handleRequestMentorship = async (mentorId) => {
        try {
            setLoadingRequest(mentorId);
            await mentorApi.requestMentorship(user.id, {
                mentor_id: mentorId,
                message: "Hi! I'd love to connect for mentorship."
            });

            // Update UI
            setMatches(matches.map(m =>
                m.mentor_id === mentorId
                    ? { ...m, has_pending_request: true }
                    : m
            ));
        } catch (error) {
            console.error('Failed to request mentorship:', error);
        } finally {
            setLoadingRequest(null);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-400 bg-emerald-500/20';
        if (score >= 60) return 'text-blue-400 bg-blue-500/20';
        if (score >= 40) return 'text-yellow-400 bg-yellow-500/20';
        return 'text-slate-400 bg-slate-500/20';
    };

    const displayedMatches = showAll ? matches : matches.slice(0, 3);

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-semibold text-slate-200">Find a Mentor</h3>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg">
                            <div className="w-10 h-10 bg-slate-700 rounded-full"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-slate-700 rounded w-32 mb-2"></div>
                                <div className="h-3 bg-slate-700 rounded w-48"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-semibold text-slate-200">Find a Mentor</h3>
                </div>
                <span className="text-xs text-slate-400">{matches.length} matches found</span>
            </div>

            {/* Skill Search */}
            <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by skill (e.g., React, Python)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    className="px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-500/30 transition-colors"
                >
                    Search
                </button>
                {searchQuery && (
                    <button
                        onClick={() => {
                            setSearchQuery('');
                            loadMatches();
                        }}
                        className="px-3 py-2 bg-slate-700 text-slate-400 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Search Message */}
            {searchMessage && matches.length === 0 && (
                <div className="flex items-center gap-3 p-4 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm text-amber-200">{searchMessage}</p>
                        <p className="text-xs text-amber-400/70 mt-1">Try searching for different skills or clear the search to see all mentors.</p>
                    </div>
                </div>
            )}

            {matches.length > 0 ? (
                <>
                    {/* Mentor Cards */}
                    <div className="space-y-3">
                        {displayedMatches.map((match) => (
                            <div
                                key={match.mentor_id}
                                className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                            >
                                {/* Avatar */}
                                <div className="relative">
                                    <img
                                        src={`https://github.com/${match.mentor_username}.png`}
                                        alt={match.mentor_username}
                                        className="w-12 h-12 rounded-full"
                                        onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                    />
                                    {
                                        match.compatibility_score >= 80 && (
                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                                <Star className="w-3 h-3 text-white" />
                                            </div>
                                        )
                                    }
                                </div >

                                {/* Info */}
                                < div className="flex-1 min-w-0" >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-slate-200">@{match.mentor_username}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getScoreColor(match.compatibility_score)}`}>
                                            {Math.round(match.compatibility_score)}% match
                                        </span>
                                        {match.expertise_level && (
                                            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
                                                {match.expertise_level}
                                            </span>
                                        )}
                                    </div>

                                    {
                                        match.bio && (
                                            <p className="text-xs text-slate-400 mb-1 line-clamp-1">
                                                {match.bio}
                                            </p>
                                        )
                                    }

                                    {
                                        match.matched_skills.length > 0 && (
                                            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                                                <Sparkles className="w-3 h-3" />
                                                <span>Shared skills: {match.matched_skills.slice(0, 3).join(', ')}</span>
                                            </div>
                                        )
                                    }

                                    <p className="text-xs text-slate-500 truncate">
                                        {match.match_reason}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveChat({
                                            id: match.mentor_id,
                                            name: match.mentor_username,
                                            avatar: `https://github.com/${match.mentor_username}.png`
                                        })}
                                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        title="Message Mentor"
                                    >
                                        <MessageSquare className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleRequestMentorship(match.mentor_id)}
                                        disabled={loadingRequest === match.mentor_id || match.has_pending_request}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                            ${match.has_pending_request
                                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'}`}
                                    >
                                        {loadingRequest === match.mentor_id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400" />
                                        ) : match.has_pending_request ? (
                                            <>
                                                <Clock className="w-4 h-4" />
                                                Pending
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                Connect
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div >
                        ))}
                    </div >

                    {/* Show More */}
                    {
                        matches.length > 3 && (
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 transition-colors"
                            >
                                {showAll ? 'Show less' : `Show ${matches.length - 3} more mentors`}
                                <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} />
                            </button>
                        )
                    }
                </>
            ) : (
                <div className="text-center py-8">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No mentor matches found yet</p>
                    <p className="text-sm text-slate-500 mt-1">Contribute more to find compatible mentors!</p>
                </div>
            )}
            {/* Chat Widget */}
            {
                activeChat && (
                    <MentorshipChatWidget
                        recipientId={activeChat.id}
                        recipientName={activeChat.name}
                        recipientAvatar={activeChat.avatar}
                        onClose={() => setActiveChat(null)}
                    />
                )
            }
        </div >
    );
};

export default MentorMatchPanel;
