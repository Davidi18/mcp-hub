// MCP Hub - WordPress Aggregator (Universal Mode)
// Works directly with each WordPress REST API via ENV credentials

import http from 'http';
import { URL } from 'url';
import RateLimiter from './rate-limiter.js';
import CacheManager from './cache-manager.js';
import AnalyticsLogger from './analytics-logger.js';
import { Buffer } from 'buffer';

const PORT = 9090;
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.PROXY_TOKEN || '';
const MCP_VERSION = '2025-03-01';

// Initialize modules
const rateLimiter = new RateLimiter();
const cacheManager = new CacheManager();
const logger = new AnalyticsLogger();

logger.log('INFO', 'MCP Hub starting (WordPress Universal Mode)', {
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
      clients[normalizedName] = { id: i.toString(), name: clientName, wpUrl, wpUser, wpPass };
      clients[i.toString()] = clients[normalizedName];
      logger.log('INFO', `Client registered: ${clientName}`, { id: normalizedName, wpUrl });
    }
  }
  return clients;
}

const clients = buildClientMapping();

// Helpers
function getClientId(req, url) {
  return (
    req.headers['x-client-id']?.toLowerCase() ||
    req.headers['x-client']?.toLowerCase() ||
    url.searchParams.get('client')?.toLowerCase() ||
    null
  );
}

function authOk(req, url) {
  if (!AUTH_TOKEN) return true;
  const hdr = req.headers['authorization'];
  const queryToken = url.searchParams.get('token');
  return hdr === AUTH_TOKEN || hdr === `Bearer ${AUTH_TOKEN}` || queryToken === AUTH_TOKEN;
}

// ✅ Updated RPC — supports direct WordPress REST API calls
async function rpc(client, body) {
  const startTime = Date.now();
  const method = body.method || '';
  const params = body.params || {};
  const toolName = params.name;
  const args = params.arguments || {};
  const auth = 'Basic ' + Buffer.from(`${client.wpUser}:${client.wpPass}`).toString('base64');

  // tools/list returns available WordPress tools
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: body.id,
      result: {
        tools: [
          { name: 'wp_create_post', description: 'Create a new WordPress post' },
          { name: 'wp_upload_media', description: 'Upload media to WordPress' },
          { name: 'wp_update_post', description: 'Update an existing post' }
        ]
      }
    };
  }

  // tools/call executes WordPress REST API actions
  if (method === 'tools/call') {
    try {
      if (toolName === 'wp_create_post') {
        const data = args[0] || {};
        const res = await fetch(`${client.wpUrl}/wp-json/wp/v2/posts`, {
          method: 'POST',
          headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        return { jsonrpc: '2.0', id: body.id, result: json };
      }

      if (toolName === 'wp_upload_media') {
        const { filename, mimeType, base64data } = args[0] || {};
        const buffer = Buffer.from(base64data, 'base64');
        const res = await fetch(`${client.wpUrl}/wp-json/wp/v2/media`, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': mimeType || 'image/jpeg'
          },
          body: buffer
        });
        const json = await res.json();
        return { jsonrpc: '2.0', id: body.id, result: json };
      }

      if (toolName === 'wp_update_post') {
        const { id, data } = args[0] || {};
        const res = await fetch(`${client.wpUrl}/wp-json/wp/v2/posts/${id}`, {
          method: 'POST',
          headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        return { jsonrpc: '2.0', id: body.id, result: json };
      }

      throw new Error(`Unknown tool: ${toolName}`);
    } catch (error) {
      logger.log('ERROR', `WordPress API failed: ${error.message}`, { client: client.name, toolName });
      throw error;
    }
  }

  // Default: unknown
  throw new Error(`Unknown method: ${method}`);
}

// Main server
const server = http.createServer(async (req, res) => {
  const requestStart = Date.now();
  try {
    const url = new URL(req.url, 'http://x');
    const { pathname } = url;

    if (pathname === '/health') {
      return res.end(JSON.stringify({ status: 'ok', clients: Object.keys(clients).length }));
    }

    if (pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'not_found', message: 'Use POST /mcp?client=NAME' }));
    }

    if (!authOk(req, url)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unauthorized' }));
    }

    const clientId = getClientId(req, url);
    const client = clients[clientId];
    if (!client) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unknown_client', available: Object.keys(clients) }));
    }

    let body = {};
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'invalid_json' }));
    }

    const result = await rpc(client, body);
    logger.trackRequest({ clientId, method: body.method, duration: Date.now() - requestStart, success: true });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    logger.trackError(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: err.message } }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  logger.log('INFO', `✅ MCP Hub (Universal Mode) listening on port ${PORT}`, {
    clients: Object.keys(clients).filter(k => !k.match(/^\d+$/))
  });
});

process.on('SIGTERM', () => {
  logger.log('WARN', 'Shutting down gracefully...');
  server.close(() => process.exit(0));
});
