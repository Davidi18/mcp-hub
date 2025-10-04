// rate-limiter.js
// In-memory rate limiter (production: use Redis)

class RateLimiter {
  constructor() {
    this.limits = new Map();
    this.cleanup();
  }

  // Tool-specific limits (requests per hour)
  getToolLimit(toolName) {
    const expensive = {
      // DataForSEO expensive tools
      'dfs/serp_organic_live_advanced': 50,
      'dfs/serp_youtube_organic_live_advanced': 50,
      'dfs/backlinks_backlinks': 30,
      'dfs/dataforseo_labs_google_keyword_ideas': 100,
      // WordPress intensive operations
      'wp/wp_add_post': 20,
      'wp/wp_update_post': 50,
      'wp/wp_upload_media': 10
    };

    const moderate = {
      'dfs/keywords_data_google_ads_search_volume': 200,
      'wp/wp_posts_search': 500,
      'wp/wp_pages_search': 500
    };

    // Check exact match first
    if (expensive[toolName]) return expensive[toolName];
    if (moderate[toolName]) return moderate[toolName];

    // Check by prefix
    if (toolName.startsWith('dfs/')) return 500; // DataForSEO default
    if (toolName.startsWith('wp/')) return 1000; // WordPress default

    return 1000; // Global default
  }

  // Get client-wide limit (total requests per hour)
  getClientLimit() {
    return 5000; // Per client total limit
  }

  // Check if request is allowed
  checkLimit(clientId, toolName) {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1 hour in ms

    // Client-wide limit key
    const clientKey = `client:${clientId}`;
    
    // Tool-specific limit key
    const toolKey = `tool:${clientId}:${toolName}`;

    // Clean old entries
    this.cleanupKey(clientKey, hourAgo);
    this.cleanupKey(toolKey, hourAgo);

    // Get current counts
    const clientRequests = this.limits.get(clientKey) || [];
    const toolRequests = this.limits.get(toolKey) || [];

    // Check limits
    const clientLimit = this.getClientLimit();
    const toolLimit = this.getToolLimit(toolName);

    if (clientRequests.length >= clientLimit) {
      return {
        allowed: false,
        reason: 'client_limit_exceeded',
        limit: clientLimit,
        current: clientRequests.length,
        resetAt: new Date(clientRequests[0] + 3600000),
        retryAfter: Math.ceil((clientRequests[0] + 3600000 - now) / 1000)
      };
    }

    if (toolRequests.length >= toolLimit) {
      return {
        allowed: false,
        reason: 'tool_limit_exceeded',
        tool: toolName,
        limit: toolLimit,
        current: toolRequests.length,
        resetAt: new Date(toolRequests[0] + 3600000),
        retryAfter: Math.ceil((toolRequests[0] + 3600000 - now) / 1000)
      };
    }

    // Record this request
    clientRequests.push(now);
    toolRequests.push(now);
    this.limits.set(clientKey, clientRequests);
    this.limits.set(toolKey, toolRequests);

    return {
      allowed: true,
      clientLimit,
      clientRemaining: clientLimit - clientRequests.length,
      toolLimit,
      toolRemaining: toolLimit - toolRequests.length,
      resetAt: new Date(now + 3600000)
    };
  }

  // Clean up old entries for a specific key
  cleanupKey(key, cutoff) {
    const requests = this.limits.get(key) || [];
    const filtered = requests.filter(timestamp => timestamp > cutoff);
    
    if (filtered.length === 0) {
      this.limits.delete(key);
    } else {
      this.limits.set(key, filtered);
    }
  }

  // Periodic cleanup of all old entries
  cleanup() {
    setInterval(() => {
      const hourAgo = Date.now() - 3600000;
      for (const [key, requests] of this.limits.entries()) {
        const filtered = requests.filter(timestamp => timestamp > hourAgo);
        if (filtered.length === 0) {
          this.limits.delete(key);
        } else {
          this.limits.set(key, filtered);
        }
      }
    }, 300000); // Cleanup every 5 minutes
  }

  // Get current stats for a client
  getStats(clientId) {
    const now = Date.now();
    const hourAgo = now - 3600000;
    
    const clientKey = `client:${clientId}`;
    const clientRequests = (this.limits.get(clientKey) || [])
      .filter(t => t > hourAgo);

    // Get per-tool breakdown
    const toolBreakdown = {};
    for (const [key, requests] of this.limits.entries()) {
      if (key.startsWith(`tool:${clientId}:`)) {
        const toolName = key.split(':')[2];
        const recentRequests = requests.filter(t => t > hourAgo);
        if (recentRequests.length > 0) {
          toolBreakdown[toolName] = {
            count: recentRequests.length,
            limit: this.getToolLimit(toolName),
            remaining: this.getToolLimit(toolName) - recentRequests.length
          };
        }
      }
    }

    return {
      clientId,
      totalRequests: clientRequests.length,
      clientLimit: this.getClientLimit(),
      clientRemaining: this.getClientLimit() - clientRequests.length,
      toolBreakdown,
      windowStart: new Date(hourAgo),
      windowEnd: new Date(now + 3600000)
    };
  }
}

export default RateLimiter;
