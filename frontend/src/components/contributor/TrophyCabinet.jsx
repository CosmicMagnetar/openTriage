import { useState, useEffect } from 'react';
import { Trophy, Gift, Check } from 'lucide-react';
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
            case 'legendary': return 'border-yellow-500/40 bg-yellow-500/10';
            case 'rare': return 'border-purple-500/40 bg-purple-500/10';
            case 'uncommon': return 'border-blue-500/40 bg-blue-500/10';
            default: return 'border-[hsl(220,13%,20%)] bg-[hsl(220,13%,10%)]';
        }
    };

    const getRarityText = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'text-yellow-400';
            case 'rare': return 'text-purple-400';
            case 'uncommon': return 'text-blue-400';
            default: return 'text-[hsl(210,11%,50%)]';
        }
    };

    if (loading) {
        return (
            <div className="bg-[hsl(220,13%,8%)] rounded-lg p-5 border border-[hsl(220,13%,15%)]">
                <div className="flex items-center gap-3 mb-4">
                    <Trophy className="w-5 h-5 text-[hsl(210,11%,50%)]" />
                    <h2 className="text-base font-semibold text-[hsl(210,11%,90%)]">Badges & Achievements</h2>
                </div>
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[hsl(210,11%,50%)]"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[hsl(220,13%,8%)] rounded-lg p-5 border border-[hsl(220,13%,15%)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-[hsl(210,11%,50%)]" />
                    <h2 className="text-base font-semibold text-[hsl(210,11%,90%)]">Badges & Achievements</h2>
                </div>
                <button
                    onClick={checkAchievements}
                    disabled={checking}
                    className="px-3 py-1.5 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,70%)] rounded-md text-sm font-medium hover:bg-[hsl(220,13%,15%)] transition-colors disabled:opacity-50 border border-[hsl(220,13%,18%)]"
                >
                    {checking ? 'Checking...' : 'Check Achievements'}
                </button>
            </div>

            {/* Stats Summary */}
            {stats && (
                <div className="grid grid-cols-5 gap-2 mb-5">
                    <div className="bg-[hsl(220,13%,10%)] rounded-md p-3 text-center border border-[hsl(220,13%,15%)]">
                        <div className="text-xl font-bold text-[hsl(210,11%,90%)]">{stats.total_earned}</div>
                        <div className="text-xs text-[hsl(210,11%,50%)]">Earned</div>
                    </div>
                    <div className="bg-[hsl(220,13%,10%)] rounded-md p-3 text-center border border-[hsl(220,13%,15%)]">
                        <div className="text-xl font-bold text-[hsl(210,11%,50%)]">{stats.common || 0}</div>
                        <div className="text-xs text-[hsl(210,11%,40%)]">Common</div>
                    </div>
                    <div className="bg-blue-500/5 rounded-md p-3 text-center border border-blue-500/20">
                        <div className="text-xl font-bold text-blue-400">{stats.uncommon || 0}</div>
                        <div className="text-xs text-blue-400/70">Uncommon</div>
                    </div>
                    <div className="bg-purple-500/5 rounded-md p-3 text-center border border-purple-500/20">
                        <div className="text-xl font-bold text-purple-400">{stats.rare || 0}</div>
                        <div className="text-xs text-purple-400/70">Rare</div>
                    </div>
                    <div className="bg-yellow-500/5 rounded-md p-3 text-center border border-yellow-500/20">
                        <div className="text-xl font-bold text-yellow-400">{stats.legendary || 0}</div>
                        <div className="text-xs text-yellow-400/70">Legendary</div>
                    </div>
                </div>
            )}

            {/* Badges Grid */}
            {badges.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {badges.map((item) => {
                        const badge = item.badge;
                        const earned = item.earned;
                        const progress = item.progress_percent || 0;

                        return (
                            <button
                                key={badge.id}
                                onClick={() => setSelectedBadge(item)}
                                className={`relative aspect-square rounded-md p-2 transition-colors border
                                    ${earned
                                        ? `${getRarityColor(badge.rarity)} hover:border-[hsl(210,11%,35%)]`
                                        : 'bg-[hsl(220,13%,8%)] border-[hsl(220,13%,15%)] opacity-50'
                                    }`}
                            >
                                {/* Earned checkmark */}
                                {earned && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-[hsl(142,70%,45%)] rounded-full flex items-center justify-center">
                                        <Check className="w-2.5 h-2.5 text-white" />
                                    </div>
                                )}

                                {/* Badge Content */}
                                <div className={`flex items-center justify-center h-full ${!earned && 'grayscale opacity-50'}`}>
                                    {badge.image_url ? (
                                        <img
                                            src={badge.image_url}
                                            alt={badge.name}
                                            className="w-full h-full object-contain rounded"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'block';
                                            }}
                                        />
                                    ) : null}
                                    <span className={`text-3xl ${badge.image_url ? 'hidden' : 'block'}`}>
                                        {badge.icon}
                                    </span>
                                </div>

                                {/* Progress bar for unearned badges */}
                                {!earned && progress > 0 && (
                                    <div className="absolute bottom-1 left-1 right-1 h-1 bg-[hsl(220,13%,15%)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[hsl(217,91%,60%)]"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Gift className="w-10 h-10 text-[hsl(220,13%,20%)] mx-auto mb-3" />
                    <p className="text-[hsl(210,11%,50%)]">No badges available</p>
                    <p className="text-sm text-[hsl(210,11%,40%)] mt-1">Keep contributing to earn achievements!</p>
                </div>
            )}

            {/* Badge Detail Modal */}
            {selectedBadge && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedBadge(null)}
                >
                    <div
                        className="bg-[hsl(220,13%,8%)] rounded-lg p-5 max-w-sm w-full border border-[hsl(220,13%,15%)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Badge Icon */}
                        <div className={`w-20 h-20 mx-auto rounded-lg ${selectedBadge.earned
                            ? getRarityColor(selectedBadge.badge.rarity)
                            : 'bg-[hsl(220,13%,10%)]'
                            } flex items-center justify-center mb-4 border ${!selectedBadge.earned && 'grayscale opacity-60'}`}>
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
                            <span className={`text-4xl ${selectedBadge.badge.image_url ? 'hidden' : 'block'}`}>
                                {selectedBadge.badge.icon}
                            </span>
                        </div>

                        <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] text-center mb-2">
                            {selectedBadge.badge.name}
                        </h3>

                        <p className="text-[hsl(210,11%,50%)] text-center text-sm mb-4">
                            {selectedBadge.badge.description}
                        </p>

                        <div className="flex justify-center gap-2 mb-4">
                            <span className={`px-2.5 py-1 rounded text-xs font-medium uppercase border
                             ${selectedBadge.badge.rarity === 'legendary' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25' :
                                    selectedBadge.badge.rarity === 'rare' ? 'bg-purple-500/10 text-purple-400 border-purple-500/25' :
                                        selectedBadge.badge.rarity === 'uncommon' ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
                                            'bg-[hsl(220,13%,12%)] text-[hsl(210,11%,50%)] border-[hsl(220,13%,18%)]'}`}>
                                {selectedBadge.badge.rarity}
                            </span>
                            {selectedBadge.earned && (
                                <span className="px-2.5 py-1 rounded text-xs font-medium bg-[hsl(142,70%,45%,0.15)] text-[hsl(142,70%,55%)] border border-[hsl(142,70%,45%,0.25)]">
                                    EARNED
                                </span>
                            )}
                        </div>

                        {/* Progress */}
                        {!selectedBadge.earned && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-[hsl(210,11%,50%)] mb-1">
                                    <span>Progress</span>
                                    <span>{selectedBadge.progress} / {selectedBadge.badge.criteria_value}</span>
                                </div>
                                <div className="h-1.5 bg-[hsl(220,13%,12%)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[hsl(217,91%,60%)]"
                                        style={{ width: `${selectedBadge.progress_percent}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {selectedBadge.earned && (
                            <div className="text-xs text-[hsl(210,11%,40%)] text-center mb-4">
                                Earned on {new Date(selectedBadge.earned_at || Date.now()).toLocaleDateString()}
                            </div>
                        )}

                        <button
                            onClick={() => setSelectedBadge(null)}
                            className="w-full py-2 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,75%)] rounded-md font-medium hover:bg-[hsl(220,13%,15%)] transition-colors border border-[hsl(220,13%,18%)]"
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
