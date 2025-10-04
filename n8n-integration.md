# 🔌 n8n MCP Integration Guide

## Overview

This guide explains how to connect n8n to your MCP Hub using the SSE transport.

## Architecture

```
n8n → SSE Transport (Port 9093) → MCP Hub → WordPress + DataForSEO
```

The SSE transport provides a proper Server-Sent Events endpoint that n8n can connect to.

## Prerequisites

1. **MCP Hub deployed** with the latest version including `sse-transport.js`
2. **n8n instance** (self-hosted or cloud)
3. **n8n MCP integration** enabled

## Configuration

### 1. Update Your Environment Variables

Make sure you have these variables set in your deployment (Coolify, Docker, etc.):

```bash
# Required
PROXY_TOKEN=your_secure_token_here

# WordPress Client 1
WP1_URL=https://your-wordpress-site.com
WP1_USER=your_wordpress_email@domain.com
WP1_APP_PASS=xxxx xxxx xxxx xxxx
CLIENT1_NAME=MyCompany

# DataForSEO (optional)
DFS_USER=your_dataforseo_email
DFS_PASS=your_dataforseo_api_key
```

### 2. Expose Port 9093

In your Coolify/Docker setup, make sure port **9093** is exposed:

**Traefik Labels** (if using Traefik):
```yaml
traefik.http.services.mcp-hub-sse.loadbalancer.server.port=9093
traefik.http.routers.mcp-hub-sse.rule=Host(`mcp.your-domain.com`) && PathPrefix(`/client`)
```

**Or use Docker port mapping**:
```yaml
ports:
  - "9093:9093"
```

### 3. Configure n8n MCP Connection

In your n8n instance, add a new MCP server:

#### Option A: Using n8n UI

1. Go to **Settings** → **Model Context Protocol**
2. Click **Add Server**
3. Configure:
   - **Name**: `MCP Hub - Client1`
   - **Transport**: `SSE`
   - **URL**: `https://mcp.your-domain.com/client1/sse`
   - **Headers**:
     ```json
     {
       "Authorization": "your_proxy_token_here",
       "Content-Type": "application/json"
     }
     ```

#### Option B: Using n8n Configuration File

Add to your n8n `config.json`:

```json
{
  "mcpServers": {
    "mcp-hub-client1": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/client1/sse",
      "headers": {
        "Authorization": "your_proxy_token_here",
        "Content-Type": "application/json"
      }
    }
  }
}
```

### 4. Test the Connection

#### Using curl:

```bash
# Test SSE endpoint
curl -X POST https://mcp.your-domain.com/client1/sse \
  -H "Authorization: your_proxy_token" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "n8n",
        "version": "1.0.0"
      }
    }
  }'
```

Expected response (SSE format):
```
data: {"jsonrpc":"2.0","id":"1","result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"MCP Hub - client1","version":"1.0.0"}}}
```

#### List available tools:

```bash
curl -X POST https://mcp.your-domain.com/client1/sse \
  -H "Authorization: your_proxy_token" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/list"
  }'
```

## Available Endpoints

For each client, you now have **two endpoints**:

### JSON-RPC Endpoint (for direct API calls)
```
https://mcp.your-domain.com/client1/mcp
```

### SSE Endpoint (for n8n)
```
https://mcp.your-domain.com/client1/sse
```

Both endpoints provide access to the same tools:
- **WordPress tools**: Prefixed with `wp/`
- **DataForSEO tools**: Prefixed with `dfs/`

## Using in n8n Workflows

Once connected, you can use MCP tools in your n8n workflows:

### Example 1: WordPress Post Search

```javascript
// In n8n AI Agent node
{
  "tool": "wp/wp_posts_search",
  "arguments": {
    "search": "marketing",
    "per_page": 5
  }
}
```

### Example 2: SEO Analysis

```javascript
{
  "tool": "dfs/serp_organic_live_advanced",
  "arguments": {
    "keyword": "digital marketing",
    "location_name": "Israel"
  }
}
```

## Troubleshooting

### Connection Issues

1. **Check SSE transport is running**:
   ```bash
   docker logs mcp-hub | grep "SSE Transport"
   ```
   Should see: `✅ SSE Transport listening on :9093`

2. **Check port 9093 is exposed**:
   ```bash
   curl https://mcp.your-domain.com:9093/health
   ```

3. **Verify authentication**:
   Make sure `Authorization` header matches `PROXY_TOKEN` environment variable

### n8n-Specific Issues

1. **n8n can't find tools**: 
   - Verify the SSE endpoint URL is correct
   - Check that headers include `Authorization` token

2. **SSL/TLS errors**:
   - Make sure your domain has valid SSL certificate
   - n8n requires HTTPS for SSE connections

3. **Tools not appearing**:
   - Check both WordPress and DataForSEO services are running
   - Verify environment variables are set correctly

### Debug Mode

View detailed logs:
```bash
# All services
docker logs mcp-hub --tail 100

# Filter for SSE transport
docker logs mcp-hub | grep SSE

# Filter for specific client
docker logs mcp-hub | grep "client1"
```

## Multiple Clients

You can configure multiple clients, each with their own SSE endpoint:

```bash
# Client 1
WP1_URL=https://client1.com
CLIENT1_NAME=Client1
# Access via: /client1/sse

# Client 2  
WP2_URL=https://client2.com
CLIENT2_NAME=AcmeCorp
# Access via: /acmecorp/sse

# Client 3
WP3_URL=https://client3.com
CLIENT3_NAME=TechStartup
# Access via: /techstartup/sse
```

Each client gets isolated access to their own WordPress instance.

## Performance Considerations

The SSE transport supports:
- ✅ Real-time event streaming
- ✅ Long-polling connections
- ✅ Automatic reconnection
- ✅ Request/response caching
- ✅ Rate limiting per client

## Security

1. **Always use HTTPS** in production
2. **Use strong tokens** for `PROXY_TOKEN`
3. **Rotate tokens** regularly
4. **Monitor access logs** for unusual activity

## Next Steps

- [ ] Set up rate limiting for your clients
- [ ] Configure caching rules for DataForSEO
- [ ] Set up monitoring and alerts
- [ ] Create n8n workflow templates

## Support

For issues or questions:
- GitHub Issues: https://github.com/Davidi18/mcp-hub/issues
- Documentation: https://mcp.your-domain.com/docs
- Email: support@strudel.marketing
