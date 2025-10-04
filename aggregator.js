// aggregator-v2.js
// MCP Hub Aggregator עם תמיכה מלאה ב-SSE ו-MCP Protocol
import http from 'http';
import { URL } from 'url';

const PORT = 9090;
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';
const MCP_VERSION = '2025-03-01';

// בניית מיפוי מספר לקוח -> שם חברה
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
        console.log(`📋 Client ${i}: ${clientName} -> /${normalizedName}/mcp (${wpUrl})`);
      } else {
        mapping[`client${i}`] = i.toString();
        reverseMapping[i.toString()] = `client${i}`;
        console.log(`📋 Client ${i}: Default -> /client${i}/mcp (${wpUrl})`);
      }
    }
  }
  
  return { mapping, reverseMapping };
}

const { mapping: clientMapping, reverseMapping } = buildClientMapping();

// Authentication
function authOk(req) {
  const hdr = req.headers['authorization'];
  return PROXY_TOKEN ? hdr === PROXY_TOKEN : true;
}

// Extract client from path
function clientFromPath(pathname) {
  // תמיכה ב: /company-name/mcp או /client12/mcp
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

// RPC call to upstream with SSE support
async function rpc(upstreamUrl, body, clientN) {
  const urlWithClient = clientN ? `${upstreamUrl}?client=${clientN}` : upstreamUrl;
  
  const res = await fetch(urlWithClient, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'User-Agent': 'MCP-Hub-Aggregator/2.0',
      'X-Client-Number': clientN || '1'
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
  
  const contentType = res.headers.get('content-type') || '';
  
  // Handle SSE responses
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
}

// Merge tools from WordPress + DataForSEO
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

// Choose upstream by tool prefix
function chooseUpstreamByTool(name) {
  if (name?.startsWith('wp/')) {
    return { url: `http://127.0.0.1:9091/mcp`, rewritten: name.slice(3) };
  }
  if (name?.startsWith('dfs/')) {
    return { url: `http://127.0.0.1:9092/mcp`, rewritten: name.slice(4) };
  }
  // Default: WordPress
  return { url: `http://127.0.0.1:9091/mcp`, rewritten: name };
}

// SSE Helper - שליחת event
function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    
    // Health check endpoint
    if (pathname === '/health') {
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        status: 'healthy',
        version: '2.0.0',
        uptime: process.uptime(),
        clients: Object.keys(clientMapping).length,
        endpoints: Object.keys(clientMapping).map(name => `/${name}/mcp`)
      }));
    }
    
    // Documentation endpoint
    if (pathname === '/' || pathname === '/docs') {
      res.writeHead(200, {'Content-Type':'text/html'});
      return res.end(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>MCP Hub - API Documentation</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            h1 { color: #333; }
            .endpoint { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; }
            .method { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
            .post { background: #4CAF50; color: white; }
            pre { background: #282c34; color: #abb2bf; padding: 15px; border-radius: 5px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>🌐 MCP Hub API v2.0</h1>
          <p>Unified WordPress + DataForSEO MCP Server</p>
          
          <div class="endpoint">
            <h2>Available Clients</h2>
            <ul>
              ${Object.keys(clientMapping).map(name => {
                const num = clientMapping[name];
                const url = process.env[`WP${num}_URL`] || 'not configured';
                return `<li><code>/${name}/mcp</code> → ${url}</li>`;
              }).join('')}
            </ul>
          </div>
          
          <div class="endpoint">
            <h3><span class="method post">POST</span> /{client}/mcp</h3>
            <p><strong>Initialize Connection:</strong></p>
            <pre>{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-01",
    "clientInfo": { "name": "n8n", "version": "1.0" }
  }
}</pre>
          </div>
          
          <div class="endpoint">
            <h3><span class="method post">POST</span> /{client}/mcp</h3>
            <p><strong>List Available Tools:</strong></p>
            <pre>{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/list"
}</pre>
          </div>
          
          <div class="endpoint">
            <h3><span class="method post">POST</span> /{client}/mcp</h3>
            <p><strong>Call a Tool:</strong></p>
            <pre>{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "wp/wp_posts_search",
    "arguments": {
      "search": "SEO",
      "per_page": 10
    }
  }
}</pre>
          </div>
          
          <div class="endpoint">
            <h3>🔐 Authentication</h3>
            <p>All requests require:</p>
            <pre>Authorization: ${PROXY_TOKEN ? '[configured]' : '[not required]'}</pre>
          </div>
          
          <div class="endpoint">
            <h3>📊 Available Tools</h3>
            <ul>
              <li><strong>WordPress:</strong> 33 tools (prefix: <code>wp/</code>)</li>
              <li><strong>DataForSEO:</strong> 61 tools (prefix: <code>dfs/</code>)</li>
              <li><strong>Total:</strong> 94 tools</li>
            </ul>
          </div>
        </body>
        </html>
      `);
    }
    
    const clientN = clientFromPath(pathname);
    
    // Endpoint validation
    if (!clientN) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'not_found', 
        message: 'Valid endpoints: ' + Object.keys(clientMapping).map(name => `/${name}/mcp`).join(', '),
        availableClients: Object.keys(clientMapping)
      }));
    }
    
    // Authentication
    if (!authOk(req)) {
      res.writeHead(401, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({error:'unauthorized'}));
    }
    
    // Read request body
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    const method = body?.method;
    
    console.log(`📞 [Client ${clientN}] ${method || 'unknown method'}`);
    
    // Check if client wants SSE
    const acceptHeader = req.headers['accept'] || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');
    
    // MCP Protocol: initialize
    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: body.id || '1',
        result: {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: {
              listChanged: false
            },
            resources: {},
            prompts: {},
            logging: {}
          },
          serverInfo: {
            name: `MCP Hub - ${reverseMapping[clientN] || `Client ${clientN}`}`,
            version: '2.0.0',
            vendor: 'Strudel Marketing',
            description: 'Unified WordPress + DataForSEO MCP Server'
          },
          _meta: {
            clientId: clientN,
            clientName: reverseMapping[clientN] || `client${clientN}`,
            wpUrl: process.env[`WP${clientN}_URL`] || 'not configured'
          }
        }
      };
      
      if (wantsSSE) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        sendSSE(res, response);
        return res.end();
      } else {
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(response));
      }
    }
    
    // MCP Protocol: tools/list
    if (method === 'tools/list') {
      console.log(`🔧 Fetching tools for client ${clientN}...`);
      
      const [wpList, dfsList] = await Promise.all([
        rpc(`http://127.0.0.1:9091/mcp`, body, clientN),
        rpc(`http://127.0.0.1:9092/mcp`, body, clientN)
      ]);
      
      const merged = mergeTools(wpList, dfsList);
      
      console.log(`✅ Merged ${merged.result._meta.totalTools} tools (WP: ${merged.result._meta.wpToolsCount}, DFS: ${merged.result._meta.dfsToolsCount})`);
      
      if (wantsSSE) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        sendSSE(res, merged);
        return res.end();
      } else {
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(merged));
      }
    }
    
    // MCP Protocol: tools/call
    if (method === 'tools/call') {
      const toolName = body?.params?.name;
      console.log(`⚙️ Calling tool: ${toolName}`);
      
      const { url, rewritten } = chooseUpstreamByTool(toolName);
      const forwardBody = { ...body, params: { ...body.params, name: rewritten } };
      
      const out = await rpc(url, forwardBody, clientN);
      
      if (wantsSSE) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        sendSSE(res, out);
        return res.end();
      } else {
        res.writeHead(200, {'Content-Type':'application/json'});
        return res.end(JSON.stringify(out));
      }
    }
    
    // Default: Forward to WordPress
    const out = await rpc(`http://127.0.0.1:9091/mcp`, body, clientN);
    
    if (wantsSSE) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      sendSSE(res, out);
      return res.end();
    } else {
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(out));
    }
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: String(e?.message || e),
        data: { stack: e.stack }
      }
    }));
  }
});

// Server startup
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MCP Hub Aggregator v2.0 listening on :${PORT}\n`);
  console.log(`📋 Available endpoints:`);
  Object.keys(clientMapping).forEach(name => {
    const clientNum = clientMapping[name];
    const wpUrl = process.env[`WP${clientNum}_URL`];
    console.log(`   ✅ /${name}/mcp -> Client ${clientNum} (${wpUrl || 'not configured'})`);
  });
  console.log(`\n🔧 Features:`);
  console.log(`   • SSE Streaming: ✅`);
  console.log(`   • MCP Protocol: ✅`);
  console.log(`   • WordPress Tools: 33`);
  console.log(`   • DataForSEO Tools: 61`);
  console.log(`   • Total Tools: 94\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
