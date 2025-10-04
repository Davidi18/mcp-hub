# MCP Hub - Single Endpoint Architecture

**One endpoint, multiple clients. Secure, scalable, simple.**

Multi-tenant MCP server that aggregates WordPress and DataForSEO tools with intelligent rate limiting, caching, and analytics.

## 🎯 Architecture

### Single Endpoint Design
Instead of multiple per-client endpoints, MCP Hub uses **one unified endpoint** with flexible client identification:

```
Before (old):  POST /strudel/mcp, POST /caio/mcp, POST /teena/mcp...
After (new):   POST /mcp  (with client identification)
```

**Benefits:**
- ✅ Better security (no client names in URLs)
- ✅ Easier to scale (no routing complexity)
- ✅ Simpler configuration
- ✅ Cleaner logs and monitoring

## 🚀 Quick Start

### Using Header (Recommended)
```bash
curl -X POST https://mcp.strudel.marketing/mcp \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: strudel" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":"1"}'
```

### Using Query Parameter
```bash
curl -X POST "https://mcp.strudel.marketing/mcp?client=strudel" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":"1"}'
```

### Using Combined Auth Header
```bash
curl -X POST https://mcp.strudel.marketing/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer strudel:your-token" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":"1"}'
```

## 📋 Configuration

### Environment Variables

**Client Configuration** (repeat for up to 15 clients):
```bash
# Client 1
WP1_URL=https://example.com
WP1_USER=admin
WP1_APP_PASS=xxxx-xxxx-xxxx-xxxx
CLIENT1_NAME=strudel

# Client 2
WP2_URL=https://another-site.com
WP2_USER=admin
WP2_APP_PASS=yyyy-yyyy-yyyy-yyyy
CLIENT2_NAME=caio
```

**DataForSEO Integration** (optional):
```bash
DFS_USER=your-dataforseo-username
DFS_PASS=your-dataforseo-password
```

**Security** (optional):
```bash
PROXY_TOKEN=your-secure-token-here
```

## 🔌 Integration Examples

### n8n Workflow
```javascript
// HTTP Request Node
{
  "url": "https://mcp.strudel.marketing/mcp",
  "method": "POST",
  "headers": {
    "X-Client-ID": "strudel",
    "Content-Type": "application/json"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "wp/create_post",
      "arguments": {
        "title": "My Post",
        "content": "Post content"
      }
    },
    "id": "1"
  }
}
```

### Claude Desktop Config
```json
{
  "mcpServers": {
    "strudel-wordpress": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {
        "MCP_SERVER_URL": "https://mcp.strudel.marketing/mcp",
        "MCP_HEADERS": "X-Client-ID: strudel"
      }
    }
  }
}
```

### Python Client
```python
import requests

def call_mcp(client_id, method, params=None):
    response = requests.post(
        "https://mcp.strudel.marketing/mcp",
        headers={
            "X-Client-ID": client_id,
            "Content-Type": "application/json"
        },
        json={
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": "1"
        }
    )
    return response.json()

# Usage
result = call_mcp("strudel", "tools/list")
print(result)
```

## 📊 Management API

### Health Check
```bash
GET /health
```
Returns system status, registered clients, and statistics.

### List Clients (requires auth)
```bash
GET /clients
Authorization: Bearer your-token
```
Returns all registered clients.

### Per-Client Stats (requires auth)
```bash
GET /stats?client=strudel
Authorization: Bearer your-token
```
Returns rate limiting, caching, and usage stats for a specific client.

### Analytics (requires auth)
```bash
GET /analytics?minutes=60
Authorization: Bearer your-token
```
Returns detailed analytics for the last N minutes.

## ✨ Features

### 1. Rate Limiting
Per-client and per-tool rate limits to prevent abuse:
- Global limit: 1000 requests/hour per client
- DataForSEO tools: 100 requests/hour per client
- Automatic retry-after headers

### 2. Smart Caching
Intelligent caching for expensive operations:
- DataForSEO results cached for 24 hours
- Saves up to 80% on API costs
- Per-client cache isolation

### 3. Analytics
Real-time usage tracking:
- Request counts and durations
- Error rates and patterns
- Cache hit rates
- Rate limit violations

### 4. Multi-Tenant Support
Up to 15 WordPress clients with full isolation:
- Separate credentials per client
- Independent rate limits
- Isolated caching
- Per-client analytics

## 🐳 Deployment

### Docker Compose
```yaml
version: '3.8'
services:
  mcp-hub:
    image: ghcr.io/davidi18/mcp-hub:latest
    ports:
      - "9090:9090"
    environment:
      # Client 1
      - WP1_URL=https://site1.com
      - WP1_USER=admin
      - WP1_APP_PASS=xxxx-xxxx-xxxx-xxxx
      - CLIENT1_NAME=strudel
      
      # Client 2
      - WP2_URL=https://site2.com
      - WP2_USER=admin
      - WP2_APP_PASS=yyyy-yyyy-yyyy-yyyy
      - CLIENT2_NAME=caio
      
      # DataForSEO
      - DFS_USER=your-username
      - DFS_PASS=your-password
      
      # Security
      - PROXY_TOKEN=your-secure-token
```

### Coolify
1. Add repository: `https://github.com/Davidi18/mcp-hub`
2. Set environment variables in Coolify UI
3. Deploy - automatic build and start

## 🔒 Security

### Client Identification Priority
1. **X-Client-ID header** (recommended)
2. **?client= query parameter** (fallback)
3. **Authorization header** (Bearer client:token format)

### Best Practices
- Always use HTTPS in production
- Set strong PROXY_TOKEN for management endpoints
- Use X-Client-ID header (not in URL) for better security
- Rotate WordPress application passwords regularly
- Monitor rate limit violations

## 🧪 Testing

### Test Initialize
```bash
curl -X POST http://localhost:9090/mcp \
  -H "X-Client-ID: strudel" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":"1"}'
```

### Test Tools List
```bash
curl -X POST http://localhost:9090/mcp \
  -H "X-Client-ID: strudel" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":"1"}'
```

### Test WordPress Tool
```bash
curl -X POST http://localhost:9090/mcp \
  -H "X-Client-ID: strudel" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"wp/list_posts",
      "arguments":{"per_page":5}
    },
    "id":"1"
  }'
```

## 🛠️ Development

### Local Setup
```bash
# Clone repository
git clone https://github.com/Davidi18/mcp-hub.git
cd mcp-hub

# Set environment variables
cp .env.example .env
# Edit .env with your credentials

# Run with Docker
docker build -t mcp-hub .
docker run -p 9090:9090 --env-file .env mcp-hub

# Or run directly with Node.js
node aggregator.js
```

### Project Structure
```
mcp-hub/
├── aggregator.js          # Main server (single endpoint)
├── wp-dynamic-proxy.js    # WordPress proxy
├── rate-limiter.js        # Rate limiting logic
├── cache-manager.js       # Caching logic
├── analytics-logger.js    # Analytics tracking
├── entrypoint.sh          # Startup script
├── Dockerfile             # Container definition
└── package.json           # Node.js dependencies
```

## 📈 Monitoring

### Prometheus Metrics (Coming Soon)
```
# HELP mcp_requests_total Total number of requests
# TYPE mcp_requests_total counter
mcp_requests_total{client="strudel",method="tools/call"} 1234

# HELP mcp_cache_hits_total Cache hit rate
# TYPE mcp_cache_hits_total counter
mcp_cache_hits_total{client="strudel"} 987
```

### Health Check Response
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "uptime": 86400,
  "endpoint": "/mcp",
  "clientIdentification": [
    "X-Client-ID header",
    "client query parameter"
  ],
  "registeredClients": [
    "strudel",
    "caio",
    "teena"
  ],
  "features": {
    "rateLimiting": true,
    "caching": true,
    "analytics": true,
    "multiClient": true
  },
  "stats": {
    "cache": {
      "hits": 1234,
      "misses": 567,
      "hitRate": 68.5
    }
  }
}
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details.

## 🔗 Links

- **Repository**: https://github.com/Davidi18/mcp-hub
- **Issues**: https://github.com/Davidi18/mcp-hub/issues
- **Discussions**: https://github.com/Davidi18/mcp-hub/discussions

## 💡 Why Single Endpoint?

Traditional multi-endpoint approaches have several issues:

1. **Security**: Client names visible in URLs leak information
2. **Scaling**: Need to manage routing tables and load balancing per client
3. **Configuration**: Complex nginx/proxy configurations
4. **Monitoring**: Difficult to aggregate metrics across clients
5. **Maintenance**: Changes require updating multiple endpoints

The single endpoint architecture solves all these issues by:
- Using headers/parameters for client identification
- Centralizing routing logic
- Simplifying proxy configuration
- Enabling easier monitoring and analytics
- Supporting dynamic client addition without code changes

---

**Made with ❤️ for the MCP community**
