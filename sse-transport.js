// sse-transport.js - Dynamic Multi-Client SSE Transport
// Supports dynamic client routing via query param or header

import http from 'http';
import { URL } from 'url';

const PORT = 9093;
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';

// Upstream services
const WP_UPSTREAM = 'http://127.0.0.1:9091/mcp';
const DFS_UPSTREAM = 'http://127.0.0.1:9092/mcp';

console.log('🔌 Dynamic SSE Transport Server starting...');

// Load client configurations from environment
function loadClients() {
  const clients = {};
  for (let i = 1; i <= 15; i++) {
    const url = process.env[`WP${i}_URL`];
    const user = process.env[`WP${i}_USER`];
    const appPass = process.env[`WP${i}_APP_PASS`];
    const name = process.env[`CLIENT${i}_NAME`] || `client${i}`;
    
    if (url && user && appPass) {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      clients[normalizedName] = {
        id: i,
        name: name,
        url: url,
        user: user,
        appPass: appPass
      };
      clients[`client${i}`] = clients[normalizedName]; // Support both formats
      console.log(`✅ Client loaded: ${name} (${normalizedName})`);
    }
  }
  return clients;
}

const CLIENTS = loadClients();

function authOk(req) {
  const hdr = req.headers['authorization'];
  return PROXY_TOKEN ? hdr === PROXY_TOKEN : true;
}

// Extract client from multiple sources (priority order):
// 1. Query parameter: ?client=clientname
// 2. Header: X-Client-ID
// 3. Path: /clientname/sse
function getClient(req, pathname) {
  const url = new URL(req.url, 'http://localhost');
  
  // Method 1: Query parameter
  const queryClient = url.searchParams.get('client');
  if (queryClient && CLIENTS[queryClient]) {
    return { client: CLIENTS[queryClient], method: 'query' };
  }
  
  // Method 2: Header
  const headerClient = req.headers['x-client-id'] || req.headers['x-client'];
  if (headerClient && CLIENTS[headerClient]) {
    return { client: CLIENTS[headerClient], method: 'header' };
  }
  
  // Method 3: Path
  const pathMatch = pathname.match(/^\/([a-z0-9-]+)\/sse$/);
  if (pathMatch) {
    const clientName = pathMatch[1];
    if (CLIENTS[clientName]) {
      return { client: CLIENTS[clientName], method: 'path' };
    }
  }
  
  return { client: null, method: null };
}

async function fetchUpstream(url, body, clientId) {
  const urlWithClient = `${url}?client=${clientId}`;
  
  const res = await fetch(urlWithClient, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'X-Client-ID': clientId.toString()
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Upstream error: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        return JSON.parse(line.substring(6));
      }
    }
    throw new Error('No data in SSE response');
  }
  
  return await res.json();
}

function mergeTools(wpResp, dfsResp) {
  const wpTools = (wpResp.result?.tools || []).map(t => ({
    ...t,
    name: `wp/${t.name}`,
    description: `[WordPress] ${t.description || ''}`
  }));

  const dfsTools = (dfsResp.result?.tools || []).map(t => ({
    ...t,
    name: `dfs/${t.name}`,
    description: `[DataForSEO] ${t.description || ''}`
  }));

  return {
    jsonrpc: '2.0',
    id: wpResp.id || dfsResp.id || '1',
    result: {
      tools: [...wpTools, ...dfsTools]
    }
  };
}

function routeTool(toolName) {
  if (toolName?.startsWith('wp/')) {
    return { upstream: WP_UPSTREAM, name: toolName.slice(3) };
  }
  if (toolName?.startsWith('dfs/')) {
    return { upstream: DFS_UPSTREAM, name: toolName.slice(4) };
  }
  return { upstream: WP_UPSTREAM, name: toolName };
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    // Health check
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        status: 'ok', 
        service: 'Dynamic SSE Transport',
        version: '2.0.0',
        clients: Object.keys(CLIENTS).filter(k => !k.startsWith('client')).length,
        availableClients: Object.keys(CLIENTS).filter(k => !k.startsWith('client'))
      }));
    }
    
    // List clients endpoint
    if (pathname === '/clients') {
      if (!authOk(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      
      const clientList = Object.entries(CLIENTS)
        .filter(([key]) => !key.startsWith('client'))
        .map(([key, value]) => ({
          name: value.name,
          id: key,
          url: value.url
        }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ clients: clientList }));
    }

    // Universal SSE endpoint
    if (pathname === '/sse' || pathname.endsWith('/sse')) {
      // Check auth
      if (!authOk(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }

      // Get client info
      const { client, method } = getClient(req, pathname);
      
      if (!client) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          error: 'Client not found',
          hint: 'Specify client via: ?client=name OR X-Client-ID header OR /clientname/sse path',
          available: Object.keys(CLIENTS).filter(k => !k.startsWith('client'))
        }));
      }

      // Only handle POST
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      }

      // Read request body
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));

      console.log(`📨 [${client.name}] ${body.method} ${body.params?.name || ''} (via ${method})`);

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Client-ID': client.id,
        'X-Client-Name': client.name
      });

      let response;

      // Handle MCP methods
      switch (body.method) {
        case 'initialize':
          response = {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false }
              },
              serverInfo: {
                name: `MCP Hub - ${client.name}`,
                version: '2.0.0',
                description: `WordPress + DataForSEO for ${client.name}`
              }
            }
          };
          break;

        case 'tools/list':
          const [wpList, dfsList] = await Promise.all([
            fetchUpstream(WP_UPSTREAM, body, client.id),
            fetchUpstream(DFS_UPSTREAM, body, client.id)
          ]);
          response = mergeTools(wpList, dfsList);
          break;

        case 'tools/call':
          const toolName = body.params?.name;
          const { upstream, name } = routeTool(toolName);
          
          const callBody = {
            ...body,
            params: {
              ...body.params,
              name: name
            }
          };
          
          response = await fetchUpstream(upstream, callBody, client.id);
          break;

        default:
          response = {
            jsonrpc: '2.0',
            id: body.id,
            error: {
              code: -32601,
              message: `Method not found: ${body.method}`
            }
          };
      }

      // Send SSE response
      res.write(`data: ${JSON.stringify(response)}\n\n`);
      res.end();
      return;
    }

    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Not found',
      endpoints: {
        health: '/health',
        clients: '/clients (requires auth)',
        sse: {
          universal: '/sse?client=clientname',
          withHeader: '/sse + X-Client-ID header',
          withPath: '/clientname/sse'
        }
      }
    }));

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/event-stream' });
    }
    
    res.write(`data: ${JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      }
    })}\n\n`);
    
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Dynamic SSE Transport listening on :${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   - Universal: /sse?client=<name>`);
  console.log(`   - With header: /sse + X-Client-ID header`);
  console.log(`   - With path: /<clientname>/sse`);
  console.log(`📊 Loaded ${Object.keys(CLIENTS).filter(k => !k.startsWith('client')).length} clients`);
});

process.on('SIGTERM', () => {
  console.log('⚠️  Shutting down...');
  server.close(() => process.exit(0));
});
