import { useState, useEffect } from 'react';
import { User, Code, GitBranch, Save, Plus, X, RefreshCw, Users, Flame, Trophy, Calendar, BarChart3, Sparkles } from 'lucide-react';
import { profileApi, gamificationApi, trophyApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';
import StreakDisplay from './StreakDisplay';
import TrophyCabinet from './TrophyCabinet';
import ContributionCalendar from './ContributionCalendar';
import MentorMatchPanel from './MentorMatchPanel';
import ContributionStats from '../profile/ContributionStats';
import FeaturedBadges from './FeaturedBadges';
import TopLanguages from './TopLanguages';
import ContributorHype from './ContributorHype';
import HypeScreen from './HypeScreen';
import BadgeUnlockModal from '../ui/BadgeUnlockModal';
import { useBadgeNotification } from '../../hooks/useBadgeNotification';

const ProfilePage = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [showHypeScreen, setShowHypeScreen] = useState(false);
    const [profile, setProfile] = useState(null);
    const [repos, setRepos] = useState([]);
    const [connectedRepos, setConnectedRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [skillInput, setSkillInput] = useState('');
    const [allBadges, setAllBadges] = useState([]);
    const [featuredBadges, setFeaturedBadges] = useState([]);

    // Badge notification hook - triggers auto-popup for newly earned badges
    const { newBadge, dismissBadge } = useBadgeNotification(user?.username, !loading);

    // Editable fields
    const [bio, setBio] = useState('');
    const [skills, setSkills] = useState([]);
    const [availableForMentoring, setAvailableForMentoring] = useState(false);

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const [profileData, reposData, connectedData, badgesData, featuredData, githubStatsData] = await Promise.all([
                profileApi.getProfile(user.username).catch(() => null),
                profileApi.getUserRepos(user.username).catch(() => ({ repos: [] })),
                profileApi.getConnectedRepos(user.id).catch(() => ({ repos: [] })),
                gamificationApi.getUserBadges(user.username).catch(() => ({ all_badges: [] })),
                profileApi.getFeaturedBadges(user.username).catch(() => ({ badges: [] })),
                profileApi.getGitHubStats(user.username).catch(() => null)
            ]);

            // Transform badges data to expected format: { badge: {...}, earned: bool }
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

            // Transform featured badges similarly
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

            if (profileData) {
                // Merge GitHub stats into profile data
                const mergedProfile = {
                    ...profileData,
                    github_stats: githubStatsData || profileData.github_stats || {}
                };
                setProfile(mergedProfile);
                setBio(profileData.bio || '');
                setSkills(profileData.skills || []);
                setAvailableForMentoring(profileData.available_for_mentoring || false);
            }

            setRepos(reposData.repos || []);
            setConnectedRepos(connectedData.repos || []);
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        try {
            setSaving(true);
            // Use username for consistency with getProfile
            await profileApi.updateProfile(user.username, {
                bio,
                skills,
                available_for_mentoring: availableForMentoring
            });
            toast.success('Profile saved successfully');
        } catch (error) {
            console.error('Failed to save profile:', error);
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const addSkill = () => {
        if (skillInput.trim() && !skills.includes(skillInput.trim())) {
            setSkills([...skills, skillInput.trim()]);
            setSkillInput('');
        }
    };

    const removeSkill = (skill) => {
        setSkills(skills.filter(s => s !== skill));
    };

    const connectRepo = async (repoName) => {
        try {
            await profileApi.connectRepo(user.id, repoName);
            setConnectedRepos([...connectedRepos, repoName]);
            toast.success(`Connected ${repoName}`);
        } catch (error) {
            toast.error('Failed to connect repository');
        }
    };

    const disconnectRepo = async (repoName) => {
        try {
            await profileApi.disconnectRepo(user.id, repoName);
            setConnectedRepos(connectedRepos.filter(r => r !== repoName));
            toast.success(`Disconnected ${repoName}`);
        } catch (error) {
            toast.error('Failed to disconnect repository');
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'stats', label: 'Stats', icon: BarChart3 },
        { id: 'activity', label: 'Activity', icon: Calendar },
        { id: 'repos', label: 'Repositories', icon: GitBranch },
        { id: 'mentorship', label: 'Mentorship', icon: Users },
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

    // Show HypeScreen if requested
    if (showHypeScreen) {
        return <HypeScreen onBack={() => setShowHypeScreen(false)} />;
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                    <div className="flex items-start gap-6">
                        <img
                            src={user?.avatarUrl || `https://github.com/${user?.username}.png`}
                            alt={user?.username}
                            className="w-24 h-24 rounded-full border-4 border-[hsl(220,13%,20%)]"
                            onError={(e) => e.target.src = 'https://github.com/ghost.png'}
                        />
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-[hsl(210,11%,90%)]">@{user?.username}</h1>
                            <p className="text-[hsl(210,11%,50%)] mt-1">{bio || 'No bio yet'}</p>

                            {/* Featured Badges */}
                            <div className="mt-4">
                                <FeaturedBadges
                                    featuredBadges={featuredBadges}
                                    allBadges={allBadges}
                                    onUpdate={(newFeatured) => setFeaturedBadges(newFeatured)}
                                    username={user?.username}
                                />
                            </div>

                            {/* Quick Stats */}
                            <div className="flex items-center gap-6 mt-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Flame className="w-4 h-4 text-orange-400" />
                                    <span className="text-[hsl(210,11%,75%)]">{profile?.github_stats?.current_streak || 0} day streak</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Code className="w-4 h-4 text-[hsl(217,91%,65%)]" />
                                    <span className="text-[hsl(210,11%,75%)]">{skills.length} skills</span>
                                </div>
                            </div>

                            {/* Skills */}
                            {skills.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {skills.slice(0, 6).map((skill, i) => (
                                        <span key={i} className="px-2 py-1 bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] rounded-full text-xs">
                                            {skill}
                                        </span>
                                    ))}
                                    {skills.length > 6 && (
                                        <span className="px-2 py-1 bg-[hsl(220,13%,15%)] text-[hsl(210,11%,50%)] rounded-full text-xs">
                                            +{skills.length - 6} more
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
                            {/* Streak */}
                            <StreakDisplay />

                            {/* Top Languages from GitHub */}
                            <TopLanguages username={user?.username} />

                            {/* Contributor Hype Generator - Button to open dedicated screen */}
                            <button
                                onClick={() => setShowHypeScreen(true)}
                                className="w-full bg-gradient-to-r from-[hsl(142,70%,45%)] to-[hsl(142,70%,35%)] hover:from-[hsl(142,70%,50%)] hover:to-[hsl(142,70%,40%)] 
                                          text-white font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95
                                          flex items-center justify-center gap-3 border border-[hsl(142,70%,50%)]/20 shadow-lg"
                            >
                                <Sparkles className="w-5 h-5" />
                                <span>Share Your Contribution Hype</span>
                                <Sparkles className="w-5 h-5" />
                            </button>

                            {/* Profile Editor */}
                            <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                                <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5 text-[hsl(142,70%,55%)]" />
                                    Edit Profile
                                </h2>

                                {/* Bio */}
                                <div className="mb-4">
                                    <label className="block text-sm text-[hsl(210,11%,50%)] mb-2">Bio</label>
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell others about yourself..."
                                        rows={3}
                                        className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2 text-[hsl(210,11%,85%)] 
                              placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] resize-none"
                                    />
                                </div>

                                {/* Skills */}
                                <div className="mb-4">
                                    <label className="block text-sm text-[hsl(210,11%,50%)] mb-2">Skills</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {skills.map((skill, i) => (
                                            <span key={i} className="flex items-center gap-1 px-2 py-1 bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] rounded-full text-sm">
                                                {skill}
                                                <button onClick={() => removeSkill(skill)} className="hover:text-red-400">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={skillInput}
                                            onChange={(e) => setSkillInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                                            placeholder="Add a skill (e.g., React, Python)"
                                            className="flex-1 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2 text-sm
                                text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)]"
                                        />
                                        <button
                                            onClick={addSkill}
                                            className="px-4 py-2 bg-[hsl(217,91%,60%,0.15)] text-[hsl(217,91%,65%)] rounded-lg hover:bg-[hsl(217,91%,60%,0.25)]"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Mentoring Toggle */}
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <p className="text-[hsl(210,11%,90%)] font-medium">Available for Mentoring</p>
                                        <p className="text-xs text-[hsl(210,11%,40%)]">Allow others to find you as a potential mentor</p>
                                    </div>
                                    <button
                                        onClick={() => setAvailableForMentoring(!availableForMentoring)}
                                        className={`w-12 h-6 rounded-full transition-colors relative
                              ${availableForMentoring ? 'bg-[hsl(142,70%,45%)]' : 'bg-[hsl(220,13%,20%)]'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                                  ${availableForMentoring ? 'translate-x-7' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={saveProfile}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(142,70%,45%)] text-black rounded-lg
                            hover:bg-[hsl(142,70%,50%)] disabled:opacity-50 transition-colors font-medium"
                                >
                                    {saving ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Save Profile
                                </button>
                            </div>

                            {/* Trophies Mini View */}
                            <TrophyCabinet />
                        </>
                    )}

                    {activeTab === 'activity' && (
                        <>
                            <StreakDisplay />
                            <ContributionCalendar />
                        </>
                    )}

                    {activeTab === 'stats' && (
                        <ContributionStats
                            username={user?.username}
                            githubStats={profile?.github_stats}
                        />
                    )}

                    {activeTab === 'repos' && (
                        <div className="bg-[hsl(220,13%,8%)] rounded-xl p-6 border border-[hsl(220,13%,15%)]">
                            <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-4 flex items-center gap-2">
                                <GitBranch className="w-5 h-5 text-purple-400" />
                                Connected Repositories
                                <span className="text-xs text-[hsl(210,11%,40%)] ml-auto">
                                    These repos will be monitored for cookie-licking
                                </span>
                            </h2>

                            {/* Connected Repos */}
                            {connectedRepos.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-sm text-[hsl(210,11%,50%)] mb-2">Monitoring</h3>
                                    <div className="space-y-2">
                                        {connectedRepos.map((repo, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-[hsl(142,70%,45%,0.1)] border border-[hsl(142,70%,45%,0.25)] rounded-lg">
                                                <span className="text-[hsl(142,70%,55%)]">{repo}</span>
                                                <button
                                                    onClick={() => disconnectRepo(repo)}
                                                    className="text-[hsl(210,11%,50%)] hover:text-red-400 text-sm"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Available Repos */}
                            <h3 className="text-sm text-[hsl(210,11%,50%)] mb-2">Your Repositories</h3>
                            {repos.length > 0 ? (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {repos.filter(r => !connectedRepos.includes(r.name)).map((repo, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-[hsl(220,13%,10%)] rounded-lg">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[hsl(210,11%,85%)] font-medium truncate">{repo.name}</p>
                                                <p className="text-xs text-[hsl(210,11%,40%)] truncate">{repo.description || 'No description'}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-[hsl(210,11%,40%)]">{repo.language}</span>
                                                <button
                                                    onClick={() => connectRepo(repo.name)}
                                                    className="px-3 py-1 bg-purple-500/15 text-purple-400 rounded text-sm hover:bg-purple-500/25"
                                                >
                                                    Connect
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-[hsl(220,13%,10%)] rounded-lg">
                                    <GitBranch className="w-12 h-12 text-[hsl(220,13%,20%)] mx-auto mb-3" />
                                    <p className="text-[hsl(210,11%,50%)] mb-2">No repositories found</p>
                                    <p className="text-xs text-[hsl(210,11%,40%)] max-w-sm mx-auto">
                                        Your public GitHub repositories should appear here. If you have private repos or this seems incorrect, try refreshing the page.
                                    </p>
                                    <button
                                        onClick={loadProfile}
                                        className="mt-4 px-4 py-2 bg-[hsl(220,13%,15%)] text-[hsl(210,11%,75%)] rounded-lg hover:bg-[hsl(220,13%,18%)] transition-colors text-sm inline-flex items-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Refresh
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'mentorship' && (
                        <MentorMatchPanel />
                    )}


                </div>
            </div>

            {/* Badge Unlock Popup - Auto-triggered for newly earned badges */}
            {newBadge && (
                <BadgeUnlockModal badge={newBadge} onClose={dismissBadge} />
            )}
        </div>
    );
};

export default ProfilePage;
