/**
 * Search Result Caching System
 * 
 * In-memory LRU cache with automatic invalidation
 * for ride search results.
 */

// Cache configuration
const CACHE_CONFIG = {
  maxSize: 1000,           // Maximum cached entries
  defaultTTL: 60 * 1000,   // 60 seconds default TTL
  cleanupInterval: 30000,  // Cleanup every 30 seconds
  keyPrefix: "search:"
};

/**
 * LRU Cache implementation with TTL support
 */
class SearchCache {
  constructor(maxSize = CACHE_CONFIG.maxSize) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0
    };
    
    // Start cleanup interval
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CACHE_CONFIG.cleanupInterval);
  }

  /**
   * Generate cache key from search parameters
   */
  generateKey(params) {
    const { 
      pickupLat, pickupLng, dropLat, dropLng, 
      date, passengers, filters 
    } = params;
    
    // Round coordinates for key generation (allows nearby cache hits)
    const keyParts = [
      CACHE_CONFIG.keyPrefix,
      Math.round(pickupLat * 100) / 100,
      Math.round(pickupLng * 100) / 100,
      Math.round(dropLat * 100) / 100,
      Math.round(dropLng * 100) / 100,
      date || "any",
      passengers || 1,
      filters ? JSON.stringify(filters) : ""
    ];
    
    return keyParts.join(":");
  }

  /**
   * Get cached result
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set cached result
   */
  set(key, data, ttl = CACHE_CONFIG.defaultTTL) {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
    
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * Delete specific entry
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) this.stats.invalidations++;
    return deleted;
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.invalidations += count;
    return count;
  }

  /**
   * Invalidate entries by location proximity
   */
  invalidateByLocation(lat, lng, radiusKm = 5) {
    let count = 0;
    const latRounded = Math.round(lat * 100) / 100;
    const lngRounded = Math.round(lng * 100) / 100;
    
    for (const key of this.cache.keys()) {
      // Extract coordinates from key
      const parts = key.split(":");
      if (parts.length >= 5) {
        const keyLat = parseFloat(parts[1]);
        const keyLng = parseFloat(parts[2]);
        
        // Simple distance check
        const latDiff = Math.abs(keyLat - latRounded);
        const lngDiff = Math.abs(keyLng - lngRounded);
        
        // Approximate: 1 degree ≈ 111 km
        if (latDiff * 111 < radiusKm && lngDiff * 111 < radiusKm) {
          this.cache.delete(key);
          count++;
        }
      }
    }
    this.stats.invalidations += count;
    return count;
  }

  /**
   * Invalidate by date
   */
  invalidateByDate(date) {
    const dateStr = date instanceof Date ? 
      date.toISOString().split('T')[0] : 
      date;
    
    return this.invalidatePattern(`:${dateStr}:`);
  }

  /**
   * Clear all cache
   */
  clear() {
    const count = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += count;
    return count;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.stats.hits + this.stats.misses > 0 ?
        Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100) : 0
    };
  }

  /**
   * Destroy cache (cleanup timer)
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Singleton instance
let cacheInstance = null;

/**
 * Get or create cache instance
 */
function getCache() {
  if (!cacheInstance) {
    cacheInstance = new SearchCache();
  }
  return cacheInstance;
}

/**
 * Cache wrapper for search functions
 */
function withCache(searchFn, options = {}) {
  const { ttl, keyGenerator } = options;
  const cache = getCache();
  
  return async function cachedSearch(params) {
    const key = keyGenerator ? keyGenerator(params) : cache.generateKey(params);
    
    // Try cache first
    const cached = cache.get(key);
    if (cached) {
      return {
        ...cached,
        _cached: true,
        _cacheKey: key
      };
    }
    
    // Execute search
    const result = await searchFn(params);
    
    // Cache result
    cache.set(key, result, ttl);
    
    return {
      ...result,
      _cached: false,
      _cacheKey: key
    };
  };
}

/**
 * Invalidation hooks for ride events
 */
const invalidationHooks = {
  /**
   * Call when a new ride is created
   */
  onRideCreated(ride) {
    const cache = getCache();
    
    // Invalidate caches near the ride's origin
    if (ride.from?.location?.coordinates) {
      const [lng, lat] = ride.from.location.coordinates;
      cache.invalidateByLocation(lat, lng, 10);
    }
    
    // Invalidate by date
    if (ride.date) {
      cache.invalidateByDate(ride.date);
    }
  },
  
  /**
   * Call when a ride is cancelled
   */
  onRideCancelled(ride) {
    const cache = getCache();
    
    if (ride.from?.location?.coordinates) {
      const [lng, lat] = ride.from.location.coordinates;
      cache.invalidateByLocation(lat, lng, 10);
    }
    
    if (ride.date) {
      cache.invalidateByDate(ride.date);
    }
  },
  
  /**
   * Call when seats change (booking/cancellation)
   */
  onSeatsChanged(ride) {
    const cache = getCache();
    
    if (ride.from?.location?.coordinates) {
      const [lng, lat] = ride.from.location.coordinates;
      cache.invalidateByLocation(lat, lng, 5);
    }
  },
  
  /**
   * Clear all cache (emergency/admin)
   */
  clearAll() {
    return getCache().clear();
  }
};

/**
 * Express middleware for adding cache headers
 */
function cacheMiddleware(options = {}) {
  return (req, res, next) => {
    // Add cache info to response
    res.setCacheInfo = (result) => {
      if (result._cached) {
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', result._cacheKey);
      } else {
        res.set('X-Cache', 'MISS');
      }
    };
    
    next();
  };
}

/**
 * Get cache stats endpoint handler
 */
function getCacheStatsHandler(req, res) {
  const stats = getCache().getStats();
  res.json({
    cache: "SearchCache",
    ...stats
  });
}

module.exports = {
  SearchCache,
  getCache,
  withCache,
  invalidationHooks,
  cacheMiddleware,
  getCacheStatsHandler,
  CACHE_CONFIG
};
