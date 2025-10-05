// MCP Hub - WordPress Aggregator
// Routes to the correct WordPress MCP based on client ID

import http from 'http';
import { URL } from 'url';
import RateLimiter from './rate-limiter.js';
import CacheManager from './cache-manager.js';
import AnalyticsLogger from './analytics-logger.js';

const PORT = 9090;
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.PROXY_TOKEN || '';
const MCP_VERSION = '2025-03-01';

// Initialize modules
const rateLimiter = new RateLimiter();
const cacheManager = new CacheManager();
const logger = new AnalyticsLogger();

logger.log('INFO', 'MCP Hub starting (WordPress)', {
  port: PORT,
  authEnabled: !!AUTH_TOKEN
});

// Build client mapping from environment variables
function buildClientMapping() {
  const clients = {};
  
  for (let i = 1; i <= 15; i++) {
    const wpUrl = process.env[`WP${i}_URL`];
    const wpUser = process.env[`WP${i}_USER`];
    const wpPass = process.env[`WP${i}_APP_PASS`];
    
    if (wpUrl && wpUser && wpPass) {
      const clientName = process.env[`CLIENT${i}_NAME`] || `client${i}`;
      const normalizedName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      const port = 9100 + i;
      
      clients[normalizedName] = {
        id: i.toString(),
        name: clientName,
        wpUrl,
        wpUser,
        wpPass,
        port  // Port where WordPress MCP is running
      };
      
      // Also map by number for backward compatibility
      clients[i.toString()] = clients[normalizedName];
      
      logger.log('INFO', `Client registered: ${clientName}`, {
        id: normalizedName,
        wpUrl,
        port
      });
    }
  }
  
  return clients;
}

const clients = buildClientMapping();

// Extract client ID from request (header or query parameter)
function getClientId(req, url) {
  const headerClient = req.headers['x-client-id'] || req.headers['x-client'];
  if (headerClient) {
    return headerClient.toLowerCase().trim();
  }
  
  const queryClient = url.searchParams.get('client');
  if (queryClient) {
    return queryClient.toLowerCase().trim();
  }
  
  const auth = req.headers['authorization'];
  if (auth && auth.includes(':')) {
    const clientPart = auth.split(':')[0].replace(/^Bearer\s+/i, '');
    return clientPart.toLowerCase().trim();
  }
  
  return null;
}

function authOk(req, url) {
  if (!AUTH_TOKEN) return true;
  
  // Check Authorization header
  const hdr = req.headers['authorization'];
  if (hdr === AUTH_TOKEN || hdr === `Bearer ${AUTH_TOKEN}`) {
    return true;
  }
  
  // Check token in query parameter
  const queryToken = url?.searchParams?.get('token');
  if (queryToken === AUTH_TOKEN) {
    return true;
  }
  
  return false;
}

async function rpc(client, body) {
  const startTime = Date.now();
  const url = `http://127.0.0.1:${client.port}/mcp`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json-rpc, application/json',        
        'Connection': 'keep-alive',
        'User-Agent': 'MCP-Hub/3.0'
      },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (!res.ok) {
      logger.log('ERROR', `WordPress MCP error ${res.status}`, {
        client: client.name,
        port: client.port,
        status: res.status,
        errorBody: text.substring(0, 200)
      });
      throw new Error(`WordPress MCP HTTP ${res.status}: ${text.substring(0, 100)}`);
    }

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      logger.log('ERROR', 'Failed to parse WordPress MCP response', {
        client: client.name,
        port: client.port,
        contentType,
        responsePreview: text.substring(0, 200)
      });
      throw new Error(`Invalid JSON response from WordPress MCP: ${text.substring(0, 100)}`);
    }

    const duration = Date.now() - startTime;
    logger.trackPerformance('wordpress_rpc', duration, {
      client: client.name,
      method: body.method
    });

    return data;
  } catch (error) {
    logger.trackError(error, {
      operation: 'wordpress_rpc',
      client: client.name,
      port: client.port,
      method: body.method
    });
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  const requestStart = Date.now();
  
  try {
    const url = new URL(req.url, 'http://x');
    const { pathname } = url;
    
    // Health check (always public)
    if (pathname === '/health') {
      const health = {
        status: 'healthy',
        version: '3.0.2',
        uptime: process.uptime(),
        endpoint: '/mcp',
        authentication: AUTH_TOKEN ? 'enabled' : 'disabled',
        clientIdentification: ['X-Client-ID header', 'client query parameter'],
        authMethods: AUTH_TOKEN ? ['Authorization header', 'token query parameter'] : ['none'],
        registeredClients: Object.keys(clients).filter(k => !k.match(/^\d+$/)),
        integration: 'WordPress',
        features: {
          rateLimiting: true,
          caching: true,
          analytics: true,
          multiClient: true
        },
        stats: {
          cache: cacheManager.getStats(),
          analytics: logger.getAnalytics(10)
        }
      };
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(health, null, 2));
    }
    
    // Debug upstreams (requires auth)
    if (pathname === '/debug/upstreams') {
      if (!authOk(req, url)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized', hint: 'Use ?token=YOUR-TOKEN'}));
      }
      
      const checks = {};
      
      for (const [key, client] of Object.entries(clients)) {
        if (key.match(/^\d+$/)) continue;
        
        try {
          const wpRes = await fetch(`http://127.0.0.1:${client.port}/health`, {
            signal: AbortSignal.timeout(5000)
          });
          const healthData = await wpRes.json();
          checks[key] = {
            status: wpRes.ok ? 'ok' : 'error',
            code: wpRes.status,
            port: client.port,
            wpUrl: client.wpUrl,
            health: healthData
          };
        } catch (e) {
          checks[key] = { 
            status: 'down', 
            error: e.message, 
            port: client.port,
            wpUrl: client.wpUrl
          };
        }
      }
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(checks, null, 2));
    }
    
    // Analytics (requires auth)
    if (pathname === '/analytics') {
      if (!authOk(req, url)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized', hint: 'Use ?token=YOUR-TOKEN'}));
      }
      
      const minutes = parseInt(url.searchParams.get('minutes') || '60');
      const analytics = logger.getAnalytics(minutes);
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(analytics, null, 2));
    }
    
    // Stats (requires auth)
    if (pathname === '/stats') {
      if (!authOk(req, url)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized', hint: 'Use ?token=YOUR-TOKEN'}));
      }
      
      const clientId = url.searchParams.get('client');
      
      const stats = {
        rateLimit: clientId ? rateLimiter.getStats(clientId) : rateLimiter.getStats(),
        cache: clientId ? cacheManager.getStats(clientId) : cacheManager.getStats(),
        analytics: logger.getAnalytics(60)
      };
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(stats, null, 2));
    }
    
    // Clients list (requires auth)
    if (pathname === '/clients') {
      if (!authOk(req, url)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized', hint: 'Use ?token=YOUR-TOKEN'}));
      }
      
      const clientList = Object.entries(clients)
        .filter(([key]) => !key.match(/^\d+$/))
        .map(([key, client]) => ({
          id: key,
          name: client.name,
          wpUrl: client.wpUrl,
          port: client.port
        }));
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ clients: clientList }, null, 2));
    }
    
    // Documentation (public)
    if (pathname === '/' || pathname === '/docs') {
      const clientList = Object.keys(clients).filter(k => !k.match(/^\d+$/)).join(', ');
      const authStatus = AUTH_TOKEN ? 'Required' : 'Open';
      
      res.writeHead(200, {'Content-Type':'text/html'});
      return res.end(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>MCP Hub - WordPress</title>
          <style>
            body { font-family: system-ui; max-width: 900px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; margin: 20px 0; border-radius: 12px; }
            .endpoint { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            code { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; }
            pre { background: #1e293b; color: #e2e8f0; padding: 20px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 8px; }
            .badge-green { background: #10b981; color: white; }
            .badge-red { background: #ef4444; color: white; }
            .badge-blue { background: #3b82f6; color: white; }
            h1 { margin: 0; }
            h2 { color: #1e293b; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="hero">
            <h1>MCP Hub <span class="badge badge-blue">WordPress</span></h1>
            <p style="font-size: 18px; margin: 10px 0 0 0;">Single endpoint, multiple WordPress sites.</p>
          </div>
          
          <div class="endpoint">
            <h2>📍 Main Endpoint <span class="badge ${AUTH_TOKEN ? 'badge-red' : 'badge-green'}">${authStatus}</span></h2>
            <code>POST /mcp</code>
            
            <h3>Usage (n8n):</h3>
            <pre>Endpoint: https://mcp.strudel.marketing/mcp?client=strudel${AUTH_TOKEN ? '&token=YOUR-TOKEN' : ''}
Server Transport: HTTP Streamable
Authentication: None
Tools to Include: All</pre>

            <h3>Usage (curl):</h3>
            <pre>curl -X POST "https://mcp.strudel.marketing/mcp?client=strudel${AUTH_TOKEN ? '&token=YOUR-TOKEN' : ''}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":"1"}'</pre>
          </div>
          
          <div class="endpoint">
            <h2>🔐 Registered Clients</h2>
            <p><code>${clientList}</code></p>
          </div>
          
          <div class="endpoint">
            <h2>🔍 Debug Endpoints</h2>
            <ul>
              <li><code>GET /health</code> - Hub health (public)</li>
              <li><code>GET /debug/upstreams${AUTH_TOKEN ? '?token=YOUR-TOKEN' : ''}</code> - Check WordPress MCPs</li>
              <li><code>GET /clients${AUTH_TOKEN ? '?token=YOUR-TOKEN' : ''}</code> - List clients</li>
              <li><code>GET /stats?client=NAME${AUTH_TOKEN ? '&token=YOUR-TOKEN' : ''}</code> - Statistics</li>
              <li><code>GET /analytics?minutes=60${AUTH_TOKEN ? '&token=YOUR-TOKEN' : ''}</code> - Analytics</li>
            </ul>
          </div>
        </body>
        </html>
      `);
    }
    
    // Main MCP endpoint
    if (pathname !== '/mcp') {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'not_found',
        message: 'Use POST /mcp with ?client=NAME parameter',
        hint: AUTH_TOKEN ? 'Also add &token=YOUR-TOKEN for authentication' : null,
        availableClients: Object.keys(clients).filter(k => !k.match(/^\d+$/))
      }));
    }
    
    // Check authentication for MCP endpoint
    if (!authOk(req, url)) {
      logger.trackRequest({
        clientId: 'unknown',
        method: 'AUTH_FAILED',
        duration: Date.now() - requestStart,
        success: false
      });
      
      res.writeHead(401, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error:'unauthorized',
        message: 'Authentication required',
        hint: 'Add &token=YOUR-TOKEN to the URL'
      }));
    }
    
    const clientId = getClientId(req, url);
    
    if (!clientId) {
      res.writeHead(400, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'missing_client',
        message: 'Client identification required',
        hint: 'Use ?client=NAME query parameter',
        example: `https://mcp.strudel.marketing/mcp?client=strudel${AUTH_TOKEN ? '&token=YOUR-TOKEN' : ''}`,
        availableClients: Object.keys(clients).filter(k => !k.match(/^\d+$/))
      }));
    }
    
    const client = clients[clientId];
    if (!client) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'unknown_client',
        message: `Client '${clientId}' not found`,
        availableClients: Object.keys(clients).filter(k => !k.match(/^\d+$/))
      }));
    }
    
    // Parse request body
    let body = {};
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    } catch (err) {
      logger.trackError(err, { context: 'body_parse' });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      return;
    }
    
    const method = body?.method || null;

    // Handle initialize
    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: body.id || '1',
        result: {
          protocolVersion: MCP_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: `MCP Hub - ${client.name}`,
            version: '3.0.2',
            description: 'WordPress MCP with Rate Limiting, Caching & Analytics'
          }
        }
      };
      
      logger.trackRequest({ clientId, method: 'initialize', duration: Date.now() - requestStart, success: true });
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(response));
    }
    
    // Handle tools/list
    if (method === 'tools/list') {
      try {
        const wpList = await rpc(client, body);
        logger.trackRequest({ clientId, method: 'tools/list', duration: Date.now() - requestStart, success: true });
        
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(wpList));
      } catch (error) {
        logger.log('ERROR', `tools/list failed: ${error.message}`, { clientId });
        res.writeHead(500, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32603, message: error.message }
        }));
      }
    }
    
    // Handle tools/call with rate limiting and caching
    if (method === 'tools/call') {
      const toolName = body?.params?.name || 'unknown';
      const toolArgs = body?.params?.arguments ?? {};
      const normalizedArgs = Array.isArray(toolArgs) ? toolArgs : [toolArgs];
    
      const rateLimitResult = rateLimiter.checkLimit(clientId, toolName);
      
      if (!rateLimitResult.allowed) {
        logger.trackRequest({ 
          clientId, 
          method: 'tools/call', 
          toolName, 
          duration: Date.now() - requestStart, 
          success: false, 
          rateLimited: true 
        });
        
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimitResult.limit,
          'Retry-After': rateLimitResult.retryAfter
        });
        
        return res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32000, message: `Rate limit exceeded: ${rateLimitResult.reason}` }
        }));
      }
      
      const cached = cacheManager.get(clientId, toolName, normalizedArgs);
      
      if (cached) {
        logger.trackRequest({ 
          clientId, 
          method: 'tools/call', 
          toolName, 
          duration: Date.now() - requestStart, 
          success: true, 
          cached: true 
        });
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-RateLimit-Remaining': rateLimitResult.clientRemaining
        });
        
        return res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: cached.data }));
      }
      
      try {
        const out = await rpc(client, body);
        
        if (out.result) {
          cacheManager.set(clientId, toolName, normalizedArgs, out.result);
        }
        
        logger.trackRequest({ 
          clientId, 
          method: 'tools/call', 
          toolName, 
          duration: Date.now() - requestStart, 
          success: true, 
          cached: false 
        });
        
        res.writeHead(200, { 
          'Content-Type':'application/json', 
          'X-Cache': 'MISS',
          'X-RateLimit-Remaining': rateLimitResult.clientRemaining
        });
        return res.end(JSON.stringify(out));
      } catch (error) {
        logger.log('ERROR', `tools/call failed: ${error.message}`, { clientId, toolName });
        res.writeHead(500, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32603, message: error.message }
        }));
      }
    }
    
    // Default: forward to WordPress
    try {
      const out = await rpc(client, body);
      logger.trackRequest({ clientId, method: method || 'unknown', duration: Date.now() - requestStart, success: true });
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(out));
    } catch (error) {
      logger.log('ERROR', `MCP request failed: ${error.message}`, { clientId, method });
      res.writeHead(500, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id || '1',
        error: { code: -32603, message: error.message }
      }));
    }
    
  } catch (e) {
    logger.trackError(e, { pathname: req.url });
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String(e?.message || e) } }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  logger.log('INFO', `MCP Hub listening on :${PORT}`, {
    endpoint: '/mcp',
    authEnabled: !!AUTH_TOKEN,
    clients: Object.keys(clients).filter(k => !k.match(/^\d+$/)).length,
    features: ['single-endpoint', 'unified-auth', 'rate-limiting', 'caching', 'analytics', 'query-token-auth']
  });
});

process.on('SIGTERM', () => {
  logger.log('WARN', 'Shutting down gracefully...');
  server.close(() => process.exit(0));
});
