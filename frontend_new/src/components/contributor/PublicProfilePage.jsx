import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, ArrowLeft, ExternalLink, Users } from 'lucide-react';
import { profileApi, gamificationApi } from '../../services/api';
import ContributionStats from '../profile/ContributionStats';
import FeaturedBadges from './FeaturedBadges';

const PublicProfilePage = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
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
            
            // Try to get OpenTriage profile first
            let profileData = null;
            let githubStatsData = null;
            let featuredData = { badges: [] };
            
            // Fetch profile - wrapped in its own try-catch so we can fallback to GitHub
            try {
                profileData = await profileApi.getProfile(username);
            } catch (e) {
                // Profile not found in database - that's ok, we'll try GitHub
                console.log('Profile not in OpenTriage database, will try GitHub fallback');
            }
            
            // If we have profile data, also fetch featured badges and stats
            if (profileData) {
                try {
                    [featuredData, githubStatsData] = await Promise.all([
                        profileApi.getFeaturedBadges(username).catch(() => ({ badges: [] })),
                        profileApi.getGitHubStats(username).catch(() => null)
                    ]);
                } catch (e) {
                    console.log('Could not fetch additional profile data');
                }
            }

            // If no profile in database, fetch from GitHub API directly
            if (!profileData) {
                try {
                    const githubRes = await fetch(`https://api.github.com/users/${username}`);
                    if (githubRes.ok) {
                        const githubUser = await githubRes.json();
                        
                        // Also fetch contribution data from GitHub events
                        let recentActivity = 0;
                        try {
                            const eventsRes = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`);
                            if (eventsRes.ok) {
                                const events = await eventsRes.json();
                                recentActivity = events.length;
                            }
                        } catch (e) {
                            console.log('Could not fetch events:', e);
                        }
                        
                        setProfile({
                            username: githubUser.login,
                            avatar_url: githubUser.avatar_url,
                            bio: githubUser.bio || '',
                            name: githubUser.name,
                            location: githubUser.location,
                            company: githubUser.company,
                            skills: [],
                            isGitHubFallback: true,
                            github_stats: {
                                public_repos: githubUser.public_repos || 0,
                                followers: githubUser.followers || 0,
                                following: githubUser.following || 0,
                                totalContributions: recentActivity,
                                public_gists: githubUser.public_gists || 0,
                            }
                        });
                        setLoading(false);
                        return;
                    } else {
                        setNotFound(true);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.log('GitHub API fallback failed:', e);
                    setNotFound(true);
                    setLoading(false);
                    return;
                }
            }

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
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

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
                                {profile?.isGitHubFallback && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                                        Not on OpenTriage
                                    </span>
                                )}
                                {profile?.available_for_mentoring && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        Available for Mentoring
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

                {/* Contribution Stats with Heatmap */}
                <ContributionStats 
                    username={username} 
                    githubStats={profile?.github_stats}
                    isGitHubFallback={profile?.isGitHubFallback}
                />
            </div>
        </div>
    );
};

export default PublicProfilePage;
