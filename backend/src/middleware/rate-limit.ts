/**
 * In-memory rate limiting middleware for Bun
 * 
 * Features:
 * - Configurable windows and request limits
 * - Per-IP tracking with automatic cleanup
 * - Pre-configured limiters for auth, image generation, and general API
 */

import { log } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyGenerator?: (req: Request) => string;  // Custom key generator (default: IP-based)
  skipFailedRequests?: boolean;  // Don't count failed requests
}

interface RateLimitStore {
  entries: Map<string, RateLimitEntry>;
  cleanupInterval: ReturnType<typeof setInterval>;
}

// Store rate limit data in memory
const stores = new Map<string, RateLimitStore>();

/**
 * Get or create a rate limit store for a specific limiter
 */
function getStore(name: string, windowMs: number): RateLimitStore {
  if (!stores.has(name)) {
    const store: RateLimitStore = {
      entries: new Map(),
      cleanupInterval: setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries) {
          if (entry.resetAt <= now) {
            store.entries.delete(key);
          }
        }
      }, Math.min(windowMs, 60000)) // Cleanup at most every minute
    };
    stores.set(name, store);
  }
  return stores.get(name)!;
}

/**
 * Extract IP address from request
 */
function getClientIP(req: Request): string {
  // Railway/proxy headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIP = forwarded.split(',')[0];
    return firstIP ? firstIP.trim() : '127.0.0.1';
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback for local development
  return '127.0.0.1';
}

/**
 * Create a rate limiter function
 */
export function rateLimit(name: string, options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = getClientIP,
  } = options;

  const store = getStore(name, windowMs);

  return async (req: Request): Promise<Response | null> => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = store.entries.get(key);
    
    if (!entry || entry.resetAt <= now) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetAt: now + windowMs
      };
      store.entries.set(key, entry);
      return null; // Allow request
    }
    
    entry.count++;
    
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      
      log('WARN', 'Rate limit exceeded', {
        limiter: name,
        ip: key,
        count: entry.count,
        maxRequests,
        retryAfter
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000))
        }
      });
    }
    
    return null; // Allow request
  };
}

// Pre-configured limiters

/**
 * Auth limiter: 10 requests per 15 minutes
 * Protects against brute force attacks while allowing password typos
 */
export const authLimiter = rateLimit('auth', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10
});

/**
 * Image generation limiter: 5 requests per minute
 * Protects against excessive DALL-E API usage (cost control)
 */
export const generateLimiter = rateLimit('generate', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5
});

/**
 * General API limiter: 100 requests per minute
 * Protects against DDoS and abuse
 */
export const apiLimiter = rateLimit('api', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100
});

/**
 * Apply rate limiting to a route handler
 */
export function withRateLimit(
  limiter: (req: Request) => Promise<Response | null>,
  handler: (req: Request) => Promise<Response> | Response
) {
  return async (req: Request): Promise<Response> => {
    const limitResponse = await limiter(req);
    if (limitResponse) {
      return limitResponse;
    }
    return handler(req);
  };
}

/**
 * Check multiple rate limiters (e.g., both API and auth limits)
 */
export async function checkRateLimits(
  req: Request,
  ...limiters: Array<(req: Request) => Promise<Response | null>>
): Promise<Response | null> {
  for (const limiter of limiters) {
    const response = await limiter(req);
    if (response) {
      return response;
    }
  }
  return null;
}

/**
 * Cleanup all stores (for testing or shutdown)
 */
export function clearAllStores(): void {
  for (const [, store] of stores) {
    clearInterval(store.cleanupInterval);
    store.entries.clear();
  }
  stores.clear();
}

/**
 * Get current stats for a limiter (useful for monitoring)
 */
export function getRateLimitStats(name: string): { activeEntries: number; totalRequests: number } {
  const store = stores.get(name);
  if (!store) {
    return { activeEntries: 0, totalRequests: 0 };
  }
  
  let totalRequests = 0;
  for (const entry of store.entries.values()) {
    totalRequests += entry.count;
  }
  
  return {
    activeEntries: store.entries.size,
    totalRequests
  };
}
