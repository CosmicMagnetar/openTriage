import { useState, useEffect } from 'react';
import { Sparkles, Share2, Copy, CheckCircle, Linkedin, Twitter, Trophy, GitPullRequest, Flame, Calendar, RefreshCw, ArrowLeft, GitCommit, X, Eye } from 'lucide-react';
import { communityApi, profileApi, gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';

/**
 * HypeScreen Component
 *
 * Dedicated full-screen view for the Hype Generator.
 * Generates and displays AI-powered "hype" summaries of a contributor's impact.
 * Shareable on LinkedIn and Twitter/X with high-impact visuals.
 */
const HypeScreen = ({ onBack }) => {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [stats, setStats] = useState(null);
    const [hypeContent, setHypeContent] = useState({
        linkedin: null,
        twitter: null,
    });
    const [copiedPlatform, setCopiedPlatform] = useState(null);
    const [selectedMilestone, setSelectedMilestone] = useState('overall');
    const [previewModal, setPreviewModal] = useState({ open: false, platform: null });

    useEffect(() => {
        loadStats();
    }, [user]);

    const loadStats = async () => {
        if (!user?.username) return;

        setLoading(true);
        try {
            const [githubStats, streakData, badgeData] = await Promise.all([
                profileApi.getGitHubStats(user.username),
                gamificationApi.getUserStreak(user.username),
                gamificationApi.getUserBadges(user.username).catch(() => ({ badges: [] }))
            ]);

            setStats({
                ...githubStats,
                streak: streakData,
                badges: badgeData.badges || [],
                totalBadges: badgeData.badges?.length || 0
            });
        } catch (error) {
            console.error('Failed to load stats:', error);
            toast.error('Failed to load your stats');
        } finally {
            setLoading(false);
        }
    };

    const generateHype = async (platform) => {
        if (!user || !stats) return;

        setGenerating(true);
        try {
            const milestoneData = {
                milestone_type: selectedMilestone,
                user_id: user.id,
                username: user.username,
                value: getMilestoneValue(),
                description: getMilestoneDescription(),
            };

            let response;
            if (platform === 'linkedin') {
                response = await communityApi.generateLinkedInPost(milestoneData);
            } else {
                response = await communityApi.generateTwitterPost(milestoneData);
            }

            setHypeContent(prev => ({
                ...prev,
                [platform]: response
            }));
            toast.success(`${platform === 'linkedin' ? 'LinkedIn' : 'Twitter'} post generated!`);
        } catch (error) {
            console.error(`Failed to generate ${platform} post:`, error);
            toast.error(`Failed to generate ${platform} post. Please try again.`);
        } finally {
            setGenerating(false);
        }
    };

    const getMilestoneValue = () => {
        switch (selectedMilestone) {
            case 'streak': return stats?.currentStreak || stats?.streak?.currentStreak || 0;
            case 'prs': return stats?.mergedPRs || 0;
            case 'contributions': return stats?.totalContributions || 0;
            case 'badges': return stats?.totalBadges || 0;
            default: return stats?.totalContributions || 0;
        }
    };

    const getMilestoneDescription = () => {
        switch (selectedMilestone) {
            case 'streak':
                return `Maintained a ${stats?.currentStreak || stats?.streak?.currentStreak || 0}-day contribution streak!`;
            case 'prs':
                return `Merged ${stats?.mergedPRs || 0} pull requests across open source projects!`;
            case 'contributions':
                return `Made ${stats?.totalContributions || 0} contributions to open source!`;
            case 'badges':
                return `Earned ${stats?.totalBadges || 0} achievement badges!`;
            default:
                return `Making an impact in open source with ${stats?.totalContributions || 0} contributions!`;
        }
    };

    const copyToClipboard = async (platform) => {
        const content = hypeContent[platform];
        if (!content) return;

        const fullContent = `${content.content}\n\n${content.hashtags?.join(' ') || ''}`;

        try {
            await navigator.clipboard.writeText(fullContent);
            setCopiedPlatform(platform);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopiedPlatform(null), 2000);
        } catch (error) {
            toast.error('Failed to copy');
        }
    };

    const shareToLinkedIn = () => {
        const content = hypeContent.linkedin;
        if (!content) return;

        const text = encodeURIComponent(`${content.content}\n\n${content.hashtags?.join(' ') || ''}`);
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}&summary=${text}`, '_blank');
    };

    const shareToTwitter = () => {
        const content = hypeContent.twitter;
        if (!content) return;

        const text = encodeURIComponent(`${content.content} ${content.hashtags?.join(' ') || ''}`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    };

    const openPreview = (platform) => {
        setPreviewModal({ open: true, platform });
    };

    const closePreview = () => {
        setPreviewModal({ open: false, platform: null });
    };

    // Preview Modal Component
    const PreviewModal = () => {
        if (!previewModal.open || !previewModal.platform) return null;
        
        const content = hypeContent[previewModal.platform];
        if (!content) return null;

        const isLinkedIn = previewModal.platform === 'linkedin';
        const fullContent = `${content.content}\n\n${content.hashtags?.join(' ') || ''}`;

        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closePreview}>
                <div 
                    className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`px-6 py-4 border-b flex items-center justify-between ${isLinkedIn ? 'bg-[#0077B5]' : 'bg-black'}`}>
                        <div className="flex items-center gap-3">
                            {isLinkedIn ? (
                                <Linkedin className="w-6 h-6 text-white" />
                            ) : (
                                <Twitter className="w-6 h-6 text-white" />
                            )}
                            <span className="text-white font-semibold">
                                {isLinkedIn ? 'LinkedIn' : 'X (Twitter)'} Preview
                            </span>
                        </div>
                        <button
                            onClick={closePreview}
                            className="p-1 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Post Preview */}
                    <div className="p-6">
                        {/* User Info */}
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${isLinkedIn ? 'bg-[#0077B5]' : 'bg-gray-800'}`}>
                                {user?.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">{user?.name || user?.username}</p>
                                <p className="text-gray-500 text-sm">@{user?.username}</p>
                                {isLinkedIn && (
                                    <p className="text-gray-400 text-xs mt-0.5">Open Source Contributor</p>
                                )}
                            </div>
                        </div>

                        {/* Post Content */}
                        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">
                            {content.content}
                        </div>

                        {/* Hashtags */}
                        <div className="flex flex-wrap gap-1 mb-4">
                            {content.hashtags?.map((tag, i) => (
                                <span key={i} className={`text-sm ${isLinkedIn ? 'text-[#0077B5]' : 'text-blue-500'}`}>
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {/* Engagement Preview (mock) */}
                        <div className={`border-t pt-4 flex items-center gap-6 text-gray-500 text-sm ${isLinkedIn ? '' : 'justify-around'}`}>
                            {isLinkedIn ? (
                                <>
                                    <span>👍 Like</span>
                                    <span>💬 Comment</span>
                                    <span>🔄 Repost</span>
                                    <span>📤 Send</span>
                                </>
                            ) : (
                                <>
                                    <span>💬 Reply</span>
                                    <span>🔄 Repost</span>
                                    <span>❤️ Like</span>
                                    <span>📊 View</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 py-4 bg-gray-50 border-t flex gap-3">
                        <button
                            onClick={() => copyToClipboard(previewModal.platform)}
                            className="flex-1 py-2.5 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {copiedPlatform === previewModal.platform ? (
                                <>
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy Text
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                isLinkedIn ? shareToLinkedIn() : shareToTwitter();
                                closePreview();
                            }}
                            className={`flex-1 py-2.5 px-4 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                isLinkedIn 
                                    ? 'bg-[#0077B5] hover:bg-[#006097]' 
                                    : 'bg-black hover:bg-gray-800'
                            }`}
                        >
                            <Share2 className="w-4 h-4" />
                            Share to {isLinkedIn ? 'LinkedIn' : 'X'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[hsl(220,13%,8%)] via-[hsl(220,13%,12%)] to-[hsl(220,13%,8%)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin w-12 h-12 border-4 border-[hsl(142,70%,45%)] border-t-transparent rounded-full" />
                    <p className="text-[hsl(210,11%,60%)]">Loading your stats...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[hsl(220,13%,8%)] via-[hsl(220,13%,12%)] to-[hsl(220,13%,8%)]">
            {/* Header */}
            <div className="border-b border-[hsl(220,13%,15%)] bg-[hsl(220,13%,10%)]/50 backdrop-blur-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,100%)] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-[hsl(142,70%,45%)]" />
                        <h1 className="text-xl font-bold text-[hsl(210,11%,100%)]">Contribution Hype</h1>
                    </div>
                    <div className="w-24" /> {/* Balance grid */}
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                    <div className="bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] rounded-lg p-6 hover:border-[hsl(220,13%,30%)] transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[hsl(210,11%,50%)] text-sm font-medium">Total Contributions</p>
                                <p className="text-3xl font-bold text-[hsl(210,11%,100%)] mt-2">{stats?.totalContributions || 0}</p>
                            </div>
                            <GitCommit className="w-8 h-8 text-blue-400 opacity-40" />
                        </div>
                    </div>

                    <div className="bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] rounded-lg p-6 hover:border-[hsl(220,13%,30%)] transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[hsl(210,11%,50%)] text-sm font-medium">Merged PRs</p>
                                <p className="text-3xl font-bold text-[hsl(210,11%,100%)] mt-2">{stats?.mergedPRs || 0}</p>
                            </div>
                            <GitPullRequest className="w-8 h-8 text-purple-400 opacity-40" />
                        </div>
                    </div>

                    <div className="bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] rounded-lg p-6 hover:border-[hsl(220,13%,30%)] transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[hsl(210,11%,50%)] text-sm font-medium">Current Streak</p>
                                <p className="text-3xl font-bold text-[hsl(210,11%,100%)] mt-2">{stats?.currentStreak || stats?.streak?.currentStreak || 0}</p>
                            </div>
                            <Flame className="w-8 h-8 text-orange-400 opacity-40" />
                        </div>
                    </div>

                    <div className="bg-[hsl(220,13%,12%)] border border-[hsl(220,13%,20%)] rounded-lg p-6 hover:border-[hsl(220,13%,30%)] transition-colors">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[hsl(210,11%,50%)] text-sm font-medium">Badges Earned</p>
                                <p className="text-3xl font-bold text-[hsl(210,11%,100%)] mt-2">{stats?.totalBadges || 0}</p>
                            </div>
                            <Trophy className="w-8 h-8 text-yellow-400 opacity-40" />
                        </div>
                    </div>
                </div>

                {/* Milestone Selection & Generation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Milestone Selection */}
                    <div className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,20%)] rounded-lg p-8">
                        <h2 className="text-lg font-bold text-[hsl(210,11%,100%)] mb-6 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-[hsl(142,70%,45%)]" />
                            Choose Your Moment
                        </h2>

                        <div className="space-y-3 mb-8">
                            {[
                                { id: 'overall', label: 'Overall Impact', icon: '🌟' },
                                { id: 'contributions', label: 'Total Contributions', icon: '💪' },
                                { id: 'prs', label: 'Merged Pull Requests', icon: '🚀' },
                                { id: 'streak', label: 'Contribution Streak', icon: '🔥' },
                                { id: 'badges', label: 'Achievement Badges', icon: '🏆' },
                            ].map(milestone => (
                                <label key={milestone.id} className="flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:bg-[hsl(220,13%,15%)]"
                                    style={{
                                        borderColor: selectedMilestone === milestone.id ? 'hsl(142,70%,45%)' : 'hsl(220,13%,20%)',
                                        backgroundColor: selectedMilestone === milestone.id ? 'hsl(142,70%,45%,0.1)' : 'transparent'
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="milestone"
                                        value={milestone.id}
                                        checked={selectedMilestone === milestone.id}
                                        onChange={(e) => setSelectedMilestone(e.target.value)}
                                        className="w-4 h-4 cursor-pointer accent-[hsl(142,70%,45%)]"
                                    />
                                    <span className="text-lg">{milestone.icon}</span>
                                    <div>
                                        <p className="font-medium text-[hsl(210,11%,100%)]">{milestone.label}</p>
                                        <p className="text-sm text-[hsl(210,11%,50%)]">{getMilestoneDescription()}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Right: Generated Content */}
                    <div className="space-y-6">
                        {/* LinkedIn */}
                        <div className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,20%)] rounded-lg p-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-[hsl(210,11%,100%)] flex items-center gap-2">
                                    <Linkedin className="w-5 h-5 text-blue-500" />
                                    LinkedIn Post
                                </h3>
                                {hypeContent.linkedin && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openPreview('linkedin')}
                                            className="p-2 rounded-lg bg-[hsl(220,13%,20%)] hover:bg-[hsl(220,13%,30%)] text-[hsl(210,11%,70%)] hover:text-[hsl(210,11%,100%)] transition-colors"
                                            title="Preview post"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard('linkedin')}
                                            className="p-2 rounded-lg bg-[hsl(220,13%,20%)] hover:bg-[hsl(220,13%,30%)] text-[hsl(210,11%,70%)] hover:text-[hsl(210,11%,100%)] transition-colors"
                                            title="Copy to clipboard"
                                        >
                                            {copiedPlatform === 'linkedin' ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={shareToLinkedIn}
                                            className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 transition-colors"
                                            title="Share to LinkedIn"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!hypeContent.linkedin ? (
                                <button
                                    onClick={() => generateHype('linkedin')}
                                    disabled={generating}
                                    className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-[hsl(220,13%,20%)] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {generating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate LinkedIn Post
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="bg-[hsl(220,13%,15%)] rounded-lg p-4 border border-[hsl(220,13%,25%)]">
                                    <p className="text-[hsl(210,11%,90%)] leading-relaxed mb-3">{hypeContent.linkedin.content}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {hypeContent.linkedin.hashtags?.map((tag, i) => (
                                            <span key={i} className="text-blue-400 text-sm">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Twitter */}
                        <div className="bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,20%)] rounded-lg p-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-[hsl(210,11%,100%)] flex items-center gap-2">
                                    <Twitter className="w-5 h-5 text-blue-400" />
                                    Twitter Post
                                </h3>
                                {hypeContent.twitter && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openPreview('twitter')}
                                            className="p-2 rounded-lg bg-[hsl(220,13%,20%)] hover:bg-[hsl(220,13%,30%)] text-[hsl(210,11%,70%)] hover:text-[hsl(210,11%,100%)] transition-colors"
                                            title="Preview post"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard('twitter')}
                                            className="p-2 rounded-lg bg-[hsl(220,13%,20%)] hover:bg-[hsl(220,13%,30%)] text-[hsl(210,11%,70%)] hover:text-[hsl(210,11%,100%)] transition-colors"
                                            title="Copy to clipboard"
                                        >
                                            {copiedPlatform === 'twitter' ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={shareToTwitter}
                                            className="p-2 rounded-lg bg-blue-400/20 hover:bg-blue-400/30 text-blue-300 hover:text-blue-200 transition-colors"
                                            title="Share to Twitter"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {!hypeContent.twitter ? (
                                <button
                                    onClick={() => generateHype('twitter')}
                                    disabled={generating}
                                    className="w-full py-3 px-4 bg-blue-400 hover:bg-blue-500 disabled:bg-[hsl(220,13%,20%)] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {generating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Generate Twitter Post
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="bg-[hsl(220,13%,15%)] rounded-lg p-4 border border-[hsl(220,13%,25%)]">
                                    <p className="text-[hsl(210,11%,90%)] leading-relaxed mb-3">{hypeContent.twitter.content}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {hypeContent.twitter.hashtags?.map((tag, i) => (
                                            <span key={i} className="text-blue-400 text-sm">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            <PreviewModal />
        </div>
    );
};

export default HypeScreen;
