import { useState } from 'react';
import { Trophy, Plus, Eye } from 'lucide-react';
import BadgeSelectionModal from './BadgeSelectionModal';

/**
 * FeaturedBadges - Displays up to 3 featured badges in the profile header
 * Similar to LeetCode's achievement showcase
 */
const FeaturedBadges = ({ featuredBadges = [], allBadges = [], onUpdate, username }) => {
    const [showModal, setShowModal] = useState(false);

    const getRarityGlow = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'ring-yellow-500/50 shadow-yellow-500/30';
            case 'rare': return 'ring-purple-500/50 shadow-purple-500/30';
            case 'uncommon': return 'ring-blue-500/50 shadow-blue-500/30';
            default: return 'ring-slate-500/50 shadow-slate-500/30';
        }
    };

    const getRarityBg = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'from-yellow-500 to-amber-600';
            case 'rare': return 'from-purple-500 to-pink-600';
            case 'uncommon': return 'from-blue-500 to-cyan-600';
            default: return 'from-slate-500 to-slate-600';
        }
    };

    // Get earned badges only for display
    const earnedBadges = allBadges.filter(b => b.earned);
    const displayBadges = featuredBadges.length > 0
        ? featuredBadges
        : earnedBadges.slice(0, 3);

    return (
        <>
            <div className="flex items-center gap-3">
                {/* Featured Badge Slots */}
                <div className="flex items-center gap-2">
                    {[0, 1, 2].map((index) => {
                        const badge = displayBadges[index];

                        if (badge) {
                            return (
                                <div
                                    key={badge.badge?.id || index}
                                    className={`relative group w-12 h-12 rounded-xl bg-gradient-to-br ${getRarityBg(badge.badge?.rarity)} 
                                        ring-2 ${getRarityGlow(badge.badge?.rarity)} shadow-lg
                                        flex items-center justify-center cursor-pointer
                                        hover:scale-110 transition-transform duration-200`}
                                    onClick={() => setShowModal(true)}
                                    title={badge.badge?.name}
                                >
                                    {badge.badge?.image_url ? (
                                        <img
                                            src={badge.badge.image_url}
                                            alt={badge.badge.name}
                                            className="w-full h-full object-contain rounded-xl"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'block';
                                            }}
                                        />
                                    ) : null}
                                    <span className={`text-2xl ${badge.badge?.image_url ? 'hidden' : 'block'}`}>
                                        {badge.badge?.icon || '🏆'}
                                    </span>

                                    {/* Tooltip */}
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100
                                        transition-opacity whitespace-nowrap z-10">
                                        <span className="px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg">
                                            {badge.badge?.name}
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        // Empty slot
                        return (
                            <button
                                key={index}
                                onClick={() => setShowModal(true)}
                                className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-600 
                                    flex items-center justify-center text-slate-500
                                    hover:border-slate-500 hover:text-slate-400 transition-colors"
                                title="Add featured badge"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        );
                    })}
                </div>

                {/* View All Button */}
                {earnedBadges.length > 0 && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 
                            rounded-lg text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                        View All
                    </button>
                )}
            </div>

            {/* Badge Selection Modal */}
            <BadgeSelectionModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                allBadges={allBadges}
                featuredBadges={featuredBadges}
                onSave={onUpdate}
                username={username}
            />
        </>
    );
};

export default FeaturedBadges;
