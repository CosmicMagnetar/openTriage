import { useState, useEffect } from 'react';
import { Sparkles, Share2, Copy, CheckCircle, Linkedin, Twitter, Trophy, GitPullRequest, Flame, Calendar, RefreshCw } from 'lucide-react';
import { communityApi, profileApi, gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';

/**
 * ContributorHype Component
 * 
 * Generates and displays AI-powered "hype" summaries of a contributor's impact.
 * Shareable on LinkedIn and Twitter/X.
 */
const ContributorHype = () => {
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

    if (loading) {
        return (
            <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-[hsl(142,70%,45%)] border-t-transparent rounded-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">Contributor Hype</h2>
                </div>
                <button
                    onClick={loadStats}
                    className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)] hover:bg-[hsl(220,13%,12%)] rounded-lg transition-colors"
                    title="Refresh stats"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="p-5 space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-4 gap-3">
                    <StatCard 
                        icon={GitPullRequest} 
                        label="Merged PRs" 
                        value={stats?.mergedPRs || 0} 
                        color="purple" 
                    />
                    <StatCard 
                        icon={Flame} 
                        label="Streak" 
                        value={`${stats?.currentStreak || stats?.streak?.currentStreak || 0}d`} 
                        color="orange" 
                    />
                    <StatCard 
                        icon={Calendar} 
                        label="Contributions" 
                        value={stats?.totalContributions || 0} 
                        color="emerald" 
                    />
                    <StatCard 
                        icon={Trophy} 
                        label="Badges" 
                        value={stats?.totalBadges || 0} 
                        color="yellow" 
                    />
                </div>

                {/* Milestone Selector */}
                <div>
                    <label className="block text-sm text-[hsl(210,11%,50%)] mb-2">
                        Celebrate milestone:
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        {[
                            { value: 'overall', label: 'Overall Impact' },
                            { value: 'streak', label: 'Contribution Streak' },
                            { value: 'prs', label: 'Merged PRs' },
                            { value: 'contributions', label: 'Total Contributions' },
                            { value: 'badges', label: 'Achievement Badges' },
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedMilestone(option.value)}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                    selectedMilestone === option.value
                                        ? 'bg-[hsl(142,70%,45%)] text-white'
                                        : 'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,15%)]'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Generate Buttons */}
                <div className="grid grid-cols-2 gap-4">
                    <GenerateCard
                        platform="linkedin"
                        icon={Linkedin}
                        color="blue"
                        generating={generating}
                        content={hypeContent.linkedin}
                        onGenerate={() => generateHype('linkedin')}
                        onCopy={() => copyToClipboard('linkedin')}
                        onShare={shareToLinkedIn}
                        copied={copiedPlatform === 'linkedin'}
                    />
                    <GenerateCard
                        platform="twitter"
                        icon={Twitter}
                        color="cyan"
                        generating={generating}
                        content={hypeContent.twitter}
                        onGenerate={() => generateHype('twitter')}
                        onCopy={() => copyToClipboard('twitter')}
                        onShare={shareToTwitter}
                        copied={copiedPlatform === 'twitter'}
                    />
                </div>

                {/* Stats Card Preview */}
                {user?.username && (
                    <div className="mt-4 pt-4 border-t border-[hsl(220,13%,15%)]">
                        <p className="text-sm text-[hsl(210,11%,50%)] mb-3">Your shareable stats card:</p>
                        <div className="bg-[hsl(220,13%,12%)] rounded-lg p-4 border border-[hsl(220,13%,18%)]">
                            <img
                                src={communityApi.getStatsCardUrl(user.username)}
                                alt="Stats Card"
                                className="w-full max-w-md rounded-lg"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
    const colors = {
        emerald: 'text-[hsl(142,70%,55%)]',
        purple: 'text-purple-400',
        orange: 'text-orange-400',
        yellow: 'text-yellow-400',
    };

    return (
        <div className="bg-[hsl(220,13%,10%)] rounded-lg p-3 border border-[hsl(220,13%,15%)]">
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${colors[color]}`} />
                <span className="text-xs text-[hsl(210,11%,50%)]">{label}</span>
            </div>
            <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
        </div>
    );
};

const GenerateCard = ({ platform, icon: Icon, color, generating, content, onGenerate, onCopy, onShare, copied }) => {
    const colors = {
        blue: {
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            text: 'text-blue-400',
            button: 'bg-blue-600 hover:bg-blue-700',
        },
        cyan: {
            bg: 'bg-cyan-500/10',
            border: 'border-cyan-500/20',
            text: 'text-cyan-400',
            button: 'bg-cyan-600 hover:bg-cyan-700',
        },
    };

    const c = colors[color];

    return (
        <div className={`${c.bg} border ${c.border} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 ${c.text}`} />
                <span className={`font-medium ${c.text} capitalize`}>{platform}</span>
            </div>

            {content ? (
                <div className="space-y-3">
                    <div className="bg-[hsl(220,13%,8%)] rounded-lg p-3 max-h-32 overflow-y-auto">
                        <p className="text-sm text-[hsl(210,11%,70%)] whitespace-pre-wrap">
                            {content.content}
                        </p>
                        {content.hashtags?.length > 0 && (
                            <p className="text-xs text-[hsl(210,11%,50%)] mt-2">
                                {content.hashtags.join(' ')}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onCopy}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,15%)] text-[hsl(210,11%,70%)] rounded-lg transition-colors"
                        >
                            {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                            onClick={onShare}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm ${c.button} text-white rounded-lg transition-colors`}
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                    </div>
                    <button
                        onClick={onGenerate}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,70%)] transition-colors"
                    >
                        <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                        Regenerate
                    </button>
                </div>
            ) : (
                <button
                    onClick={onGenerate}
                    disabled={generating}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 ${c.button} text-white rounded-lg transition-colors disabled:opacity-50`}
                >
                    {generating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Sparkles className="w-4 h-4" />
                    )}
                    Generate Post
                </button>
            )}
        </div>
    );
};

export default ContributorHype;
