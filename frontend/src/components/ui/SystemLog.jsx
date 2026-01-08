import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * SystemLog - Terminal-style loading indicator
 * Shows what the AI is doing in a "system log" format
 * 
 * Usage:
 * <SystemLog entries={[
 *   { text: "Fetching README...", status: "done" },
 *   { text: "Parsing Markdown...", status: "active" },
 *   { text: "Generating suggestions", status: "pending" }
 * ]} />
 */
const SystemLog = ({ entries = [], className = "" }) => {
    return (
        <div className={`system-log ${className}`}>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                <span className="text-muted-foreground">[_]</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">System</span>
            </div>
            <AnimatePresence mode="popLayout">
                {entries.map((entry, index) => (
                    <motion.div
                        key={`${entry.text}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`system-log-entry ${entry.status}`}
                    >
                        <span className={`flex-1 ${entry.status === 'active' ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {entry.text}
                        </span>
                        {entry.status === 'active' && (
                            <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 0.8 }}
                                className="text-primary"
                            >
                                _
                            </motion.span>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

/**
 * useSystemLog - Hook to manage system log entries
 * Automatically adds entries with timing
 */
export const useSystemLog = (initialEntries = []) => {
    const [entries, setEntries] = useState(initialEntries);

    const addEntry = (text, status = 'pending') => {
        setEntries(prev => [...prev, { text, status }]);
    };

    const updateStatus = (index, status) => {
        setEntries(prev =>
            prev.map((entry, i) =>
                i === index ? { ...entry, status } : entry
            )
        );
    };

    const markDone = (index) => updateStatus(index, 'done');
    const markActive = (index) => updateStatus(index, 'active');
    const markError = (index) => updateStatus(index, 'error');

    const clear = () => setEntries([]);

    return {
        entries,
        addEntry,
        updateStatus,
        markDone,
        markActive,
        markError,
        clear
    };
};

export default SystemLog;
