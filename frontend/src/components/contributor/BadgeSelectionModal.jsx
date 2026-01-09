import { useState, useEffect } from 'react';
import { Trophy, X, Check, Lock } from 'lucide-react';
import { profileApi } from '../../services/api';
import { toast } from 'sonner';

/**
 * BadgeSelectionModal - Full-screen modal for selecting up to 3 featured badges
 * GitHub-style flat design
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
            case 'legendary': return 'border-yellow-500/50 bg-yellow-500/10';
            case 'rare': return 'border-purple-500/50 bg-purple-500/10';
            case 'uncommon': return 'border-blue-500/50 bg-blue-500/10';
            default: return 'border-[hsl(220,13%,25%)] bg-[hsl(220,13%,12%)]';
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

    const getRarityLabel = (rarity) => {
        switch (rarity) {
            case 'legendary': return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/25' };
            case 'rare': return { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/25' };
            case 'uncommon': return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/25' };
            default: return { bg: 'bg-[hsl(220,13%,15%)]', text: 'text-[hsl(210,11%,50%)]', border: 'border-[hsl(220,13%,20%)]' };
        }
    };

    const toggleBadge = (badgeId, earned) => {
        if (!earned) return;

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

            const selectedBadgeObjects = allBadges.filter(b =>
                selectedBadgeIds.includes(b.badge?.id)
            );

            if (onSave) {
                onSave(selectedBadgeObjects);
            }

            toast.success('Featured badges updated');
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
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-[hsl(220,13%,8%)] rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden border border-[hsl(220,13%,15%)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[hsl(220,13%,15%)]">
                    <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-[hsl(210,11%,50%)]" />
                        <div>
                            <h2 className="text-lg font-semibold text-[hsl(210,11%,90%)]">Featured Badges</h2>
                            <p className="text-sm text-[hsl(210,11%,50%)]">Select up to 3 badges to showcase</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,12%)] rounded-md transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Selection Status */}
                <div className="px-5 py-3 bg-[hsl(220,13%,6%)] border-b border-[hsl(220,13%,15%)] flex items-center justify-between">
                    <span className="text-sm text-[hsl(210,11%,60%)]">
                        Selected: <span className="font-medium text-[hsl(210,11%,90%)]">{selectedBadgeIds.length}/3</span>
                    </span>
                    {selectedBadgeIds.length > 0 && (
                        <button
                            onClick={() => setSelectedBadgeIds([])}
                            className="text-sm text-[hsl(210,11%,50%)] hover:text-[hsl(210,11%,75%)] transition-colors"
                        >
                            Clear selection
                        </button>
                    )}
                </div>

                {/* Badge Grid */}
                <div className="p-5 overflow-y-auto max-h-[50vh] space-y-6">
                    {['legendary', 'rare', 'uncommon', 'common'].map((rarity) => {
                        const badges = groupedBadges[rarity];
                        if (badges.length === 0) return null;

                        const rarityStyle = getRarityLabel(rarity);

                        return (
                            <div key={rarity}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase border ${rarityStyle.bg} ${rarityStyle.text} ${rarityStyle.border}`}>
                                        {rarity}
                                    </span>
                                    <span className="text-xs text-[hsl(210,11%,40%)]">
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
                                                className={`relative aspect-square rounded-lg p-2 transition-all border-2
                                                    ${earned
                                                        ? isSelected
                                                            ? `${getRarityColor(badge.rarity)} ring-2 ring-[hsl(142,70%,55%)]`
                                                            : `${getRarityColor(badge.rarity)} hover:border-[hsl(210,11%,35%)]`
                                                        : 'bg-[hsl(220,13%,10%)] border-[hsl(220,13%,15%)] opacity-40 cursor-not-allowed'
                                                    }`}
                                            >
                                                {/* Selected Checkmark */}
                                                {isSelected && (
                                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(142,70%,45%)] rounded-full flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}

                                                {/* Lock icon for unearned */}
                                                {!earned && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Lock className="w-5 h-5 text-[hsl(210,11%,30%)]" />
                                                    </div>
                                                )}

                                                {/* Badge Content */}
                                                <div className={`flex flex-col items-center justify-center h-full ${!earned && 'invisible'}`}>
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
                                                        {badge.icon || '🏆'}
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
                <div className="flex items-center justify-end gap-3 p-5 border-t border-[hsl(220,13%,15%)] bg-[hsl(220,13%,6%)]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[hsl(220,13%,12%)] text-[hsl(210,11%,75%)] rounded-md font-medium hover:bg-[hsl(220,13%,15%)] transition-colors border border-[hsl(220,13%,18%)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(142,70%,45%)] text-black rounded-md font-medium hover:bg-[hsl(142,70%,50%)] disabled:opacity-50 transition-colors"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                                Saving...
                            </>
                        ) : (
                            'Save Featured Badges'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BadgeSelectionModal;
