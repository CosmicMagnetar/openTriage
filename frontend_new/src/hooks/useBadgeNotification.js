import { useState, useEffect, useCallback } from 'react';
import { gamificationApi } from '../services/api';

const SEEN_BADGES_KEY = 'opentriage_seen_badges';

/**
 * useBadgeNotification - Hook to check for and display new badge notifications
 * 
 * Compares earned badges against previously seen badges to detect new unlocks.
 * Stores seen badge IDs in localStorage to prevent repeat popups.
 */
export const useBadgeNotification = (username, enabled = true) => {
    const [newBadge, setNewBadge] = useState(null);
    const [loading, setLoading] = useState(false);

    // Get previously seen badge IDs from localStorage
    const getSeenBadges = useCallback(() => {
        try {
            const seen = localStorage.getItem(SEEN_BADGES_KEY);
            return seen ? JSON.parse(seen) : [];
        } catch {
            return [];
        }
    }, []);

    // Save seen badge IDs to localStorage
    const markBadgesAsSeen = useCallback((badgeIds) => {
        try {
            const current = getSeenBadges();
            const updated = [...new Set([...current, ...badgeIds])];
            localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save seen badges:', e);
        }
    }, [getSeenBadges]);

    // Check for new badges
    const checkForNewBadges = useCallback(async () => {
        if (!username || !enabled) return;

        setLoading(true);
        try {
            // First, trigger badge check on the backend
            await gamificationApi.checkBadges(username);
            
            // Then fetch user's badges
            const badges = await gamificationApi.getUserBadges(username);
            
            if (!badges || badges.length === 0) return;

            const seenBadges = getSeenBadges();
            const earnedBadgeIds = badges.map(b => b.id || b.badge_id);
            
            // Find badges earned but not yet seen
            const newBadges = badges.filter(badge => {
                const badgeId = badge.id || badge.badge_id;
                return !seenBadges.includes(badgeId);
            });

            if (newBadges.length > 0) {
                // Show the first new badge (can queue others if needed)
                setNewBadge(newBadges[0]);
            }

            // Mark all earned badges as seen after checking
            markBadgesAsSeen(earnedBadgeIds);

        } catch (error) {
            console.warn('Badge check failed:', error);
        } finally {
            setLoading(false);
        }
    }, [username, enabled, getSeenBadges, markBadgesAsSeen]);

    // Dismiss the current badge notification
    const dismissBadge = useCallback(() => {
        setNewBadge(null);
    }, []);

    // Check for badges on mount and when username changes
    useEffect(() => {
        if (username && enabled) {
            // Small delay to not block initial render
            const timer = setTimeout(checkForNewBadges, 1500);
            return () => clearTimeout(timer);
        }
    }, [username, enabled, checkForNewBadges]);

    return {
        newBadge,
        loading,
        dismissBadge,
        checkForNewBadges
    };
};

export default useBadgeNotification;
