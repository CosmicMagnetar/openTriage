import { motion } from 'framer-motion';

/**
 * SkeletonCard - Premium skeleton loader with emerald shimmer
 * Matches the exact layout of content to hide cold-start lag
 */
const SkeletonCard = ({ variant = "default", className = "" }) => {
    const variants = {
        default: (
            <div className={`card-elevated p-4 ${className}`}>
                <div className="flex items-start gap-3">
                    <div className="skeleton-avatar" />
                    <div className="flex-1 space-y-2">
                        <div className="skeleton-title" />
                        <div className="skeleton-text w-1/2" />
                    </div>
                    <div className="skeleton h-8 w-20 rounded-lg" />
                </div>
            </div>
        ),

        question: (
            <div className={`card-elevated p-4 ${className}`}>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="skeleton h-5 w-5 rounded" />
                        <div className="skeleton-text w-32" />
                    </div>
                    <div className="space-y-2 pl-7">
                        <div className="skeleton-text" />
                        <div className="skeleton-text w-5/6" />
                        <div className="skeleton-text w-4/6" />
                    </div>
                    <div className="flex gap-2 pl-7 pt-2">
                        <div className="skeleton h-9 w-24 rounded-lg" />
                        <div className="skeleton h-9 w-24 rounded-lg" />
                    </div>
                </div>
            </div>
        ),

        chat: (
            <div className={`flex gap-3 ${className}`}>
                <div className="skeleton-avatar flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="skeleton-text w-24" />
                    <div className="card-elevated p-3 max-w-[80%]">
                        <div className="space-y-1.5">
                            <div className="skeleton-text" />
                            <div className="skeleton-text w-4/5" />
                        </div>
                    </div>
                </div>
            </div>
        ),

        aiResponse: (
            <div className={`ai-message-assistant ${className}`}>
                <div className="space-y-2">
                    <div className="skeleton-text" />
                    <div className="skeleton-text w-11/12" />
                    <div className="skeleton-text w-4/5" />
                    <div className="skeleton-text w-3/4" />
                </div>
            </div>
        ),

        list: (
            <div className={`space-y-2 ${className}`}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="card-elevated flex items-center gap-3 p-3">
                        <div className="skeleton-avatar" />
                        <div className="flex-1">
                            <div className="skeleton-text w-40 mb-1.5" />
                            <div className="skeleton-text w-56 h-3" />
                        </div>
                    </div>
                ))}
            </div>
        ),

        contribution: (
            <div className={`card-elevated p-4 ${className}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="skeleton-title w-48" />
                    <div className="skeleton h-6 w-16 rounded-full" />
                </div>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="skeleton h-8 w-8 rounded" />
                        <div className="flex-1">
                            <div className="skeleton-text w-3/4" />
                        </div>
                        <div className="skeleton h-5 w-20 rounded-full" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="skeleton h-8 w-8 rounded" />
                        <div className="flex-1">
                            <div className="skeleton-text w-2/3" />
                        </div>
                        <div className="skeleton h-5 w-16 rounded-full" />
                    </div>
                </div>
            </div>
        )
    };

    return (
        <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
            {variants[variant] || variants.default}
        </motion.div>
    );
};

/**
 * SkeletonText - Inline text skeleton
 */
export const SkeletonText = ({ width = "w-24", height = "h-4", className = "" }) => (
    <span className={`skeleton inline-block ${width} ${height} ${className}`} />
);

/**
 * SkeletonBlock - Block-level skeleton
 */
export const SkeletonBlock = ({ height = "h-32", className = "" }) => (
    <div className={`skeleton w-full ${height} ${className}`} />
);

export default SkeletonCard;
