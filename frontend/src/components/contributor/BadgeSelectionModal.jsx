import { useState, useEffect } from 'react';
import { Trophy, X, Check, Sparkles, Lock } from 'lucide-react';
import { profileApi } from '../../services/api';
import { toast } from 'sonner';

/**
 * BadgeSelectionModal - Full-screen modal for selecting up to 3 featured badges
 * Similar to LeetCode's badge selection interface
 */
const BadgeSelectionModal = ({ isOpen, onClose, allBadges = [], featuredBadges = [], onSave, username }) => {
    const [selectedBadgeIds, setSelectedBadgeIds] = useState([]);
    const [saving, setSaving] = useState(false);

    // Initialize selected badges from props
    useEffect(() => {
        if (isOpen) {
            const currentIds = featuredBadges.map(b => b.badge?.id).filter(Boolean);
            setSelectedBadgeIds(currentIds);
        }
    }, [isOpen, featuredBadges]);

    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'from-yellow-500 to-amber-600';
            case 'rare': return 'from-purple-500 to-pink-600';
            case 'uncommon': return 'from-blue-500 to-cyan-600';
            default: return 'from-slate-500 to-slate-600';
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

    const getRarityLabel = (rarity) => {
        switch (rarity) {
            case 'legendary': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
            case 'rare': return { bg: 'bg-purple-500/20', text: 'text-purple-400' };
            case 'uncommon': return { bg: 'bg-blue-500/20', text: 'text-blue-400' };
            default: return { bg: 'bg-slate-500/20', text: 'text-slate-400' };
        }
    };

    const toggleBadge = (badgeId, earned) => {
        if (!earned) return; // Can't select unearned badges

        if (selectedBadgeIds.includes(badgeId)) {
            setSelectedBadgeIds(selectedBadgeIds.filter(id => id !== badgeId));
        } else if (selectedBadgeIds.length < 3) {
            setSelectedBadgeIds([...selectedBadgeIds, badgeId]);
        } else {
            toast.error('You can only feature up to 3 badges');
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await profileApi.updateFeaturedBadges(username, selectedBadgeIds);

            // Get selected badge objects for parent component
            const selectedBadgeObjects = allBadges.filter(b =>
                selectedBadgeIds.includes(b.badge?.id)
            );

            if (onSave) {
                onSave(selectedBadgeObjects);
            }

            toast.success('Featured badges updated!');
            onClose();
        } catch (error) {
            console.error('Failed to save featured badges:', error);
            toast.error('Failed to save featured badges');
        } finally {
            setSaving(false);
        }
    };

    // Group badges by rarity
    const groupedBadges = {
        legendary: allBadges.filter(b => b.badge?.rarity === 'legendary'),
        rare: allBadges.filter(b => b.badge?.rarity === 'rare'),
        uncommon: allBadges.filter(b => b.badge?.rarity === 'uncommon'),
        common: allBadges.filter(b => b.badge?.rarity === 'common')
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-slate-700 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Featured Badges</h2>
                            <p className="text-sm text-slate-400">Select up to 3 badges to showcase on your profile</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 hover:text-white 
                            hover:bg-slate-700 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Selection Status */}
                <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-slate-300">
                            Selected: <span className="font-bold text-yellow-400">{selectedBadgeIds.length}/3</span>
                        </span>
                    </div>
                    {selectedBadgeIds.length > 0 && (
                        <button
                            onClick={() => setSelectedBadgeIds([])}
                            className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Clear selection
                        </button>
                    )}
                </div>

                {/* Badge Grid */}
                <div className="p-6 overflow-y-auto max-h-[50vh] space-y-6">
                    {['legendary', 'rare', 'uncommon', 'common'].map((rarity) => {
                        const badges = groupedBadges[rarity];
                        if (badges.length === 0) return null;

                        const rarityStyle = getRarityLabel(rarity);

                        return (
                            <div key={rarity}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${rarityStyle.bg} ${rarityStyle.text}`}>
                                        {rarity}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {badges.filter(b => b.earned).length} / {badges.length} earned
                                    </span>
                                </div>

                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                                    {badges.map((item) => {
                                        const badge = item.badge;
                                        const earned = item.earned;
                                        const isSelected = selectedBadgeIds.includes(badge.id);

                                        return (
                                            <button
                                                key={badge.id}
                                                onClick={() => toggleBadge(badge.id, earned)}
                                                disabled={!earned}
                                                className={`relative aspect-square rounded-xl p-2 transition-all duration-200
                                                    ${earned
                                                        ? isSelected
                                                            ? `bg-gradient-to-br ${getRarityColor(badge.rarity)} ring-2 ring-white shadow-lg scale-105`
                                                            : `bg-gradient-to-br ${getRarityColor(badge.rarity)} hover:scale-105 cursor-pointer`
                                                        : 'bg-slate-800/50 opacity-40 cursor-not-allowed grayscale'
                                                    }
                                                    border ${!earned ? 'border-slate-700' : getRarityBorder(badge.rarity)}`}
                                            >
                                                {/* Selected Checkmark */}
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full 
                                                        flex items-center justify-center shadow-lg z-10">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}

                                                {/* Lock icon for unearned */}
                                                {!earned && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Lock className="w-5 h-5 text-slate-500" />
                                                    </div>
                                                )}

                                                {/* Badge Content */}
                                                <div className={`flex flex-col items-center justify-center h-full ${!earned && 'invisible'}`}>
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
                                                    <span className={`text-3xl ${badge.image_url ? 'hidden' : 'block'}`}>
                                                        {badge.icon || '🏆'}
                                                    </span>
                                                </div>

                                                {/* Tooltip */}
                                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100
                                                    transition-opacity whitespace-nowrap pointer-events-none z-20">
                                                    <span className="px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg">
                                                        {badge.name}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700 bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg font-medium
                            hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-medium
                            hover:bg-yellow-400 disabled:opacity-50 transition-colors"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Save Featured Badges
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BadgeSelectionModal;
