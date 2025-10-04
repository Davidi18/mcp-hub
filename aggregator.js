// MCP Hub - Unified WordPress & DataForSEO Aggregator
// Single endpoint with client identification via header or query parameter

import http from 'http';
import { URL } from 'url';
import RateLimiter from './rate-limiter.js';
import CacheManager from './cache-manager.js';
import AnalyticsLogger from './analytics-logger.js';

const PORT = 9090;
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';
const MCP_VERSION = '2025-03-01';

// Initialize modules
const rateLimiter = new RateLimiter();
const cacheManager = new CacheManager();
const logger = new AnalyticsLogger();

logger.log('INFO', 'MCP Hub starting', {
  port: PORT,
  authEnabled: !!PROXY_TOKEN
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
      
      clients[normalizedName] = {
        id: i.toString(),
        name: clientName,
        wpUrl,
        wpUser,
        wpPass
      };
      
      // Also map by number for backward compatibility
      clients[i.toString()] = clients[normalizedName];
      
      logger.log('INFO', `Client registered: ${clientName}`, {
        id: normalizedName,
        wpUrl
      });
    }
  }
  
  return clients;
}

const clients = buildClientMapping();

// Extract client ID from request (header or query parameter)
function getClientId(req, url) {
  // Priority 1: X-Client-ID header
  const headerClient = req.headers['x-client-id'] || req.headers['x-client'];
  if (headerClient) {
    return headerClient.toLowerCase().trim();
  }
  
  // Priority 2: ?client= query parameter
  const queryClient = url.searchParams.get('client');
  if (queryClient) {
    return queryClient.toLowerCase().trim();
  }
  
  // Priority 3: Authorization header with client prefix (e.g., "Bearer client1:token")
  const auth = req.headers['authorization'];
  if (auth && auth.includes(':')) {
    const clientPart = auth.split(':')[0].replace(/^Bearer\s+/i, '');
    return clientPart.toLowerCase().trim();
  }
  
  return null;
}

function authOk(req) {
  const hdr = req.headers['authorization'];
  return PROXY_TOKEN ? hdr === PROXY_TOKEN || hdr === `Bearer ${PROXY_TOKEN}` : true;
}

async function rpc(upstreamUrl, body, clientId) {
  const startTime = Date.now();
  const client = clients[clientId];
  
  if (!client) {
    throw new Error(`Unknown client: ${clientId}`);
  }
  
  const urlWithClient = `${upstreamUrl}?client=${client.id}`;
  
  try {
    const res = await fetch(urlWithClient, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Hub',
        'X-Client-Number': client.id,
        'X-Client-Name': client.name
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      throw new Error(`Upstream HTTP ${res.status}`);
    }
    
    const duration = Date.now() - startTime;
    logger.trackPerformance('upstream_rpc', duration, {
      upstreamUrl,
      clientId,
      method: body.method
    });
    
    return await res.json();
  } catch (error) {
    logger.trackError(error, {
      operation: 'upstream_rpc',
      upstreamUrl,
      clientId,
      method: body.method
    });
    throw error;
  }
}

function mergeTools(wpList, dfsList) {
  const wpTools = (wpList.result?.tools || []).map(t => ({
    ...t, 
    name: `wp/${t.name}`,
    description: `[WordPress] ${t.description || t.name}`
  }));
  
  const dfsTools = (dfsList.result?.tools || []).map(t => ({
    ...t, 
    name: `dfs/${t.name}`,
    description: `[DataForSEO] ${t.description || t.name}`
  }));
  
  return { 
    jsonrpc: '2.0', 
    id: wpList.id ?? dfsList.id ?? '1', 
    result: { 
      tools: [...wpTools, ...dfsTools],
      _meta: {
        wpToolsCount: wpTools.length,
        dfsToolsCount: dfsTools.length,
        totalTools: wpTools.length + dfsTools.length
      }
    } 
  };
}

function chooseUpstreamByTool(name) {
  if (name?.startsWith('wp/')) {
    return { url: `http://127.0.0.1:9091/mcp`, rewritten: name.slice(3) };
  }
  if (name?.startsWith('dfs/')) {
    return { url: `http://127.0.0.1:9092/mcp`, rewritten: name.slice(4) };
  }
  return { url: `http://127.0.0.1:9091/mcp`, rewritten: name };
}

const server = http.createServer(async (req, res) => {
  const requestStart = Date.now();
  
  try {
    const url = new URL(req.url, 'http://x');
    const { pathname } = url;
    
    // Health check endpoint
    if (pathname === '/health') {
      const health = {
        status: 'healthy',
        version: '3.0.0',
        uptime: process.uptime(),
        endpoint: '/mcp',
        clientIdentification: ['X-Client-ID header', 'client query parameter'],
        registeredClients: Object.keys(clients).filter(k => !k.match(/^\d+$/)), // Only named clients
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
      
      res.writeHead(200, {'Content-Type':'application/json'})
      return res.end(JSON.stringify(health, null, 2));
    }
    
    // Analytics endpoint
    if (pathname === '/analytics') {
      if (!authOk(req)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized'}));
      }
      
      const minutes = parseInt(url.searchParams.get('minutes') || '60');
      const analytics = logger.getAnalytics(minutes);
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(analytics, null, 2));
    }
    
    // Stats endpoint with optional client filter
    if (pathname === '/stats') {
      if (!authOk(req)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized'}));
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
    
    // Clients list endpoint
    if (pathname === '/clients') {
      if (!authOk(req)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized'}));
      }
      
      const clientList = Object.entries(clients)
        .filter(([key]) => !key.match(/^\d+$/)) // Filter out numeric keys
        .map(([key, client]) => ({
          id: key,
          name: client.name,
          wpUrl: client.wpUrl
        }));
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ clients: clientList }, null, 2));
    }
    
    // Documentation page
    if (pathname === '/' || pathname === '/docs') {
      const clientList = Object.keys(clients).filter(k => !k.match(/^\d+$/)).join(', ');
      
      res.writeHead(200, {'Content-Type':'text/html'});
      return res.end(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>MCP Hub</title>
          <style>
            body { font-family: system-ui; max-width: 900px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; margin: 20px 0; border-radius: 12px; }
            .endpoint { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            code { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px; }
            pre { background: #1e293b; color: #e2e8f0; padding: 20px; border-radius: 8px; overflow-x: auto; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 8px; background: #10b981; color: white; }
            h1 { margin: 0; }
            h2 { color: #1e293b; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="hero">
            <h1>MCP Hub <span class="badge">Single Endpoint</span></h1>
            <p style="font-size: 18px; margin: 10px 0 0 0;">One endpoint, multiple clients. Secure, scalable, simple.</p>
          </div>
          
          <div class="endpoint">
            <h2>📍 Main Endpoint</h2>
            <code>POST /mcp</code>
            <p>Single unified endpoint for all MCP operations</p>
            
            <h3>Client Identification (choose one):</h3>
            
            <h4>Option 1: Header (Recommended)</h4>
            <pre>POST /mcp
X-Client-ID: strudel
Content-Type: application/json

{ "jsonrpc": "2.0", "method": "initialize", "id": "1" }</pre>
            
            <h4>Option 2: Query Parameter</h4>
            <pre>POST /mcp?client=strudel
Content-Type: application/json

{ "jsonrpc": "2.0", "method": "initialize", "id": "1" }</pre>
            
            <h4>Option 3: Combined Auth Header</h4>
            <pre>POST /mcp
Authorization: Bearer strudel:your-token-here
Content-Type: application/json

{ "jsonrpc": "2.0", "method": "initialize", "id": "1" }</pre>
          </div>
          
          <div class="endpoint">
            <h2>✨ Features</h2>
            <ul>
              <li>✅ Single endpoint - no per-client URLs</li>
              <li>✅ Flexible client identification (header/query/auth)</li>
              <li>✅ Rate Limiting per client</li>
              <li>✅ Smart Caching (saves 80% on DataForSEO costs)</li>
              <li>✅ Real-time Analytics</li>
              <li>✅ Multi-tenant support (up to 15 clients)</li>
            </ul>
          </div>
          
          <div class="endpoint">
            <h2>🔐 Registered Clients</h2>
            <p><code>${clientList}</code></p>
          </div>
          
          <div class="endpoint">
            <h2>📊 Management Endpoints</h2>
            <p><code>GET /health</code> - Health check with stats</p>
            <p><code>GET /clients</code> - List all registered clients (requires auth)</p>
            <p><code>GET /stats?client=strudel</code> - Per-client statistics (requires auth)</p>
            <p><code>GET /analytics?minutes=60</code> - Analytics dashboard (requires auth)</p>
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
        message: 'Use POST /mcp with X-Client-ID header or ?client= parameter',
        availableClients: Object.keys(clients).filter(k => !k.match(/^\d+$/))
      }));
    }
    
    // Extract client ID
    const clientId = getClientId(req, url);
    
    if (!clientId) {
      res.writeHead(400, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'missing_client',
        message: 'Client identification required. Use X-Client-ID header, ?client= parameter, or Authorization header',
        availableClients: Object.keys(clients).filter(k => !k.match(/^\d+$/))
      }));
    }
    
    if (!clients[clientId]) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'unknown_client',
        message: `Client '${clientId}' not found`,
        availableClients: Object.keys(clients).filter(k => !k.match(/^\d+$/))
      }));
    }
    
    // Check authorization
    if (!authOk(req)) {
      logger.trackRequest({
        clientId,
        method: 'AUTH_FAILED',
        duration: Date.now() - requestStart,
        success: false
      });
      
      res.writeHead(401, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({error:'unauthorized'}));
    }
    
    // Parse request body
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    const method = body?.method;
    
    logger.log('DEBUG', `Request: ${method}`, { clientId, tool: body?.params?.name });
    
    // Handle initialize
    if (method === 'initialize') {
      const client = clients[clientId];
      const response = {
        jsonrpc: '2.0',
        id: body.id || '1',
        result: {
          protocolVersion: MCP_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: `MCP Hub - ${client.name}`,
            version: '3.0.0',
            description: 'WordPress + DataForSEO with Rate Limiting, Caching & Analytics'
          }
        }
      };
      
      logger.trackRequest({ clientId, method: 'initialize', duration: Date.now() - requestStart, success: true });
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(response));
    }
    
    // Handle tools/list
    if (method === 'tools/list') {
      const [wpList, dfsList] = await Promise.all([
        rpc(`http://127.0.0.1:9091/mcp`, body, clientId),
        rpc(`http://127.0.0.1:9092/mcp`, body, clientId)
      ]);
      
      const merged = mergeTools(wpList, dfsList);
      logger.trackRequest({ clientId, method: 'tools/list', duration: Date.now() - requestStart, success: true });
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(merged));
    }
    
    // Handle tools/call with rate limiting and caching
    if (method === 'tools/call') {
      const toolName = body?.params?.name;
      const toolArgs = body?.params?.arguments || {};
      
      // Check rate limit
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
          error: { code: -32000, message: `Rate limit exceeded: ${rateLimitResult.reason}` }
        }));
      }
      
      // Check cache
      const cached = cacheManager.get(clientId, toolName, toolArgs);
      
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
      
      // Forward to upstream
      const { url, rewritten } = chooseUpstreamByTool(toolName);
      const forwardBody = { ...body, params: { ...body.params, name: rewritten } };
      const out = await rpc(url, forwardBody, clientId);
      
      // Cache the result
      cacheManager.set(clientId, toolName, toolArgs, out.result);
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
    }
    
    // Default: forward to WordPress
    const out = await rpc(`http://127.0.0.1:9091/mcp`, body, clientId);
    logger.trackRequest({ clientId, method: method || 'unknown', duration: Date.now() - requestStart, success: true });
    
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify(out));
    
  } catch (e) {
    logger.trackError(e, { pathname: req.url });
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String(e?.message || e) } }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  logger.log('INFO', `MCP Hub listening on :${PORT}`, {
    endpoint: '/mcp',
    clients: Object.keys(clients).filter(k => !k.match(/^\d+$/)).length,
    features: ['single-endpoint', 'rate-limiting', 'caching', 'analytics']
  });
});

process.on('SIGTERM', () => {
  logger.log('WARN', 'Shutting down gracefully...');
  server.close(() => process.exit(0));
});
