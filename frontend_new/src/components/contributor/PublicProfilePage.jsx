import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Code, ArrowLeft, Flame, Trophy, Calendar, BarChart3, ExternalLink, Users } from 'lucide-react';
import { profileApi, gamificationApi } from '../../services/api';
import { toast } from 'sonner';
import ContributionStats from '../profile/ContributionStats';
import FeaturedBadges from './FeaturedBadges';

const PublicProfilePage = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allBadges, setAllBadges] = useState([]);
    const [featuredBadges, setFeaturedBadges] = useState([]);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (username) {
            loadProfile();
        }
    }, [username]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setNotFound(false);
            
            const [profileData, badgesData, featuredData, githubStatsData] = await Promise.all([
                profileApi.getProfile(username).catch(() => null),
                gamificationApi.getUserBadges(username).catch(() => ({ all_badges: [] })),
                profileApi.getFeaturedBadges(username).catch(() => ({ badges: [] })),
                profileApi.getGitHubStats(username).catch(() => null)
            ]);

            if (!profileData) {
                setNotFound(true);
                return;
            }

            // Transform badges data
            const transformedBadges = (badgesData.all_badges || []).map(b => ({
                badge: {
                    id: b.id,
                    name: b.name,
                    description: b.description,
                    image_url: b.image_url,
                    icon: b.icon,
                    category: b.category,
                    rarity: b.rarity
                },
                earned: b.earned,
                awardedAt: b.awardedAt
            }));
            setAllBadges(transformedBadges);

            // Transform featured badges
            const transformedFeatured = (featuredData.badges || []).map(b => ({
                badge: b.badge || {
                    id: b.id,
                    name: b.name,
                    description: b.description,
                    image_url: b.image_url,
                    icon: b.icon,
                    category: b.category,
                    rarity: b.rarity
                },
                earned: b.earned !== false
            }));
            setFeaturedBadges(transformedFeatured);

            // Merge GitHub stats into profile
            const mergedProfile = {
                ...profileData,
                github_stats: githubStatsData || profileData.github_stats || {}
            };
            setProfile(mergedProfile);
        } catch (error) {
            console.error('Failed to load profile:', error);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'stats', label: 'Stats', icon: BarChart3 },
    ];

    if (loading) {
        return (
            <div className="h-full overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="animate-pulse space-y-6">
                        <div className="h-32 bg-[hsl(220,13%,12%)] rounded-xl"></div>
                        <div className="h-64 bg-[hsl(220,13%,12%)] rounded-xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="h-full overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </button>
                    <div className="bg-[hsl(220,13%,8%)] rounded-xl p-12 border border-[hsl(220,13%,15%)] text-center">
                        <User className="w-16 h-16 text-[hsl(220,13%,25%)] mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-[hsl(210,11%,90%)] mb-2">User Not Found</h2>
                        <p className="text-[hsl(210,11%,50%)]">
                            The user "@{username}" doesn't exist or hasn't created a profile yet.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </button>

                {/* Header */}
                <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                    <div className="flex items-start gap-6">
                        <img
                            src={profile?.avatar_url || `https://github.com/${username}.png`}
                            alt={username}
                            className="w-24 h-24 rounded-full border-4 border-[hsl(220,13%,20%)]"
                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)]">@{username}</h1>
                                <a
                                    href={`https://github.com/${username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[hsl(210,11%,50%)] hover:text-[hsl(217,91%,65%)] transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                {profile?.role && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                        profile.role === 'MAINTAINER' 
                                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                            : 'bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.25)]'
                                    }`}>
                                        {profile.role}
                                    </span>
                                )}
                            </div>
                            <p className="text-[hsl(210,11%,50%)] mt-1">{profile?.bio || 'No bio yet'}</p>

                            {/* Featured Badges (read-only) */}
                            {featuredBadges.length > 0 && (
                                <div className="mt-4 flex items-center gap-2">
                                    {featuredBadges.slice(0, 3).map((badge, i) => (
                                        <div
                                            key={badge.badge?.id || i}
                                            className="w-10 h-10 rounded-md bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] flex items-center justify-center"
                                            title={badge.badge?.name}
                                        >
                                            {badge.badge?.image_url ? (
                                                <img
                                                    src={badge.badge.image_url}
                                                    alt={badge.badge.name}
                                                    className="w-full h-full object-contain rounded-md"
                                                />
                                            ) : (
                                                <span className="text-xl">{badge.badge?.icon || '🏆'}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Quick Stats */}
                            <div className="flex items-center gap-6 mt-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Flame className="w-4 h-4 text-orange-400" />
                                    <span className="text-[hsl(210,11%,75%)]">{profile?.github_stats?.current_streak || 0} day streak</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Code className="w-4 h-4 text-[hsl(217,91%,65%)]" />
                                    <span className="text-[hsl(210,11%,75%)]">{profile?.skills?.length || 0} skills</span>
                                </div>
                                {profile?.available_for_mentoring && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Users className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                                        <span className="text-[hsl(142,70%,55%)]">Available for mentoring</span>
                                    </div>
                                )}
                            </div>

                            {/* Skills */}
                            {profile?.skills?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {profile.skills.slice(0, 8).map((skill, i) => (
                                        <span key={i} className="px-2 py-1 bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] rounded-full text-xs">
                                            {skill}
                                        </span>
                                    ))}
                                    {profile.skills.length > 8 && (
                                        <span className="px-2 py-1 bg-[hsl(220,13%,15%)] text-[hsl(210,11%,50%)] rounded-full text-xs">
                                            +{profile.skills.length - 8} more
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-[hsl(220,13%,15%)] pb-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors
                                    ${activeTab === tab.id
                                        ? 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,90%)]'
                                        : 'text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)]'}`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {activeTab === 'overview' && (
                        <>
                            {/* Earned Badges */}
                            {allBadges.filter(b => b.earned).length > 0 && (
                                <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                                    <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-4 flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                        Earned Badges ({allBadges.filter(b => b.earned).length})
                                    </h2>
                                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                                        {allBadges.filter(b => b.earned).map((item, i) => (
                                            <div
                                                key={item.badge?.id || i}
                                                className="aspect-square rounded-lg bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] p-2 flex items-center justify-center"
                                                title={item.badge?.name}
                                            >
                                                {item.badge?.image_url ? (
                                                    <img
                                                        src={item.badge.image_url}
                                                        alt={item.badge.name}
                                                        className="w-full h-full object-contain rounded"
                                                    />
                                                ) : (
                                                    <span className="text-2xl">{item.badge?.icon || '🏆'}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* GitHub Stats Summary */}
                            {profile?.github_stats && (
                                <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                                    <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                                        GitHub Stats
                                    </h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-[hsl(220,13%,10%)] rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-[hsl(142,70%,55%)]">
                                                {profile.github_stats.totalContributions?.toLocaleString() || 0}
                                            </div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">Contributions</div>
                                        </div>
                                        <div className="bg-[hsl(220,13%,10%)] rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-[hsl(217,91%,65%)]">
                                                {profile.github_stats.public_repos || 0}
                                            </div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">Repositories</div>
                                        </div>
                                        <div className="bg-[hsl(220,13%,10%)] rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-purple-400">
                                                {profile.github_stats.mergedPRs || 0}
                                            </div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">PRs Merged</div>
                                        </div>
                                        <div className="bg-[hsl(220,13%,10%)] rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-orange-400">
                                                {profile.github_stats.longestStreak || 0}
                                            </div>
                                            <div className="text-xs text-[hsl(210,11%,50%)]">Longest Streak</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'stats' && (
                        <ContributionStats 
                            username={username} 
                            githubStats={profile?.github_stats}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicProfilePage;
