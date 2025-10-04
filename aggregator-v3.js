// aggregator-v3.js
// MCP Hub with Rate Limiting, Smart Caching, and Analytics

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

logger.log('INFO', 'MCP Hub v3.0 starting up', {
  port: PORT,
  authEnabled: !!PROXY_TOKEN
});

// Build client mapping
function buildClientMapping() {
  const mapping = {};
  const reverseMapping = {};
  
  for (let i = 1; i <= 15; i++) {
    const wpUrl = process.env[`WP${i}_URL`];
    if (wpUrl) {
      const clientName = process.env[`CLIENT${i}_NAME`];
      
      if (clientName) {
        const normalizedName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        mapping[normalizedName] = i.toString();
        reverseMapping[i.toString()] = normalizedName;
        logger.log('INFO', `Client ${i} registered`, {
          name: clientName,
          endpoint: `/${normalizedName}/mcp`,
          wpUrl
        });
      } else {
        mapping[`client${i}`] = i.toString();
        reverseMapping[i.toString()] = `client${i}`;
        logger.log('INFO', `Client ${i} registered (default name)`, {
          endpoint: `/client${i}/mcp`,
          wpUrl
        });
      }
    }
  }
  
  return { mapping, reverseMapping };
}

const { mapping: clientMapping, reverseMapping } = buildClientMapping();

function authOk(req) {
  const hdr = req.headers['authorization'];
  return PROXY_TOKEN ? hdr === PROXY_TOKEN : true;
}

function clientFromPath(pathname) {
  const companyMatch = pathname.match(/^\/([a-z0-9-]+)\/mcp$/);
  if (companyMatch) {
    const companyName = companyMatch[1];
    const clientNumber = clientMapping[companyName];
    if (clientNumber) {
      return clientNumber;
    }
  }
  
  const numberMatch = pathname.match(/^\/client(\d{1,2})\/mcp$/);
  return numberMatch ? numberMatch[1] : null;
}

async function rpc(upstreamUrl, body, clientN) {
  const startTime = Date.now();
  const urlWithClient = clientN ? `${upstreamUrl}?client=${clientN}` : upstreamUrl;
  
  try {
    const res = await fetch(urlWithClient, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'User-Agent': 'MCP-Hub/3.0',
        'X-Client-Number': clientN || '1'
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      throw new Error(`Upstream HTTP ${res.status}`);
    }
    
    const duration = Date.now() - startTime;
    logger.trackPerformance('upstream_rpc', duration, {
      upstreamUrl,
      clientN,
      method: body.method
    });
    
    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonData = line.substring(6);
          try {
            return JSON.parse(jsonData);
          } catch (e) {
            continue;
          }
        }
      }
      
      throw new Error('No valid JSON data found in SSE response');
    }
    
    return await res.json();
  } catch (error) {
    logger.trackError(error, {
      operation: 'upstream_rpc',
      upstreamUrl,
      clientN,
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

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  const requestStart = Date.now();
  
  try {
    const { pathname } = new URL(req.url, 'http://x');
    
    if (pathname === '/health') {
      const health = {
        status: 'healthy',
        version: '3.0.0',
        uptime: process.uptime(),
        clients: Object.keys(clientMapping).length,
        endpoints: Object.keys(clientMapping).map(name => `/${name}/mcp`),
        features: {
          rateLimiting: true,
          caching: true,
          analytics: true,
          sse: true
        },
        stats: {
          cache: cacheManager.getStats(),
          analytics: logger.getAnalytics(10)
        }
      };
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(health, null, 2));
    }
    
    if (pathname === '/analytics') {
      if (!authOk(req)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized'}));
      }
      
      const minutes = parseInt(new URL(req.url, 'http://x').searchParams.get('minutes') || '60');
      const analytics = logger.getAnalytics(minutes);
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(analytics, null, 2));
    }
    
    if (pathname.match(/^\/([a-z0-9-]+)\/stats$/)) {
      if (!authOk(req)) {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({error:'unauthorized'}));
      }
      
      const clientName = pathname.match(/^\/([a-z0-9-]+)\/stats$/)[1];
      const clientN = clientMapping[clientName] || clientName.replace('client', '');
      
      const stats = {
        rateLimit: rateLimiter.getStats(clientN),
        cache: cacheManager.getStats(clientN),
        analytics: logger.getAnalytics(60)
      };
      
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(stats, null, 2));
    }
    
    if (pathname === '/' || pathname === '/docs') {
      res.writeHead(200, {'Content-Type':'text/html'});
      return res.end(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>MCP Hub v3.0</title>
          <style>
            body { font-family: system-ui; max-width: 900px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            .feature { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .endpoint { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 8px; background: #10b981; color: white; }
          </style>
        </head>
        <body>
          <h1>MCP Hub v3.0 <span class="badge">NEW</span></h1>
          <div class="feature">
            <h2>New Features</h2>
            <ul>
              <li>Rate Limiting: Per-client and per-tool limits</li>
              <li>Smart Caching: Saves up to 80% on DataForSEO costs</li>
              <li>Analytics: Real-time usage tracking</li>
              <li>Structured Logging: Beautiful, searchable logs</li>
            </ul>
          </div>
          <div class="endpoint">
            <h2>Endpoints</h2>
            <ul>
              ${Object.keys(clientMapping).map(name => `<li><code>/${name}/mcp</code></li>`).join('')}
            </ul>
          </div>
          <div class="endpoint">
            <h3>GET /health</h3>
            <p>Health check with stats</p>
          </div>
          <div class="endpoint">
            <h3>GET /analytics?minutes=60</h3>
            <p>Analytics (requires auth)</p>
          </div>
        </body>
        </html>
      `);
    }
    
    const clientN = clientFromPath(pathname);
    
    if (!clientN) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'not_found', 
        availableClients: Object.keys(clientMapping)
      }));
    }
    
    if (!authOk(req)) {
      logger.trackRequest({
        clientId: clientN,
        method: 'AUTH_FAILED',
        duration: Date.now() - requestStart,
        success: false
      });
      
      res.writeHead(401, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({error:'unauthorized'}));
    }
    
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    const method = body?.method;
    
    logger.log('DEBUG', `Request: ${method}`, { clientId: clientN, tool: body?.params?.name });
    
    const wantsSSE = (req.headers['accept'] || '').includes('text/event-stream');
    
    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: body.id || '1',
        result: {
          protocolVersion: MCP_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: `MCP Hub v3 - ${reverseMapping[clientN] || `Client ${clientN}`}`,
            version: '3.0.0',
            description: 'WordPress + DataForSEO with Rate Limiting, Caching & Analytics'
          }
        }
      };
      
      logger.trackRequest({ clientId: clientN, method: 'initialize', duration: Date.now() - requestStart, success: true });
      
      if (wantsSSE) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        sendSSE(res, response);
        return res.end();
      }
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(response));
    }
    
    if (method === 'tools/list') {
      const [wpList, dfsList] = await Promise.all([
        rpc(`http://127.0.0.1:9091/mcp`, body, clientN),
        rpc(`http://127.0.0.1:9092/mcp`, body, clientN)
      ]);
      
      const merged = mergeTools(wpList, dfsList);
      logger.trackRequest({ clientId: clientN, method: 'tools/list', duration: Date.now() - requestStart, success: true });
      
      if (wantsSSE) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        sendSSE(res, merged);
        return res.end();
      }
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(merged));
    }
    
    if (method === 'tools/call') {
      const toolName = body?.params?.name;
      const toolArgs = body?.params?.arguments || {};
      
      const rateLimitResult = rateLimiter.checkLimit(clientN, toolName);
      
      if (!rateLimitResult.allowed) {
        logger.trackRequest({ clientId: clientN, method: 'tools/call', toolName, duration: Date.now() - requestStart, success: false, rateLimited: true });
        
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
      
      const cached = cacheManager.get(clientN, toolName, toolArgs);
      
      if (cached) {
        logger.trackRequest({ clientId: clientN, method: 'tools/call', toolName, duration: Date.now() - requestStart, success: true, cached: true });
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-RateLimit-Remaining': rateLimitResult.clientRemaining
        });
        
        return res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: cached.data }));
      }
      
      const { url, rewritten } = chooseUpstreamByTool(toolName);
      const forwardBody = { ...body, params: { ...body.params, name: rewritten } };
      const out = await rpc(url, forwardBody, clientN);
      
      cacheManager.set(clientN, toolName, toolArgs, out.result);
      logger.trackRequest({ clientId: clientN, method: 'tools/call', toolName, duration: Date.now() - requestStart, success: true, cached: false });
      
      if (wantsSSE) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'X-Cache': 'MISS' });
        sendSSE(res, out);
        return res.end();
      }
      
      res.writeHead(200, { 'Content-Type':'application/json', 'X-Cache': 'MISS' });
      return res.end(JSON.stringify(out));
    }
    
    const out = await rpc(`http://127.0.0.1:9091/mcp`, body, clientN);
    logger.trackRequest({ clientId: clientN, method: method || 'unknown', duration: Date.now() - requestStart, success: true });
    
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify(out));
    
  } catch (e) {
    logger.trackError(e, { pathname: req.url });
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String(e?.message || e) } }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  logger.log('INFO', `MCP Hub v3.0 listening on :${PORT}`, {
    clients: Object.keys(clientMapping).length,
    features: ['rate-limiting', 'caching', 'analytics']
  });
});

process.on('SIGTERM', () => {
  logger.log('WARN', 'Shutting down gracefully...');
  server.close(() => process.exit(0));
});
