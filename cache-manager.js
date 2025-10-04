// cache-manager.js
// Smart caching with TTL and cost optimization

import crypto from 'crypto';

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
      evictions: 0
    };
    this.cleanup();
  }

  // Tool-specific cache TTL (in seconds)
  getTTL(toolName) {
    const cachePolicies = {
      // DataForSEO - expensive, cache aggressively
      'dfs/serp_organic_live_advanced': 3600,        // 1 hour
      'dfs/serp_youtube_organic_live_advanced': 3600, // 1 hour
      'dfs/backlinks_backlinks': 86400,               // 24 hours
      'dfs/backlinks_summary': 86400,                 // 24 hours
      'dfs/keywords_data_google_ads_search_volume': 86400, // 24 hours
      'dfs/dataforseo_labs_google_keyword_ideas': 86400,   // 24 hours
      'dfs/domain_analytics_whois_overview': 604800,       // 7 days
      
      // WordPress - moderate caching
      'wp/wp_posts_search': 300,      // 5 minutes
      'wp/wp_pages_search': 300,      // 5 minutes
      'wp/get_site_info': 1800,       // 30 minutes
      'wp/wp_list_categories': 3600,  // 1 hour
      'wp/wp_list_tags': 3600,        // 1 hour
      'wp/wp_list_media': 300,        // 5 minutes
      'wp/wp_get_post': 600,          // 10 minutes
      'wp/wp_get_page': 600,          // 10 minutes
      
      // No cache for write operations
      'wp/wp_add_post': 0,
      'wp/wp_update_post': 0,
      'wp/wp_add_page': 0,
      'wp/wp_update_page': 0,
      'wp/wp_upload_media': 0
    };

    // Exact match
    if (cachePolicies[toolName] !== undefined) {
      return cachePolicies[toolName];
    }

    // Prefix-based defaults
    if (toolName.startsWith('dfs/')) return 3600;  // 1 hour for DataForSEO
    if (toolName.startsWith('wp/wp_get_')) return 600; // 10 min for WordPress reads
    if (toolName.startsWith('wp/wp_list_')) return 1800; // 30 min for WordPress lists
    if (toolName.startsWith('wp/wp_add_') || 
        toolName.startsWith('wp/wp_update_') ||
        toolName.startsWith('wp/wp_delete_')) return 0; // No cache for writes

    return 300; // Default: 5 minutes
  }

  // Generate cache key from tool name and arguments
  getCacheKey(clientId, toolName, args) {
    const normalized = JSON.stringify(args || {}, Object.keys(args || {}).sort());
    const hash = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
    return `${clientId}:${toolName}:${hash}`;
  }

  // Check if result is in cache
  get(clientId, toolName, args) {
    const ttl = this.getTTL(toolName);
    
    // No caching for this tool
    if (ttl === 0) {
      return null;
    }

    const key = this.getCacheKey(clientId, toolName, args);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    this.stats.hits++;
    
    return {
      data: entry.data,
      cached: true,
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
      ttl: Math.floor((entry.expiresAt - Date.now()) / 1000),
      source: 'cache'
    };
  }

  // Store result in cache
  set(clientId, toolName, args, data) {
    const ttl = this.getTTL(toolName);
    
    // No caching for this tool
    if (ttl === 0) {
      return false;
    }

    const key = this.getCacheKey(clientId, toolName, args);
    const now = Date.now();

    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + (ttl * 1000),
      clientId,
      toolName,
      size: JSON.stringify(data).length
    });

    this.stats.saves++;
    return true;
  }

  // Invalidate cache for specific tool
  invalidate(clientId, toolName) {
    let count = 0;
    const prefix = `${clientId}:${toolName}:`;
    
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.evictions += count;
    return count;
  }

  // Invalidate all cache for a client
  invalidateClient(clientId) {
    let count = 0;
    const prefix = `${clientId}:`;
    
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.evictions += count;
    return count;
  }

  // Periodic cleanup of expired entries
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.stats.evictions += cleaned;
      }
    }, 60000); // Cleanup every minute
  }

  // Get cache statistics
  getStats(clientId = null) {
    const stats = {
      global: {
        ...this.stats,
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
        totalEntries: this.cache.size
      }
    };

    if (clientId) {
      const prefix = `${clientId}:`;
      let entries = 0;
      let totalSize = 0;
      const toolCounts = {};

      for (const [key, entry] of this.cache.entries()) {
        if (key.startsWith(prefix)) {
          entries++;
          totalSize += entry.size;
          toolCounts[entry.toolName] = (toolCounts[entry.toolName] || 0) + 1;
        }
      }

      stats.client = {
        clientId,
        entries,
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        toolBreakdown: toolCounts
      };
    }

    return stats;
  }

  // Get cache info for debugging
  inspect() {
    const entries = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        clientId: entry.clientId,
        toolName: entry.toolName,
        size: entry.size,
        cachedAt: new Date(entry.cachedAt),
        expiresAt: new Date(entry.expiresAt),
        ttlRemaining: Math.max(0, Math.floor((entry.expiresAt - now) / 1000)),
        expired: now > entry.expiresAt
      });
    }

    return {
      stats: this.getStats(),
      entries: entries.sort((a, b) => b.size - a.size).slice(0, 50) // Top 50 by size
    };
  }
}

export default CacheManager;
