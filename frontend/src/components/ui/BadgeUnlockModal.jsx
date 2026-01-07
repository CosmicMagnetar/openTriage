import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Sparkles } from 'lucide-react';

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
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 50 }}
                    transition={{ type: "spring", damping: 15, stiffness: 300 }}
                    className="relative w-full max-w-md bg-slate-800 border-2 border-amber-500/50 rounded-2xl p-8 shadow-2xl overflow-hidden"
                >
                    {/* Background Shine Effect */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(245,158,11,0.1)_180deg,transparent_360deg)]"
                        />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.2, type: "spring", damping: 12 }}
                            className="w-32 h-32 mb-6 relative"
                        >
                            {/* Glow */}
                            <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-2xl animate-pulse" />

                            {/* Badge Icon/Image */}
                            <div className="w-full h-full bg-slate-900 rounded-full border-4 border-amber-500 flex items-center justify-center text-6xl shadow-xl overflow-hidden">
                                {badge.image_url ? (
                                    <img
                                        src={`${import.meta.env.VITE_BACKEND_URL}${badge.image_url}`}
                                        alt={badge.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'block';
                                        }}
                                    />
                                ) : null}
                                <span style={{ display: badge.image_url ? 'none' : 'block' }}>
                                    {badge.icon}
                                </span>
                            </div>

                            {/* Stars */}
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute -top-2 -right-2 text-yellow-400"
                            >
                                <Sparkles className="w-8 h-8 fill-yellow-400" />
                            </motion.div>
                        </motion.div>

                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent"
                        >
                            Badge Unlocked!
                        </motion.h2>

                        {!badge.image_url && (
                            <motion.h3
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-xl text-slate-200 font-semibold mb-4"
                            >
                                {badge.name}
                            </motion.h3>
                        )}

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="text-slate-400 mb-8"
                        >
                            {badge.description}
                        </motion.p>

                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            onClick={onClose}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-105 transition-all active:scale-95"
                        >
                            Awesome!
                        </motion.button>
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-20"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BadgeUnlockModal;
