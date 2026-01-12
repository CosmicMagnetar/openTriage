import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';

const BadgeUnlockModal = ({ badge, onClose }) => {
    if (!badge) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-[hsl(220,13%,5%,0.9)]"
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-sm bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,18%)] rounded-lg p-6 shadow-xl"
                >
                    {/* Content */}
                    <div className="flex flex-col items-center text-center">
                        {/* Badge Icon */}
                        <div className="w-20 h-20 mb-5 bg-[hsl(220,13%,12%)] rounded-full border-2 border-[hsl(220,13%,25%)] flex items-center justify-center overflow-hidden">
                            {badge.image_url ? (
                                <img
                                    src={`${import.meta.env.VITE_BACKEND_URL}${badge.image_url}`}
                                    alt={badge.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <span
                                className="text-4xl"
                                style={{ display: badge.image_url ? 'none' : 'flex' }}
                            >
                                {badge.icon}
                            </span>
                        </div>

                        {/* Title */}
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-4 h-4 text-[hsl(142,70%,55%)]" />
                            <span className="text-sm font-medium text-[hsl(142,70%,55%)] uppercase tracking-wide">
                                Badge Unlocked
                            </span>
                        </div>

                        {/* Badge Name */}
                        <h3 className="text-lg font-semibold text-[hsl(210,11%,90%)] mb-2">
                            {badge.name}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-[hsl(210,11%,50%)] mb-6 leading-relaxed">
                            {badge.description}
                        </p>

                        {/* Action Button */}
                        <button
                            onClick={onClose}
                            className="w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] text-black px-6 py-2.5 rounded-md font-medium transition-colors"
                        >
                            Continue
                        </button>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 text-[hsl(210,11%,40%)] hover:text-[hsl(210,11%,75%)] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BadgeUnlockModal;
