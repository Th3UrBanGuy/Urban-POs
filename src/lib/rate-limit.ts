/**
 * Simple in-memory rate limiter.
 * Works per-process. Given maxInstances: 1 in apphosting.yaml, this is sufficient.
 * For multi-instance deployments, replace with a Redis-backed solution.
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Predefined rate limit presets
export const RATE_LIMITS = {
    login: { limit: 5, windowMs: 60_000 },        // 5 attempts per 60s
    emailReceipt: { limit: 3, windowMs: 60_000 },  // 3 emails per 60s
    exchangeSync: { limit: 1, windowMs: 60_000 },  // 1 sync per 60s
    masterKeyOps: { limit: 5, windowMs: 60_000 },  // 5 ops per 60s
} as const;

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

/**
 * Checks and records a rate limit hit for a given key.
 * @param key - Unique identifier, e.g. `login:192.168.1.1`
 * @param limit - Max allowed hits
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    if (entry.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: entry.resetAt - now,
        };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}

// Periodically clean up expired entries to prevent memory leaks
if (typeof globalThis.setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        store.forEach((entry, key) => {
            if (now > entry.resetAt) store.delete(key);
        });
    }, 60_000);
}
