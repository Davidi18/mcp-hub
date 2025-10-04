// wp-dynamic-proxy.js
// Proxy שמנתב בקשות ל-WordPress MCP הנכון לפי client number/name
import http from 'http';
import { spawn } from 'child_process';
import { URL } from 'url';

const PORT = 9091;

// טעינת כל ה-clients מ-environment
function loadClients() {
  const clients = {};
  
  for (let i = 1; i <= 15; i++) {
    const wpUrl = process.env[`WP${i}_URL`];
    const wpUser = process.env[`WP${i}_USER`];
    const wpPass = process.env[`WP${i}_APP_PASS`];
    const clientName = process.env[`CLIENT${i}_NAME`];
    
    if (wpUrl && wpUser && wpPass) {
      clients[i.toString()] = {
        url: wpUrl,
        user: wpUser,
        password: wpPass,
        name: clientName || `client${i}`
      };
      
      console.log(`✅ Loaded Client ${i}: ${clientName || `client${i}`} (${wpUrl})`);
    }
  }
  
  return clients;
}

const clients = loadClients();

// מציאת client לפי מספר או שם
function getClient(identifier) {
  // קודם כל נסה לפי מספר
  if (clients[identifier]) {
    return clients[identifier];
  }
  
  // אם לא, חפש לפי שם
  for (const [num, client] of Object.entries(clients)) {
    const normalizedName = client.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (normalizedName === identifier.toLowerCase()) {
      return client;
    }
  }
  
  // ברירת מחדל: client 1
  return clients['1'];
}

// Cache של process instances לכל client
const processCache = new Map();

async function getOrCreateMCPProcess(client) {
  const cacheKey = client.url;
  
  if (processCache.has(cacheKey)) {
    const cached = processCache.get(cacheKey);
    if (cached.proc && !cached.proc.killed) {
      return cached.port;
    }
  }
  
  // יצירת פורט ייחודי לכל client (9100 + מספר לקוח)
  const clientNum = Object.entries(clients).find(([_, c]) => c.url === client.url)?.[0] || '1';
  const port = 9100 + parseInt(clientNum);
  
  console.log(`🔄 Starting WordPress MCP for ${client.name} on port ${port}...`);
  
  const proc = spawn('npx', ['@automattic/mcp-wordpress-remote'], {
    env: {
      ...process.env,
      WP_API_URL: client.url,
      WP_API_USERNAME: client.user,
      WP_API_PASSWORD: client.password,
      PORT: port.toString()
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  proc.stdout.on('data', (data) => {
    console.log(`[WP-${client.name}] ${data.toString().trim()}`);
  });
  
  proc.stderr.on('data', (data) => {
    console.error(`[WP-${client.name}] ${data.toString().trim()}`);
  });
  
  proc.on('exit', (code) => {
    console.log(`[WP-${client.name}] Process exited with code ${code}`);
    processCache.delete(cacheKey);
  });
  
  processCache.set(cacheKey, { proc, port });
  
  // המתן קצר שהתהליך יתחיל
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return port;
}

// Proxy server
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    
    // קבלת מזהה הלקוח מ-query param או header
    const clientId = url.searchParams.get('client') || 
                     req.headers['x-client-number'] || 
                     '1';
    
    const client = getClient(clientId);
    
    if (!client) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        error: 'Client not found', 
        requestedClient: clientId 
      }));
    }
    
    console.log(`📞 Request for client: ${client.name} (${client.url})`);
    
    // קבל או צור את ה-MCP process
    const targetPort = await getOrCreateMCPProcess(client);
    
    // Forward the request
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: targetPort,
      path: url.pathname,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${targetPort}`
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error(`Proxy error for ${client.name}:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    
    req.pipe(proxyReq);
    
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WordPress Dynamic Proxy listening on :${PORT}`);
  console.log(`📋 Available clients:`);
  Object.entries(clients).forEach(([num, client]) => {
    console.log(`   Client ${num}: ${client.name} -> ${client.url}`);
  });
});

// Cleanup on exit
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  for (const [_, { proc }] of processCache) {
    proc.kill();
  }
  process.exit(0);
});
