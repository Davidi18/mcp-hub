// sse-transport.js
// True SSE Transport for n8n MCP Integration

import http from 'http';
import { URL } from 'url';

const PORT = 9093;
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';

// Upstream services
const WP_UPSTREAM = 'http://127.0.0.1:9091/mcp';
const DFS_UPSTREAM = 'http://127.0.0.1:9092/mcp';

console.log('🔌 SSE Transport Server starting...');

function authOk(req) {
  const hdr = req.headers['authorization'];
  return PROXY_TOKEN ? hdr === PROXY_TOKEN : true;
}

function clientFromPath(pathname) {
  const match = pathname.match(/^\/([a-z0-9-]+)\/sse$/);
  if (match) {
    return match[1];
  }
  const numMatch = pathname.match(/^\/client(\d{1,2})\/sse$/);
  return numMatch ? `client${numMatch[1]}` : null;
}

async function fetchUpstream(url, body, clientId) {
  const urlWithClient = `${url}?client=${clientId}`;
  
  const res = await fetch(urlWithClient, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'X-Client-ID': clientId
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Upstream error: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  
  // Handle SSE response
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
        service: 'SSE Transport',
        version: '1.0.0'
      }));
    }

    // SSE endpoint pattern: /client1/sse or /mycompany/sse
    const clientId = clientFromPath(pathname);

    if (!clientId) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        error: 'Not found',
        hint: 'Use /{clientName}/sse endpoint'
      }));
    }

    // Check auth
    if (!authOk(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
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

    console.log(`📨 [${clientId}] ${body.method} ${body.params?.name || ''}`);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
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
              name: `MCP Hub - ${clientId}`,
              version: '1.0.0'
            }
          }
        };
        break;

      case 'tools/list':
        const [wpList, dfsList] = await Promise.all([
          fetchUpstream(WP_UPSTREAM, body, clientId),
          fetchUpstream(DFS_UPSTREAM, body, clientId)
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
        
        response = await fetchUpstream(upstream, callBody, clientId);
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
  console.log(`✅ SSE Transport listening on :${PORT}`);
  console.log(`📍 Example endpoint: http://localhost:${PORT}/client1/sse`);
});

process.on('SIGTERM', () => {
  console.log('⚠️  Shutting down...');
  server.close(() => process.exit(0));
});
