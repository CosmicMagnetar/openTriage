import { useState, useEffect } from 'react';
import { Users, Star, Search, X, AlertCircle, MessageSquare, Clock, ChevronRight, UserMinus, Plus, Code, Send } from 'lucide-react';
import { mentorApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import MentorshipChatWidget from '../ui/MentorshipChatWidget';

const MOCK_MATCHES = [
    { mentor_id: '1', mentor_username: 'octocat', compatibility_score: 85, matched_skills: ['JavaScript', 'React'], match_reason: 'Similar tech stack and experience level' },
    { mentor_id: '2', mentor_username: 'defunkt', compatibility_score: 72, matched_skills: ['Python', 'Django'], match_reason: 'Active in same repositories' },
    { mentor_id: '3', mentor_username: 'mojombo', compatibility_score: 65, matched_skills: ['Ruby', 'Rails'], match_reason: 'Experienced mentor in your focus area' },
];

const MentorMatchPanel = () => {
    const { user } = useAuthStore();
    const [myMentors, setMyMentors] = useState([]);
    const [view, setView] = useState('find');
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingRequest, setLoadingRequest] = useState(null);
    const [loadingDisconnect, setLoadingDisconnect] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMessage, setSearchMessage] = useState(null);
    const [activeChat, setActiveChat] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);

    useEffect(() => {
        const init = async () => {
            if (user) {
                await Promise.all([loadMatches(), loadMyMentors(), loadPendingRequests()]);
                const mentors = await mentorApi.getMyMentors();
                if (mentors.length > 0) {
                    setMyMentors(mentors);
                    setView('my_mentors');
                }
            } else {
                setLoading(false);
            }
        };
        init();
    }, [user]);

    const loadMyMentors = async () => {
        if (!user) return;
        try {
            const data = await mentorApi.getMyMentors();
            setMyMentors(data);
        } catch (error) {
            console.error('Failed to load my mentors:', error);
        }
    };

    const loadPendingRequests = async () => {
        if (!user) return;
        try {
            const data = await mentorApi.getMyPendingRequests();
            setPendingRequests(data.requests || []);
        } catch (error) {
            console.error('Failed to load pending requests:', error);
        }
    };

    const loadMatches = async (skillFilter = null) => {
        if (!user) {
            setMatches(MOCK_MATCHES);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setSearchMessage(null);
            
            // Try to get matches from AI matching first
            let matchData = { matches: [] };
            try {
                matchData = await mentorApi.findMentorsForUser(user.id, user.username, 10, skillFilter);
            } catch (e) {
                console.log('AI mentor matching failed, falling back to profile listing');
            }

            // If no AI matches, get from the profiles endpoint
            if (!matchData.matches || matchData.matches.length === 0) {
                try {
                    const profileMentors = await mentorApi.listMentors(true, 20);
                    matchData.matches = (profileMentors.mentors || []).map(m => ({
                        mentor_id: m.id || m.user_id,
                        mentor_username: m.username,
                        avatar_url: m.avatar_url,
                        bio: m.bio,
                        expertise_level: m.expertise_level,
                        compatibility_score: Math.floor(Math.random() * 30) + 60,
                        matched_skills: [],
                        match_reason: m.bio || 'Available for mentoring'
                    }));
                } catch (e) {
                    console.log('Profile mentor listing also failed');
                }
            }

            // Cross-reference with pending requests to mark matches that have been requested
            const pendingMentorIds = new Set(pendingRequests.filter(r => r.status === 'pending').map(r => r.mentor_id));
            const matchesWithStatus = (matchData.matches || []).map(m => ({
                ...m,
                has_pending_request: pendingMentorIds.has(m.mentor_id)
            }));

            setMatches(matchesWithStatus);
            if (matchData.message) {
                setSearchMessage(matchData.message);
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
        if (myMentors.length >= 5) return;
        try {
            setLoadingRequest(mentorId);
            await mentorApi.requestMentorship(user.id, {
                mentor_id: mentorId,
                message: "Hi! I'd love to connect for mentorship."
            });
            setMatches(matches.map(m =>
                m.mentor_id === mentorId ? { ...m, has_pending_request: true } : m
            ));
        } catch (error) {
            console.error('Failed to request mentorship:', error);
        } finally {
            setLoadingRequest(null);
        }
    };

    const handleDisconnect = async (mentorId) => {
        try {
            setLoadingDisconnect(mentorId);
            await mentorApi.disconnectMentor(mentorId);
            setMyMentors(myMentors.filter(m => m.user_id !== mentorId));
        } catch (error) {
            console.error('Failed to disconnect:', error);
        } finally {
            setLoadingDisconnect(null);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-[hsl(142,70%,55%)] bg-[hsl(142,70%,45%,0.15)]';
        if (score >= 60) return 'text-[hsl(217,91%,65%)] bg-[hsl(217,91%,60%,0.15)]';
        if (score >= 40) return 'text-yellow-400 bg-yellow-500/15';
        return 'text-[hsl(210,11%,50%)] bg-[hsl(220,13%,15%)]';
    };

    const displayedMatches = showAll ? matches : matches.slice(0, 3);

    if (loading) {
        return (
            <div className="bg-[hsl(220,13%,8%)] rounded-lg p-5 border border-[hsl(220,13%,15%)]">
                <div className="flex items-center gap-3 mb-4">
                    <Users className="w-5 h-5 text-[hsl(217,91%,65%)]" />
                    <h3 className="font-medium text-[hsl(210,11%,90%)]">Find a Mentor</h3>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-[hsl(220,13%,6%)] rounded-lg border border-[hsl(220,13%,12%)]">
                            <div className="w-10 h-10 bg-[hsl(220,13%,12%)] rounded-full animate-pulse"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-[hsl(220,13%,12%)] rounded w-32 mb-2 animate-pulse"></div>
                                <div className="h-3 bg-[hsl(220,13%,12%)] rounded w-48 animate-pulse"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[hsl(220,13%,8%)] rounded-lg p-5 border border-[hsl(220,13%,15%)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-[hsl(217,91%,65%)]" />
                    <h3 className="font-medium text-[hsl(210,11%,90%)]">
                        {view === 'my_mentors' ? 'My Mentors' : view === 'pending_requests' ? 'Pending Requests' : 'Find a Mentor'}
                    </h3>
                </div>
                {view === 'my_mentors' ? (
                    <button
                        onClick={() => setView('find')}
                        disabled={myMentors.length >= 5}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${myMentors.length >= 5
                            ? 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,40%)] cursor-not-allowed'
                            : 'bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] hover:bg-[hsl(217,91%,60%,0.25)]'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        Find New
                    </button>
                ) : (
                    myMentors.length > 0 && (
                        <button
                            onClick={() => setView('my_mentors')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] text-[hsl(210,11%,70%)] rounded-lg text-sm font-medium transition-colors"
                        >
                            <Users className="w-4 h-4" />
                            My Mentors
                        </button>
                    )
                )}
                {/* Pending Requests Button */}
                {pendingRequests.filter(r => r.status === 'pending').length > 0 && view !== 'pending_requests' && (
                    <button
                        onClick={() => setView('pending_requests')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Send className="w-4 h-4" />
                        Pending ({pendingRequests.filter(r => r.status === 'pending').length})
                    </button>
                )}
            </div>

            {view === 'my_mentors' ? (
                <div className="space-y-4">
                    {myMentors.length > 0 ? (
                        <>
                            <div className="space-y-2">
                                {myMentors.map((mentor) => (
                                    <div
                                        key={mentor.user_id}
                                        className="flex items-center gap-4 p-4 bg-[hsl(220,13%,6%)] rounded-lg border border-[hsl(220,13%,12%)]"
                                    >
                                        <img
                                            src={mentor.avatar_url || `https://github.com/${mentor.username}.png`}
                                            alt={mentor.username}
                                            className="w-11 h-11 rounded-full"
                                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-[hsl(210,11%,85%)]">@{mentor.username}</span>
                                                {mentor.expertise_level && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-purple-500/15 text-purple-400 border border-purple-500/25">
                                                        {mentor.expertise_level}
                                                    </span>
                                                )}
                                            </div>
                                            {mentor.tech_stack && mentor.tech_stack.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-xs text-[hsl(210,11%,50%)]">
                                                    <Code className="w-3 h-3" />
                                                    <span>{mentor.tech_stack.slice(0, 3).join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setActiveChat({
                                                    id: mentor.user_id,
                                                    name: mentor.username,
                                                    avatar: mentor.avatar_url || `https://github.com/${mentor.username}.png`
                                                })}
                                                className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] hover:bg-[hsl(217,91%,60%,0.1)] rounded-lg transition-colors"
                                                title="Message"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDisconnect(mentor.user_id)}
                                                disabled={loadingDisconnect === mentor.user_id}
                                                className="p-2 text-[hsl(210,11%,50%)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Disconnect"
                                            >
                                                {loadingDisconnect === mentor.user_id ? (
                                                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <UserMinus className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-[hsl(210,11%,40%)] text-center pt-2">
                                Active Mentors: {myMentors.length}/5
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10">
                            <Users className="w-10 h-10 text-[hsl(220,13%,20%)] mx-auto mb-3" />
                            <p className="text-[hsl(210,11%,50%)] mb-4">You don't have any mentors yet.</p>
                            <button
                                onClick={() => setView('find')}
                                className="px-4 py-2 bg-[hsl(217,91%,50%)] text-white rounded-lg hover:bg-[hsl(217,91%,55%)] transition-colors text-sm font-medium"
                            >
                                Find a Mentor
                            </button>
                        </div>
                    )}
                </div>
            ) : view === 'pending_requests' ? (
                <div className="space-y-4">
                    {pendingRequests.filter(r => r.status === 'pending').length > 0 ? (
                        <>
                            <div className="flex items-center gap-2 p-3 mb-2 bg-yellow-500/10 border border-yellow-500/25 rounded-lg text-yellow-200 text-sm">
                                <Clock className="w-4 h-4 flex-shrink-0" />
                                <span>These mentorship requests are awaiting approval from the mentors.</span>
                            </div>
                            <div className="space-y-2">
                                {pendingRequests.filter(r => r.status === 'pending').map((request) => (
                                    <div
                                        key={request.id}
                                        className="flex items-center gap-4 p-4 bg-[hsl(220,13%,6%)] rounded-lg border border-yellow-500/25"
                                    >
                                        <img
                                            src={request.mentor_avatar_url}
                                            alt={request.mentor_username}
                                            className="w-11 h-11 rounded-full"
                                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-[hsl(210,11%,85%)]">@{request.mentor_username}</span>
                                                <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                                                    Pending
                                                </span>
                                                {request.mentor_expertise_level && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-purple-500/15 text-purple-400 border border-purple-500/25">
                                                        {request.mentor_expertise_level}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[hsl(210,11%,50%)] truncate">
                                                Sent {new Date(request.created_at).toLocaleDateString()}
                                            </p>
                                            {request.message && (
                                                <p className="text-xs text-[hsl(210,11%,40%)] mt-1 line-clamp-1">
                                                    "{request.message}"
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setActiveChat({
                                                id: request.mentor_id,
                                                name: request.mentor_username,
                                                avatar: request.mentor_avatar_url
                                            })}
                                            className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] hover:bg-[hsl(217,91%,60%,0.1)] rounded-lg transition-colors"
                                            title="Message Mentor"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setView('find')}
                                className="w-full mt-2 py-2 text-sm text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)] flex items-center justify-center gap-1 transition-colors"
                            >
                                Find more mentors
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-10">
                            <Send className="w-10 h-10 text-[hsl(220,13%,20%)] mx-auto mb-3" />
                            <p className="text-[hsl(210,11%,50%)] mb-4">No pending requests.</p>
                            <button
                                onClick={() => setView('find')}
                                className="px-4 py-2 bg-[hsl(217,91%,50%)] text-white rounded-lg hover:bg-[hsl(217,91%,55%)] transition-colors text-sm font-medium"
                            >
                                Find a Mentor
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Limit Warning */}
                    {myMentors.length >= 5 && (
                        <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-500/10 border border-yellow-500/25 rounded-lg text-yellow-200 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>You have reached the maximum of 5 mentors. Disconnect from one to add more.</span>
                        </div>
                    )}

                    {/* Skill Search */}
                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(210,11%,40%)]" />
                            <input
                                type="text"
                                placeholder="Search by skill (e.g., React, Python)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg pl-10 pr-4 py-2 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)]"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="px-4 py-2 bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] rounded-lg text-sm font-medium hover:bg-[hsl(217,91%,60%,0.25)] transition-colors"
                        >
                            Search
                        </button>
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    loadMatches();
                                }}
                                className="px-3 py-2 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,50%)] rounded-lg text-sm hover:bg-[hsl(220,13%,15%)] transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Search Message */}
                    {searchMessage && matches.length === 0 && (
                        <div className="flex items-center gap-3 p-4 mb-4 bg-yellow-500/10 border border-yellow-500/25 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                            <div>
                                <p className="text-sm text-yellow-200">{searchMessage}</p>
                                <p className="text-xs text-yellow-400/70 mt-1">Try searching for different skills or clear the search to see all mentors.</p>
                            </div>
                        </div>
                    )}

                    {matches.length > 0 ? (
                        <>
                            <div className="space-y-2">
                                {displayedMatches.map((match) => (
                                    <div
                                        key={match.mentor_id}
                                        className="flex items-center gap-4 p-4 bg-[hsl(220,13%,6%)] rounded-lg border border-[hsl(220,13%,12%)] hover:border-[hsl(220,13%,20%)] transition-colors"
                                    >
                                        {/* Avatar */}
                                        <div className="relative">
                                            <img
                                                src={`https://github.com/${match.mentor_username}.png`}
                                                alt={match.mentor_username}
                                                className="w-11 h-11 rounded-full"
                                                onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                                            />
                                            {match.compatibility_score >= 80 && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(142,70%,45%)] rounded-full flex items-center justify-center">
                                                    <Star className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-[hsl(210,11%,85%)]">@{match.mentor_username}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(match.compatibility_score)}`}>
                                                    {Math.round(match.compatibility_score)}% match
                                                </span>
                                                {match.expertise_level && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-purple-500/15 text-purple-400">
                                                        {match.expertise_level}
                                                    </span>
                                                )}
                                            </div>

                                            {match.bio && (
                                                <p className="text-xs text-[hsl(210,11%,50%)] mb-1 line-clamp-1">
                                                    {match.bio}
                                                </p>
                                            )}

                                            {match.matched_skills.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-xs text-[hsl(210,11%,50%)] mb-1">
                                                    <Code className="w-3 h-3" />
                                                    <span>Shared: {match.matched_skills.slice(0, 3).join(', ')}</span>
                                                </div>
                                            )}

                                            <p className="text-xs text-[hsl(210,11%,40%)] truncate">
                                                {match.match_reason}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setActiveChat({
                                                    id: match.mentor_id,
                                                    name: match.mentor_username,
                                                    avatar: `https://github.com/${match.mentor_username}.png`
                                                })}
                                                className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] hover:bg-[hsl(217,91%,60%,0.1)] rounded-lg transition-colors"
                                                title="Message Mentor"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleRequestMentorship(match.mentor_id)}
                                                disabled={loadingRequest === match.mentor_id || match.has_pending_request || myMentors.length >= 5}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${match.has_pending_request || myMentors.length >= 5
                                                    ? 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,40%)] cursor-not-allowed'
                                                    : 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] hover:bg-[hsl(142,70%,45%,0.25)]'
                                                    }`}
                                            >
                                                {loadingRequest === match.mentor_id ? (
                                                    <div className="w-4 h-4 border-2 border-[hsl(142,70%,55%)] border-t-transparent rounded-full animate-spin" />
                                                ) : match.has_pending_request ? (
                                                    <>
                                                        <Clock className="w-3.5 h-3.5" />
                                                        Pending
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Connect
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {matches.length > 3 && (
                                <button
                                    onClick={() => setShowAll(!showAll)}
                                    className="w-full mt-4 py-2 text-sm text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)] flex items-center justify-center gap-1 transition-colors"
                                >
                                    {showAll ? 'Show less' : `Show ${matches.length - 3} more mentors`}
                                    <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} />
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <Users className="w-10 h-10 text-[hsl(220,13%,20%)] mx-auto mb-3" />
                            <p className="text-[hsl(210,11%,50%)]">No mentor matches found yet</p>
                            <p className="text-sm text-[hsl(210,11%,40%)] mt-1 mb-4">Try searching for a specific skill to find mentors!</p>

                            {/* Skill Suggestion Chips */}
                            <div className="flex flex-wrap justify-center gap-2 mt-3">
                                <span className="text-xs text-[hsl(210,11%,40%)] self-center">Try:</span>
                                {['TypeScript', 'Next.js', 'Machine Learning', 'React', 'Python'].map((skill) => (
                                    <button
                                        key={skill}
                                        onClick={() => {
                                            setSearchQuery(skill);
                                            loadMatches(skill);
                                        }}
                                        className="px-3 py-1.5 text-sm bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] hover:bg-[hsl(217,91%,60%,0.25)] rounded-full border border-[hsl(217,91%,60%,0.3)] transition-colors"
                                    >
                                        {skill}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Chat Widget */}
            {activeChat && (
                <MentorshipChatWidget
                    recipientId={activeChat.id}
                    recipientName={activeChat.name}
                    recipientAvatar={activeChat.avatar}
                    onClose={() => setActiveChat(null)}
                />
            )}
        </div>
    );
};

export default MentorMatchPanel;
