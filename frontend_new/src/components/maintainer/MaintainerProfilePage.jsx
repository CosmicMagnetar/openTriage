import { useState, useEffect } from 'react';
import { User, Code, GitBranch, Save, Plus, X, RefreshCw, Users, Flame, Trophy, Calendar, BarChart3 } from 'lucide-react';
import { profileApi, gamificationApi, trophyApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';
import StreakDisplay from '../contributor/StreakDisplay';
import TrophyCabinet from '../contributor/TrophyCabinet';
import ContributionCalendar from '../contributor/ContributionCalendar';
import ContributionStats from '../profile/ContributionStats';
import TopLanguages from '../contributor/TopLanguages';

/**
 * MaintainerProfilePage
 * 
 * Profile page for maintainers - same as contributor profile but WITHOUT:
 * - Hype Generator (contributor-only feature)
 * - Mentor Match Panel (contributor-only feature)
 */
const MaintainerProfilePage = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [profile, setProfile] = useState(null);
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [skillInput, setSkillInput] = useState('');

    // Editable fields
    const [bio, setBio] = useState('');
    const [skills, setSkills] = useState([]);

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const [profileData, reposData, githubStatsData] = await Promise.all([
                profileApi.getProfile(user.username).catch(() => null),
                profileApi.getUserRepos(user.username).catch(() => ({ repos: [] })),
                profileApi.getGitHubStats(user.username).catch(() => null)
            ]);

            if (profileData) {
                const mergedProfile = {
                    ...profileData,
                    github_stats: githubStatsData || profileData.github_stats || {}
                };
                setProfile(mergedProfile);
                setBio(profileData.bio || '');
                setSkills(profileData.skills || []);
            }

            setRepos(reposData.repos || []);
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        try {
            setSaving(true);
            await profileApi.updateProfile(user.username, {
                bio,
                skills
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

    const removeSkill = (skillToRemove) => {
        setSkills(skills.filter(s => s !== skillToRemove));
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-[hsl(142,70%,55%)]" />
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'activity', label: 'Activity', icon: Calendar },
        { id: 'stats', label: 'Stats', icon: BarChart3 },
        { id: 'repos', label: 'Repos', icon: GitBranch },
    ];

    return (
        <div className="p-6 overflow-auto h-full">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <img
                        src={user?.avatarUrl || `https://github.com/${user?.username}.png`}
                        alt={user?.username}
                        className="w-20 h-20 rounded-full border-2 border-[hsl(142,70%,45%)]"
                    />
                    <div>
                        <h1 className="text-2xl font-bold text-[hsl(210,11%,95%)]">{user?.username}</h1>
                        <p className="text-[hsl(210,11%,60%)]">{bio || 'No bio yet'}</p>
                        <div className="flex gap-2 mt-2">
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                                Maintainer
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-[hsl(220,13%,15%)] pb-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-[hsl(142,70%,45%)] text-black'
                                    : 'text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,12%)]'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {activeTab === 'overview' && (
                        <>
                            {/* Streak */}
                            <StreakDisplay />

                            {/* Top Languages from GitHub */}
                            <TopLanguages />

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
                                        className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-3 text-[hsl(210,11%,85%)] resize-none focus:outline-none focus:border-[hsl(142,70%,45%)]"
                                        rows={3}
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>

                                {/* Skills */}
                                <div className="mb-4">
                                    <label className="block text-sm text-[hsl(210,11%,50%)] mb-2">Skills</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {skills.map(skill => (
                                            <span
                                                key={skill}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-full text-sm text-[hsl(210,11%,75%)]"
                                            >
                                                {skill}
                                                <button
                                                    onClick={() => removeSkill(skill)}
                                                    className="text-[hsl(210,11%,40%)] hover:text-red-400"
                                                >
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
                                            className="flex-1 bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-4 py-2 text-[hsl(210,11%,85%)] focus:outline-none focus:border-[hsl(142,70%,45%)]"
                                            placeholder="Add a skill..."
                                        />
                                        <button
                                            onClick={addSkill}
                                            className="px-4 py-2 bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,18%)] rounded-lg text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,15%)]"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={saveProfile}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(142,70%,45%)] text-black rounded-lg hover:bg-[hsl(142,70%,50%)] disabled:opacity-50 transition-colors font-medium"
                                >
                                    {saving ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Save Profile
                                </button>
                            </div>

                            {/* Trophies */}
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
                                Your Repositories
                            </h2>
                            
                            {repos.length > 0 ? (
                                <div className="space-y-3">
                                    {repos.map((repo) => (
                                        <div
                                            key={repo.id || repo.name}
                                            className="flex items-center justify-between p-3 bg-[hsl(220,13%,10%)] rounded-lg border border-[hsl(220,13%,15%)]"
                                        >
                                            <div className="flex items-center gap-3">
                                                <GitBranch className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                                                <span className="text-[hsl(210,11%,85%)]">{repo.name || repo.full_name}</span>
                                            </div>
                                            {repo.language && (
                                                <span className="text-xs text-[hsl(210,11%,50%)] bg-[hsl(220,13%,15%)] px-2 py-1 rounded">
                                                    {repo.language}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[hsl(210,11%,50%)] text-center py-8">
                                    No repositories found
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MaintainerProfilePage;
