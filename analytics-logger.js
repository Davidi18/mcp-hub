// analytics-logger.js
// Structured logging and analytics tracking

class AnalyticsLogger {
  constructor() {
    this.metrics = {
      requests: [],
      errors: [],
      performance: []
    };
    
    // Keep last 1000 requests in memory
    this.maxStoredRequests = 1000;
    
    // Start periodic reporting
    this.startReporting();
  }

  // Log levels
  levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  currentLevel = this.levels.INFO;

  // Structured log entry
  log(level, message, metadata = {}) {
    if (this.levels[level] < this.currentLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata
    };

    // Console output with color
    const colors = {
      DEBUG: '\x1b[36m',  // Cyan
      INFO: '\x1b[32m',   // Green
      WARN: '\x1b[33m',   // Yellow
      ERROR: '\x1b[31m'   // Red
    };
    const reset = '\x1b[0m';

    const icon = {
      DEBUG: '🔍',
      INFO: '📘',
      WARN: '⚠️',
      ERROR: '❌'
    };

    console.log(
      `${colors[level]}${icon[level]} [${entry.timestamp}] ${level}${reset}`,
      message,
      Object.keys(metadata).length > 0 ? JSON.stringify(metadata, null, 2) : ''
    );

    return entry;
  }

  // Track request
  trackRequest(data) {
    const request = {
      timestamp: Date.now(),
      ...data
    };

    this.metrics.requests.push(request);

    // Keep only recent requests
    if (this.metrics.requests.length > this.maxStoredRequests) {
      this.metrics.requests.shift();
    }

    this.log('INFO', `${data.method || 'REQUEST'}`, {
      clientId: data.clientId,
      toolName: data.toolName,
      duration: data.duration,
      cached: data.cached,
      rateLimited: data.rateLimited
    });

    return request;
  }

  // Track error
  trackError(error, context = {}) {
    const errorEntry = {
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      ...context
    };

    this.metrics.errors.push(errorEntry);

    // Keep only last 500 errors
    if (this.metrics.errors.length > 500) {
      this.metrics.errors.shift();
    }

    this.log('ERROR', error.message || String(error), {
      ...context,
      stack: error.stack
    });

    return errorEntry;
  }

  // Track performance
  trackPerformance(operation, duration, metadata = {}) {
    const perfEntry = {
      timestamp: Date.now(),
      operation,
      duration,
      ...metadata
    };

    this.metrics.performance.push(perfEntry);

    // Keep only last 1000 entries
    if (this.metrics.performance.length > 1000) {
      this.metrics.performance.shift();
    }

    if (duration > 5000) {
      this.log('WARN', `Slow operation: ${operation}`, {
        duration: `${duration}ms`,
        ...metadata
      });
    }

    return perfEntry;
  }

  // Get analytics for time window
  getAnalytics(minutes = 60) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    const recentRequests = this.metrics.requests.filter(r => r.timestamp > cutoff);
    const recentErrors = this.metrics.errors.filter(e => e.timestamp > cutoff);
    const recentPerf = this.metrics.performance.filter(p => p.timestamp > cutoff);

    // Calculate stats
    const totalRequests = recentRequests.length;
    const cachedRequests = recentRequests.filter(r => r.cached).length;
    const rateLimitedRequests = recentRequests.filter(r => r.rateLimited).length;
    const errorCount = recentErrors.length;

    // Per-client breakdown
    const clientStats = {};
    for (const req of recentRequests) {
      if (!clientStats[req.clientId]) {
        clientStats[req.clientId] = {
          total: 0,
          cached: 0,
          rateLimited: 0,
          tools: {}
        };
      }
      
      clientStats[req.clientId].total++;
      if (req.cached) clientStats[req.clientId].cached++;
      if (req.rateLimited) clientStats[req.clientId].rateLimited++;
      
      if (req.toolName) {
        clientStats[req.clientId].tools[req.toolName] = 
          (clientStats[req.clientId].tools[req.toolName] || 0) + 1;
      }
    }

    // Top tools
    const toolCounts = {};
    for (const req of recentRequests) {
      if (req.toolName) {
        toolCounts[req.toolName] = (toolCounts[req.toolName] || 0) + 1;
      }
    }
    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count }));

    // Performance stats
    const durations = recentRequests.filter(r => r.duration).map(r => r.duration);
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    // Error breakdown
    const errorsByType = {};
    for (const err of recentErrors) {
      const type = err.type || 'unknown';
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    }

    return {
      timeWindow: `${minutes} minutes`,
      summary: {
        totalRequests,
        cachedRequests,
        cacheHitRate: totalRequests > 0 ? (cachedRequests / totalRequests * 100).toFixed(1) + '%' : '0%',
        rateLimitedRequests,
        errorCount,
        errorRate: totalRequests > 0 ? (errorCount / totalRequests * 100).toFixed(1) + '%' : '0%',
        avgDuration: `${avgDuration}ms`,
        maxDuration: `${maxDuration}ms`
      },
      clients: clientStats,
      topTools,
      errorsByType,
      performance: {
        avgDuration,
        maxDuration,
        p95: this.calculatePercentile(durations, 95),
        p99: this.calculatePercentile(durations, 99)
      }
    };
  }

  // Calculate percentile
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    return Math.round(sorted[index] || 0);
  }

  // Get recent errors
  getRecentErrors(limit = 20) {
    return this.metrics.errors
      .slice(-limit)
      .reverse()
      .map(e => ({
        timestamp: new Date(e.timestamp).toISOString(),
        message: e.message,
        clientId: e.clientId,
        toolName: e.toolName,
        type: e.type
      }));
  }

  // Get slow operations
  getSlowOperations(thresholdMs = 3000, limit = 20) {
    return this.metrics.performance
      .filter(p => p.duration > thresholdMs)
      .slice(-limit)
      .reverse()
      .map(p => ({
        timestamp: new Date(p.timestamp).toISOString(),
        operation: p.operation,
        duration: `${p.duration}ms`,
        clientId: p.clientId,
        toolName: p.toolName
      }));
  }

  // Periodic reporting (every 10 minutes)
  startReporting() {
    setInterval(() => {
      const stats = this.getAnalytics(10);
      
      this.log('INFO', '📊 10-Minute Analytics Report', {
        requests: stats.summary.totalRequests,
        cacheHitRate: stats.summary.cacheHitRate,
        errors: stats.summary.errorCount,
        avgDuration: stats.summary.avgDuration,
        topTool: stats.topTools[0]?.tool || 'none'
      });
    }, 600000); // Every 10 minutes
  }

  // Export metrics for external monitoring
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      analytics: this.getAnalytics(60),
      recentErrors: this.getRecentErrors(10),
      slowOperations: this.getSlowOperations(3000, 10)
    };
  }
}

export default AnalyticsLogger;
