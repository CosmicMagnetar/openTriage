import { useState } from 'react';
import { Trophy, Plus, Settings } from 'lucide-react';
import BadgeSelectionModal from './BadgeSelectionModal';

/**
 * FeaturedBadges - Displays up to 3 featured badges in the profile header
 * GitHub-style flat design
 */
const FeaturedBadges = ({ featuredBadges = [], allBadges = [], onUpdate, username }) => {
    const [showModal, setShowModal] = useState(false);

    const getRarityBorder = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'border-yellow-500/50';
            case 'rare': return 'border-purple-500/50';
            case 'uncommon': return 'border-blue-500/50';
            default: return 'border-[hsl(220,13%,25%)]';
        }
    };

    const getRarityBg = (rarity) => {
        switch (rarity) {
            case 'legendary': return 'bg-yellow-500/10';
            case 'rare': return 'bg-purple-500/10';
            case 'uncommon': return 'bg-blue-500/10';
            default: return 'bg-[hsl(220,13%,12%)]';
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
                                <button
                                    key={badge.badge?.id || index}
                                    onClick={() => setShowModal(true)}
                                    className={`relative w-10 h-10 rounded-md ${getRarityBg(badge.badge?.rarity)} 
                                        border ${getRarityBorder(badge.badge?.rarity)}
                                        flex items-center justify-center cursor-pointer
                                        hover:border-[hsl(210,11%,40%)] transition-colors`}
                                    title={badge.badge?.name}
                                >
                                    {badge.badge?.image_url ? (
                                        <img
                                            src={badge.badge.image_url}
                                            alt={badge.badge.name}
                                            className="w-full h-full object-contain rounded-md"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <span
                                        className={`text-xl ${badge.badge?.image_url ? 'hidden' : 'flex'} items-center justify-center`}
                                    >
                                        {badge.badge?.icon || '🏆'}
                                    </span>
                                </button>
                            );
                        }

                        // Empty slot
                        return (
                            <button
                                key={index}
                                onClick={() => setShowModal(true)}
                                className="w-10 h-10 rounded-md border border-dashed border-[hsl(220,13%,20%)] 
                                    flex items-center justify-center text-[hsl(210,11%,40%)]
                                    hover:border-[hsl(220,13%,30%)] hover:text-[hsl(210,11%,50%)] transition-colors"
                                title="Add featured badge"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        );
                    })}
                </div>

                {/* Edit Button */}
                {earnedBadges.length > 0 && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[hsl(210,11%,50%)] 
                            text-sm hover:text-[hsl(210,11%,75%)] hover:bg-[hsl(220,13%,12%)] 
                            rounded-md transition-colors"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Edit
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
