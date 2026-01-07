import { useState, useEffect } from 'react';
import { Trophy, Star, Crown, Flame, Award, Medal, Gift, Sparkles, Check } from 'lucide-react';
import { gamificationApi } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import { toast } from 'sonner';
import BadgeUnlockModal from '../ui/BadgeUnlockModal';

const TrophyCabinet = () => {
    const { user } = useAuthStore();
    const [badges, setBadges] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedBadge, setSelectedBadge] = useState(null);
    const [checking, setChecking] = useState(false);
    const [unlockQueue, setUnlockQueue] = useState([]);
    const [currentUnlock, setCurrentUnlock] = useState(null);

    // Queue processor
    useEffect(() => {
        if (!currentUnlock && unlockQueue.length > 0) {
            const next = unlockQueue[0];
            setCurrentUnlock(next);
            setUnlockQueue(prev => prev.slice(1));
        }
    }, [currentUnlock, unlockQueue]);

    useEffect(() => {
        loadBadges();
    }, [user]);

    const loadBadges = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await gamificationApi.getUserBadges(user.username);
            setBadges(data.all_badges || []);
            setStats(data.stats);
        } catch (error) {
            console.error('Failed to load badges:', error);
            // Use mock data
            setBadges([]);
            setStats({ total_earned: 0, common: 0, uncommon: 0, rare: 0, legendary: 0 });
        } finally {
            setLoading(false);
        }
    };

    const checkAchievements = async () => {
        if (!user) return;

        try {
            setChecking(true);
            const result = await gamificationApi.checkBadges(user.username);

            if (result.new_badges && result.new_badges.length > 0) {
                await loadBadges();
                setUnlockQueue(result.new_badges);
                // toast.success(`Congratulations! You earned ${result.new_badges.length} new badge(s)!`); // Modal handles this
            } else {
                toast.info('No new badges earned yet. Keep contributing!');
            }
        } catch (error) {
            console.error('Failed to check achievements:', error);
        } finally {
            setChecking(false);
        }
    };

    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'from-yellow-500 to-amber-600';
            case 'rare': return 'from-purple-500 to-pink-600';
            case 'uncommon': return 'from-blue-500 to-cyan-600';
            default: return 'from-slate-500 to-slate-600';
        }
    };

    const getRarityGlow = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'shadow-yellow-500/50';
            case 'rare': return 'shadow-purple-500/50';
            case 'uncommon': return 'shadow-blue-500/50';
            default: return 'shadow-slate-500/30';
        }
    };

    const getRarityBorder = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'border-yellow-500/50';
            case 'rare': return 'border-purple-500/50';
            case 'uncommon': return 'border-blue-500/50';
            default: return 'border-slate-600';
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-lg font-bold text-slate-200">Badges & Achievements</h2>
                </div>
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-lg font-bold text-slate-200">Badges & Achievements</h2>
                </div>
                <button
                    onClick={checkAchievements}
                    disabled={checking}
                    className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                >
                    {checking ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                            Checking...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            Check Achievements
                        </>
                    )}
                </button>
            </div>

            {/* Stats Summary */}
            {stats && (
                <div className="grid grid-cols-5 gap-3 mb-6">
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-slate-200">{stats.total_earned}</div>
                        <div className="text-xs text-slate-400">Earned</div>
                    </div>
                    <div className="bg-slate-500/10 rounded-lg p-3 text-center border border-slate-500/30">
                        <div className="text-2xl font-bold text-slate-400">{stats.common || 0}</div>
                        <div className="text-xs text-slate-400/70">Common</div>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-3 text-center border border-blue-500/30">
                        <div className="text-2xl font-bold text-blue-400">{stats.uncommon || 0}</div>
                        <div className="text-xs text-blue-400/70">Uncommon</div>
                    </div>
                    <div className="bg-purple-500/10 rounded-lg p-3 text-center border border-purple-500/30">
                        <div className="text-2xl font-bold text-purple-400">{stats.rare || 0}</div>
                        <div className="text-xs text-purple-400/70">Rare</div>
                    </div>
                    <div className="bg-yellow-500/10 rounded-lg p-3 text-center border border-yellow-500/30">
                        <div className="text-2xl font-bold text-yellow-400">{stats.legendary || 0}</div>
                        <div className="text-xs text-yellow-400/70">Legendary</div>
                    </div>
                </div>
            )}

            {/* Badges Grid */}
            {badges.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {badges.map((item) => {
                        const badge = item.badge;
                        const earned = item.earned;
                        const progress = item.progress_percent || 0;

                        return (
                            <button
                                key={badge.id}
                                onClick={() => setSelectedBadge(item)}
                                className={`relative group rounded-xl transition-all duration-300
                                    ${earned
                                        ? `bg-gradient-to-br ${getRarityColor(badge.rarity)} shadow-lg ${getRarityGlow(badge.rarity)} hover:scale-105`
                                        : `bg-slate-700/30 border ${getRarityBorder(badge.rarity)} opacity-60 hover:opacity-80`
                                    }`}
                            >
                                {/* Earned checkmark */}
                                {earned && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}

                                {/* Badge Image or Emoji */}
                                <div className={`flex items-center justify-center ${!earned && 'grayscale opacity-50'}`}>
                                    {badge.image_url ? (
                                        <img
                                            src={badge.image_url}
                                            alt={badge.name}
                                            className="w-full h-full object-contain rounded-lg"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'block';
                                            }}
                                        />
                                    ) : null}
                                    <span
                                        className={`text-4xl ${badge.image_url ? 'hidden' : 'block'}`}
                                    >
                                        {badge.icon}
                                    </span>
                                </div>
                                {!badge.image_url && (
                                    <div className={`text-xs font-medium text-center truncate ${earned ? 'text-white' : 'text-slate-400'}`}>
                                        {badge.name}
                                    </div>
                                )}

                                {/* Progress bar for unearned badges */}
                                {!earned && progress > 0 && (
                                    <div className="bg-slate-600 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}

                                {/* Shine effect for earned */}
                                {earned && (
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0 
                                     opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                )}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Gift className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No badges available</p>
                    <p className="text-sm text-slate-500 mt-1">Keep contributing to earn achievements!</p>
                </div>
            )}

            {/* Badge Detail Modal */}
            {selectedBadge && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedBadge(null)}
                >
                    <div
                        className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Badge Image with fallback to icon */}
                        <div className={`w-32 h-32 mx-auto rounded-xl ${selectedBadge.earned
                            ? `bg-gradient-to-br ${getRarityColor(selectedBadge.badge.rarity)}`
                            : 'bg-slate-700'
                            } flex items-center justify-center shadow-lg mb-4 overflow-hidden ${!selectedBadge.earned && 'grayscale opacity-60'}`}>
                            {selectedBadge.badge.image_url ? (
                                <img
                                    src={selectedBadge.badge.image_url}
                                    alt={selectedBadge.badge.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'block';
                                    }}
                                />
                            ) : null}
                            <span className={`text-5xl ${selectedBadge.badge.image_url ? 'hidden' : 'block'}`}>
                                {selectedBadge.badge.icon}
                            </span>
                        </div>

                        {!selectedBadge.badge.image_url && (
                            <h3 className="text-xl font-bold text-white text-center mb-2">
                                {selectedBadge.badge.name}
                            </h3>
                        )}

                        <p className="text-slate-400 text-center text-sm mb-4">
                            {selectedBadge.badge.description}
                        </p>

                        <div className="flex justify-center gap-2 mb-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase
                             ${selectedBadge.badge.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-400' :
                                    selectedBadge.badge.rarity === 'rare' ? 'bg-purple-500/20 text-purple-400' :
                                        selectedBadge.badge.rarity === 'uncommon' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-slate-500/20 text-slate-400'}`}>
                                {selectedBadge.badge.rarity}
                            </span>
                            {selectedBadge.earned && (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                    EARNED
                                </span>
                            )}
                        </div>

                        {/* Progress */}
                        {!selectedBadge.earned && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>Progress</span>
                                    <span>{selectedBadge.progress} / {selectedBadge.badge.criteria_value}</span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                                        style={{ width: `${selectedBadge.progress_percent}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {selectedBadge.earned && (
                            <div className="text-xs text-slate-500 text-center">
                                Earned on {new Date(selectedBadge.earned_at || Date.now()).toLocaleDateString()}
                            </div>
                        )}

                        <button
                            onClick={() => setSelectedBadge(null)}
                            className="w-full mt-4 py-2 bg-slate-700 text-slate-300 rounded-lg font-medium 
                        hover:bg-slate-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Unlock Notification Modal */}
            <BadgeUnlockModal
                badge={currentUnlock}
                onClose={() => setCurrentUnlock(null)}
            />
        </div>
    );
};

export default TrophyCabinet;
