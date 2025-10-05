#!/usr/bin/env node
// Simple HTTP wrapper for mcp-wordpress-remote
// Runs WordPress MCP via stdio and exposes it as HTTP JSON endpoint

import http from 'http';
import { spawn } from 'child_process';

const PORT = parseInt(process.env.PORT || '8080');
const WP_API_URL = process.env.WP_API_URL;
const WP_API_USERNAME = process.env.WP_API_USERNAME;
const WP_API_PASSWORD = process.env.WP_API_PASSWORD;

if (!WP_API_URL || !WP_API_USERNAME || !WP_API_PASSWORD) {
  console.error('Missing required environment variables: WP_API_URL, WP_API_USERNAME, WP_API_PASSWORD');
  process.exit(1);
}

let childProcess = null;
let initialized = false;
const pendingRequests = new Map();

function startMCP() {
  childProcess = spawn('mcp-wordpress-remote', [], {
    env: {
      ...process.env,
      WP_API_URL,
      WP_API_USERNAME,
      WP_API_PASSWORD
    },
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let buffer = '';
  
  childProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    
    // Try to parse complete JSON-RPC messages
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response = JSON.parse(line);
        const id = response.id;
        
        if (pendingRequests.has(id)) {
          const { res } = pendingRequests.get(id);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          pendingRequests.delete(id);
        }
      } catch (e) {
        console.error('Failed to parse MCP response:', e.message);
      }
    }
  });

  childProcess.on('exit', (code) => {
    console.error(`MCP process exited with code ${code}, restarting...`);
    setTimeout(startMCP, 1000);
  });
}

startMCP();

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    
    // Send request to MCP
    const requestId = body.id || String(Date.now());
    pendingRequests.set(requestId, { res, timeout: setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          error: { code: -32000, message: 'Request timeout' }
        }));
      }
    }, 30000) });
    
    childProcess.stdin.write(JSON.stringify(body) + '\n');
    
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' }
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WordPress MCP HTTP wrapper listening on :${PORT}`);
});

process.on('SIGTERM', () => {
  if (childProcess) childProcess.kill();
  server.close(() => process.exit(0));
});
