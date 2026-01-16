/**
 * Simple In-Memory Cache with TTL
 * 
 * A lightweight caching utility for reducing expensive computations.
 * Can be replaced with Redis for distributed caching if needed.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

class TTLCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private defaultTTL: number;

    /**
     * @param defaultTTLMs Default time-to-live in milliseconds (default: 5 minutes)
     */
    constructor(defaultTTLMs: number = 5 * 60 * 1000) {
        this.defaultTTL = defaultTTLMs;
    }

    /**
     * Get a value from cache
     * @returns The cached value or undefined if not found/expired
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            console.log(`[Cache] MISS (expired): ${key}`);
            return undefined;
        }

        console.log(`[Cache] HIT: ${key}`);
        return entry.value;
    }

    /**
     * Set a value in cache
     * @param ttlMs Optional TTL override for this specific entry
     */
    set(key: string, value: T, ttlMs?: number): void {
        const ttl = ttlMs ?? this.defaultTTL;
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl,
        });
        console.log(`[Cache] SET: ${key} (TTL: ${ttl}ms)`);
    }

    /**
     * Invalidate a specific key
     */
    invalidate(key: string): void {
        this.cache.delete(key);
        console.log(`[Cache] INVALIDATE: ${key}`);
    }

    /**
     * Invalidate all keys matching a pattern (prefix)
     */
    invalidatePrefix(prefix: string): void {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        console.log(`[Cache] INVALIDATE PREFIX: ${prefix} (${count} keys)`);
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
        console.log(`[Cache] CLEARED`);
    }

    /**
     * Get cache statistics
     */
    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
}

// Pre-configured caches for different use cases

/** Streak cache - 5 minute TTL */
export const streakCache = new TTLCache<{
    current_streak: number;
    longest_streak: number;
    is_active: boolean;
    total_contribution_days: number;
}>(5 * 60 * 1000);

/** Calendar cache - 10 minute TTL (larger data, less frequently changing) */
export const calendarCache = new TTLCache<Array<{ date: string; contributions: number }>>(10 * 60 * 1000);

/** Generic cache for other uses */
export const genericCache = new TTLCache<unknown>(5 * 60 * 1000);

export { TTLCache };
