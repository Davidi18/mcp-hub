// MCP Hub - WordPress Aggregator (Direct REST Mode)
// מאוחד לכל הלקוחות, ללא צורך בתוסף MCP אצלם

import http from 'http';
import { URL } from 'url';
import FormData from 'form-data';
import RateLimiter from './rate-limiter.js';
import CacheManager from './cache-manager.js';
import AnalyticsLogger from './analytics-logger.js';

const PORT = 9090;
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.PROXY_TOKEN || '';
const MCP_VERSION = '2025-03-01';

const rateLimiter = new RateLimiter();
const cacheManager = new CacheManager();
const logger = new AnalyticsLogger();

logger.log('INFO', 'MCP Hub (Direct WordPress REST) starting...', {
  port: PORT,
  authEnabled: !!AUTH_TOKEN
});
if (!AUTH_TOKEN) logger.log('WARN', '⚠️ Running without AUTH_TOKEN protection');

// בונה מיפוי לקוחות מתוך משתני סביבה
function buildClientMapping() {
  const clients = {};
  for (let i = 1; i <= 20; i++) {
    const wpUrl = process.env[`WP${i}_URL`];
    const wpUser = process.env[`WP${i}_USER`];
    const wpPass = process.env[`WP${i}_APP_PASS`];
    const name = process.env[`CLIENT${i}_NAME`] || `client${i}`;

    if (wpUrl && wpUser && wpPass) {
      // שומר על אותיות קטנות בלבד, מאפשר נקודות
      const id = name.toLowerCase().replace(/[^a-z0-9.]/g, '-') || `client${i}`;
      clients[id] = { id, name, wpUrl, wpUser, wpPass };
      logger.log('INFO', `Registered client: ${name}`, { wpUrl });
    }
  }
  return clients;
}
const clients = buildClientMapping();

// אימות טוקן
function authOk(req, url) {
  if (!AUTH_TOKEN) return true;
  const hdr = (req.headers['authorization'] || '').trim();
  const queryToken = url?.searchParams?.get('token');
  return hdr === AUTH_TOKEN || hdr === `Bearer ${AUTH_TOKEN}` || queryToken === AUTH_TOKEN;
}

// השוואת לקוחות חכמה (תומכת גם בנקודות וגם במקפים)
function findClientById(rawId) {
  if (!rawId) return null;
  const normalized = rawId.toLowerCase().trim();
  const variants = [
    normalized,
    normalized.replace(/\./g, '-'),
    normalized.replace(/-/g, '.')
  ];
  return Object.values(clients).find(c =>
    variants.includes(c.id) ||
    variants.includes(c.name.toLowerCase())
  );
}

// קבלת Client ID מתוך query או header
function getClientId(req, url) {
  const fromHeader = req.headers['x-client-id'] || req.headers['x-client'];
  if (fromHeader) return fromHeader.toLowerCase().trim();
  const fromQuery = url.searchParams.get('client');
  if (fromQuery) return fromQuery.toLowerCase().trim();
  return null;
}

// מיפוי פעולות ל־REST endpoints
const endpointMap = {
  wp_create_post: { method: 'POST', path: '/wp-json/wp/v2/posts' },
  wp_update_post: { method: 'POST', path: (args) => `/wp-json/wp/v2/posts/${args.id}?_method=PUT` },
  wp_get_posts: { method: 'GET', path: '/wp-json/wp/v2/posts' },
  wp_delete_post: { method: 'DELETE', path: (args) => `/wp-json/wp/v2/posts/${args.id}?force=true` },
  wp_upload_media: { method: 'POST', path: '/wp-json/wp/v2/media' },
  wp_update_media: { method: 'POST', path: (args) => `/wp-json/wp/v2/media/${args.id}?_method=PUT` },
  wp_get_media: { method: 'GET', path: '/wp-json/wp/v2/media' },
  wp_create_category: { method: 'POST', path: '/wp-json/wp/v2/categories' },
  wp_get_categories: { method: 'GET', path: '/wp-json/wp/v2/categories' },
  wp_create_page: { method: 'POST', path: '/wp-json/wp/v2/pages' },
  wp_update_page: { method: 'POST', path: (args) => `/wp-json/wp/v2/pages/${args.id}?_method=PUT` },
  wp_get_pages: { method: 'GET', path: '/wp-json/wp/v2/pages' }
};

// פונקציית קריאה ל־WordPress
async function rpc(client, body) {
  const startTime = Date.now();
  const toolName = body?.params?.name;
  const args = body?.params?.arguments || {};
  const endpoint = endpointMap[toolName];

  if (!toolName) throw new Error('Missing params.name in request body');
  if (!endpoint) throw new Error(`Unknown tool: ${toolName}`);

  const path = typeof endpoint.path === 'function' ? endpoint.path(args) : endpoint.path;
  const url = `${client.wpUrl.replace(/\/$/, '')}${path}`;
  const auth = Buffer.from(`${client.wpUser}:${client.wpPass}`).toString('base64');

  let res;

  try {
    // 🧩 טיפול מיוחד להעלאת מדיה
    if (toolName === 'wp_upload_media') {
      const filename = args.filename || 'upload.jpg';
      const mime = args.mime || 'image/jpeg';
      const headers = {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'MCP-Hub/DirectREST'
      };

      // אפשרות א: נשלח base64_content → נשלח כ־Buffer
      if (args.base64_content) {
        const fileBuffer = Buffer.from(args.base64_content, 'base64');
        res = await fetch(url, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': mime
          },
          body: fileBuffer
        });
      }

      // אפשרות ב: נשלח form_data/binary → נשלח כ־multipart/form-data
      else if (args.binary || args.form_data) {
        const form = new FormData();
        const content = args.binary || args.form_data;
        form.append('file', content, { filename, contentType: mime });
        if (args.title) form.append('title', args.title);
        if (args.alt_text) form.append('alt_text', args.alt_text);

        res = await fetch(url, {
          method: 'POST',
          headers,
          body: form
        });
      } else {
        throw new Error('Missing file data: provide base64_content or binary/form_data');
      }
    }

    // ✅ יתר הקריאות הרגילות
    else {
      res = await fetch(url, {
        method: endpoint.method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'MCP-Hub/DirectREST',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: endpoint.method !== 'GET' ? JSON.stringify(args) : undefined
      });
    }
  } catch (netErr) {
    logger.log('ERROR', 'Network failure', { url, client: client.name, msg: netErr.message });
    throw new Error(`Network error while contacting ${client.name}: ${netErr.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    logger.log('ERROR', `WordPress REST error ${res.status}`, { url, body: text });
    throw new Error(`WordPress REST ${res.status}: ${text.substring(0, 150)}`);
  }

  const duration = Date.now() - startTime;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    jsonrpc: '2.0',
    id: body.id,
    result: data,
    meta: { duration, url }
  };
}

// ⚡ שרת HTTP ראשי
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const { pathname } = url;

  if (pathname === '/health') {
    return res.end(JSON.stringify({ status: 'healthy', mode: 'direct-rest', clients: Object.keys(clients) }, null, 2));
  }

  if (pathname === '/clients') {
    if (!authOk(req, url)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'unauthorized' }));
    }
    return res.end(JSON.stringify({ clients }, null, 2));
  }

  if (pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not_found', message: 'Use POST /mcp?client=NAME' }));
  }

  if (!authOk(req, url)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'unauthorized', hint: 'Add ?token=...' }));
  }

  const clientId = getClientId(req, url);
  const client = findClientById(clientId);

  if (!client) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'unknown_client',
      received: clientId,
      available: Object.keys(clients)
    }));
  }

  let body;
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const text = raw.toString('utf8');
    body = JSON.parse(text);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'invalid_json' }));
  }

  try {
    const out = await rpc(client, body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MCP Hub (Direct REST) ready on :${PORT}`);
});
