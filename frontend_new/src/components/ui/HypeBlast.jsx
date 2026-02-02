import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Trophy, PartyPopper } from 'lucide-react';

/**
 * Confetti - Celebration confetti effect component
 */
export const Confetti = ({ show, count = 50 }) => {
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

    if (!show) return null;

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        opacity: 1,
                        y: -20,
                        x: `${Math.random() * 100}%`,
                        rotate: 0,
                        scale: Math.random() * 0.5 + 0.5
                    }}
                    animate={{
                        opacity: 0,
                        y: '100vh',
                        rotate: Math.random() * 720 - 360,
                    }}
                    transition={{
                        duration: Math.random() * 2 + 2,
                        delay: Math.random() * 0.5,
                        ease: 'easeOut'
                    }}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{ backgroundColor: colors[i % colors.length] }}
                />
            ))}
        </div>
    );
};

/**
 * HypeBlast - Full-screen celebration modal for merged PRs
 */
const HypeBlast = ({ show, onClose, prNumber, prTitle, impactSummary, repoName }) => {
    return (
        <AnimatePresence>
            {show && (
                <>
                    {/* Confetti */}
                    <Confetti show={show} count={80} />
                    
                    {/* Modal Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
                    />
                    
                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div 
                            className="bg-gradient-to-b from-[hsl(220,13%,10%)] to-[hsl(220,13%,6%)] 
                                rounded-2xl p-8 max-w-lg w-full border border-[hsl(220,13%,20%)] 
                                shadow-2xl pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Celebration Header */}
                            <div className="text-center mb-6">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1, rotate: [0, -10, 10, -5, 5, 0] }}
                                    transition={{ delay: 0.2, duration: 0.8 }}
                                    className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br 
                                        from-[hsl(142,70%,45%)] to-[hsl(142,70%,55%)] 
                                        flex items-center justify-center shadow-lg shadow-[hsl(142,70%,45%,0.3)]"
                                >
                                    <PartyPopper className="w-10 h-10 text-black" />
                                </motion.div>
                                
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-3xl font-bold text-[hsl(210,11%,95%)] mb-2"
                                >
                                    🎉 PR Merged!
                                </motion.h2>
                                
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-[hsl(210,11%,60%)]"
                                >
                                    Congratulations on your contribution!
                                </motion.p>
                            </div>

                            {/* PR Info */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="bg-[hsl(220,13%,8%)] rounded-xl p-4 mb-6 border border-[hsl(220,13%,15%)]"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[hsl(142,70%,55%)] font-mono font-bold">
                                        #{prNumber}
                                    </span>
                                    <span className="text-xs text-[hsl(210,11%,50%)] bg-[hsl(220,13%,15%)] px-2 py-0.5 rounded">
                                        {repoName}
                                    </span>
                                </div>
                                <p className="text-[hsl(210,11%,85%)] font-medium line-clamp-2">
                                    {prTitle}
                                </p>
                            </motion.div>

                            {/* Impact Summary */}
                            {impactSummary && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                    className="mb-6"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap className="w-4 h-4 text-yellow-400" />
                                        <span className="text-sm font-medium text-[hsl(210,11%,75%)]">
                                            Impact Summary
                                        </span>
                                    </div>
                                    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 
                                        rounded-lg p-4 border border-yellow-500/20">
                                        <p className="text-[hsl(210,11%,85%)] text-sm leading-relaxed">
                                            {impactSummary}
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Motivational Stats */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                                className="grid grid-cols-3 gap-3 mb-6"
                            >
                                <div className="text-center p-3 bg-[hsl(220,13%,8%)] rounded-lg border border-[hsl(220,13%,15%)]">
                                    <Sparkles className="w-5 h-5 text-[hsl(142,70%,55%)] mx-auto mb-1" />
                                    <span className="text-xs text-[hsl(210,11%,50%)]">XP Earned</span>
                                    <p className="text-lg font-bold text-[hsl(142,70%,55%)]">+50</p>
                                </div>
                                <div className="text-center p-3 bg-[hsl(220,13%,8%)] rounded-lg border border-[hsl(220,13%,15%)]">
                                    <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                                    <span className="text-xs text-[hsl(210,11%,50%)]">Streak</span>
                                    <p className="text-lg font-bold text-yellow-400">🔥+1</p>
                                </div>
                                <div className="text-center p-3 bg-[hsl(220,13%,8%)] rounded-lg border border-[hsl(220,13%,15%)]">
                                    <Zap className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                                    <span className="text-xs text-[hsl(210,11%,50%)]">Impact</span>
                                    <p className="text-lg font-bold text-purple-400">High</p>
                                </div>
                            </motion.div>

                            {/* Close Button */}
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                onClick={onClose}
                                className="w-full py-3 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] 
                                    text-black font-semibold rounded-lg transition-colors"
                            >
                                Keep Building! 🚀
                            </motion.button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default HypeBlast;
