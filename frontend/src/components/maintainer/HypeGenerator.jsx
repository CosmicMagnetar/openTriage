import { useState } from 'react';
import { Sparkles, Linkedin, Twitter, Copy, Download, CheckCircle, Loader2, PartyPopper, Rocket, Flame, Trophy } from 'lucide-react';
import { communityApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';

const HypeGenerator = () => {
    const { user } = useAuthStore();
    const [milestone, setMilestone] = useState({
        type: 'first_pr',
        description: '',
        repo_name: '',
        value: null
    });
    const [linkedinPost, setLinkedinPost] = useState(null);
    const [twitterPost, setTwitterPost] = useState(null);
    const [loading, setLoading] = useState({ linkedin: false, twitter: false });
    const [copied, setCopied] = useState(null);

    const milestoneTypes = [
        { value: 'first_pr', label: 'First PR Merged', Icon: PartyPopper },
        { value: 'pr_milestone', label: 'PR Milestone', Icon: Rocket },
        { value: 'streak', label: 'Contribution Streak', Icon: Flame },
        { value: 'trophy', label: 'Trophy Earned', Icon: Trophy },
        { value: 'custom', label: 'Custom Achievement', Icon: Sparkles },
    ];

    const generateLinkedIn = async () => {
        try {
            setLoading({ ...loading, linkedin: true });
            const post = await communityApi.generateLinkedInPost({
                milestone_type: milestone.type,
                user_id: user?.id || 'unknown',
                username: user?.username || 'unknown',
                repo_name: milestone.repo_name || null,
                value: milestone.value,
                description: milestone.description
            });
            setLinkedinPost(post);
        } catch (error) {
            console.error('Failed to generate LinkedIn post:', error);
        } finally {
            setLoading({ ...loading, linkedin: false });
        }
    };

    const generateTwitter = async () => {
        try {
            setLoading({ ...loading, twitter: true });
            const post = await communityApi.generateTwitterPost({
                milestone_type: milestone.type,
                user_id: user?.id || 'unknown',
                username: user?.username || 'unknown',
                repo_name: milestone.repo_name || null,
                value: milestone.value,
                description: milestone.description
            });
            setTwitterPost(post);
        } catch (error) {
            console.error('Failed to generate Twitter post:', error);
        } finally {
            setLoading({ ...loading, twitter: false });
        }
    };

    const copyToClipboard = async (text, platform) => {
        await navigator.clipboard.writeText(text);
        setCopied(platform);
        setTimeout(() => setCopied(null), 2000);
    };

    const shareToLinkedIn = () => {
        if (!linkedinPost) return;
        const text = encodeURIComponent(linkedinPost.content + '\n\n' + linkedinPost.hashtags.join(' '));
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://github.com')}&text=${text}`, '_blank');
    };

    const shareToTwitter = () => {
        if (!twitterPost) return;
        const text = encodeURIComponent(twitterPost.content + ' ' + twitterPost.hashtags.join(' '));
        window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    };

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-purple-400" />
                <div>
                    <h2 className="text-lg font-bold text-slate-200">Milestone Hype Generator</h2>
                    <p className="text-xs text-slate-400">Create shareable social media posts</p>
                </div>
            </div>

            {/* Milestone Form */}
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-sm text-slate-400 mb-2">Milestone Type</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {milestoneTypes.map(type => {
                            const TypeIcon = type.Icon;
                            const isActive = milestone.type === type.value;
                            return (
                                <button
                                    key={type.value}
                                    onClick={() => setMilestone({ ...milestone, type: type.value })}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                                            : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
                                        }`}
                                >
                                    <TypeIcon className="w-4 h-4" />
                                    <span className="truncate">{type.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-2">Description</label>
                    <input
                        type="text"
                        value={milestone.description}
                        onChange={(e) => setMilestone({ ...milestone, description: e.target.value })}
                        placeholder="e.g., Merged my first PR to React!"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 
                      placeholder-slate-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Repository (optional)</label>
                        <input
                            type="text"
                            value={milestone.repo_name}
                            onChange={(e) => setMilestone({ ...milestone, repo_name: e.target.value })}
                            placeholder="owner/repo"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 
                        placeholder-slate-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Value (optional)</label>
                        <input
                            type="number"
                            value={milestone.value || ''}
                            onChange={(e) => setMilestone({ ...milestone, value: e.target.value ? Number(e.target.value) : null })}
                            placeholder="e.g., 30 for streak"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 
                        placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* Generate Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                    onClick={generateLinkedIn}
                    disabled={loading.linkedin}
                    className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg 
                    font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {loading.linkedin ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Linkedin className="w-5 h-5" />
                    )}
                    Generate LinkedIn
                </button>

                <button
                    onClick={generateTwitter}
                    disabled={loading.twitter}
                    className="flex items-center justify-center gap-2 py-3 bg-sky-500 text-white rounded-lg 
                    font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                    {loading.twitter ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Twitter className="w-5 h-5" />
                    )}
                    Generate Tweet
                </button>
            </div>

            {/* Generated Posts */}
            <div className="space-y-4">
                {/* LinkedIn Post */}
                {linkedinPost && (
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-blue-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Linkedin className="w-4 h-4 text-blue-400" />
                                <span className="text-sm font-medium text-blue-400">LinkedIn Post</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => copyToClipboard(linkedinPost.content + '\n\n' + linkedinPost.hashtags.join(' '), 'linkedin')}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                >
                                    {copied === 'linkedin' ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </button>
                                <button
                                    onClick={shareToLinkedIn}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded font-medium 
                            hover:bg-blue-700 transition-colors"
                                >
                                    Share
                                </button>
                            </div>
                        </div>

                        <p className="text-sm text-slate-300 whitespace-pre-wrap mb-2">
                            {linkedinPost.content}
                        </p>

                        <div className="flex flex-wrap gap-1">
                            {linkedinPost.hashtags.map((tag, i) => (
                                <span key={i} className="text-xs text-blue-400">{tag}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Twitter Post */}
                {twitterPost && (
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-sky-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Twitter className="w-4 h-4 text-sky-400" />
                                <span className="text-sm font-medium text-sky-400">Tweet</span>
                                <span className="text-xs text-slate-500">
                                    ({twitterPost.content.length + twitterPost.hashtags.join(' ').length}/280)
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => copyToClipboard(twitterPost.content + ' ' + twitterPost.hashtags.join(' '), 'twitter')}
                                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                >
                                    {copied === 'twitter' ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </button>
                                <button
                                    onClick={shareToTwitter}
                                    className="px-3 py-1 bg-sky-500 text-white text-xs rounded font-medium 
                            hover:bg-sky-600 transition-colors"
                                >
                                    Tweet
                                </button>
                            </div>
                        </div>

                        <p className="text-sm text-slate-300 mb-2">
                            {twitterPost.content}
                        </p>

                        <div className="flex flex-wrap gap-1">
                            {twitterPost.hashtags.map((tag, i) => (
                                <span key={i} className="text-xs text-sky-400">{tag}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Card Preview */}
            <div className="mt-6 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Download className="w-4 h-4" />
                        <span>Stats Card</span>
                    </div>
                    <a
                        href={communityApi.getStatsCardUrl(user?.username || 'ghost')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-400 hover:underline"
                    >
                        Download shareable stats image →
                    </a>
                </div>
            </div>
        </div>
    );
};

export default HypeGenerator;
