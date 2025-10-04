# 🚀 Quick Start Guide - n8n Integration

## Problem Solved ✅

After deploying MCP Hub, you couldn't connect it to n8n because:
- n8n requires **SSE (Server-Sent Events)** transport
- The original MCP Hub only had JSON-RPC endpoints
- Missing proper SSE endpoint for MCP protocol

**Solution**: Added `sse-transport.js` running on port 9093 with proper SSE support!

---

## What Changed

### New Files Added
1. **sse-transport.js** - SSE transport server for n8n
2. **n8n-integration.md** - Complete integration guide
3. Updated **Dockerfile** - Includes SSE transport
4. Updated **entrypoint-v2.sh** - Starts SSE server on port 9093

### New Endpoints
Each client now has **TWO** endpoints:

**JSON-RPC (for API calls):**
```
https://mcp.your-domain.com/client1/mcp
```

**SSE (for n8n):**
```
https://mcp.your-domain.com/client1/sse
```

---

## Installation Steps

### 1. Update Your Deployment

Pull the latest code and redeploy:

```bash
# In Coolify or your deployment platform:
1. Trigger new deployment from GitHub
2. Wait for build to complete
3. Check logs to verify SSE transport started
```

### 2. Verify SSE Transport is Running

Check your logs:
```bash
docker logs mcp-hub | grep "SSE Transport"
```

You should see:
```
✅ SSE Transport listening on :9093
📍 Example endpoint: http://localhost:9093/client1/sse
```

### 3. Expose Port 9093

**Option A: Coolify/Docker**
Make sure port 9093 is exposed in your container settings.

**Option B: Traefik (if using)**
The existing Traefik config should work, but verify it routes to port 9093 for `/sse` paths.

### 4. Test the SSE Endpoint

```bash
curl -X POST https://mcp.your-domain.com/client1/sse \
  -H "Authorization: YOUR_PROXY_TOKEN" \
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
        "name": "test",
        "version": "1.0.0"
      }
    }
  }'
```

Expected response (SSE format):
```
data: {"jsonrpc":"2.0","id":"1","result":{"protocolVersion":"2024-11-05",...}}
```

---

## Configure n8n

### Method 1: n8n Cloud/Self-Hosted UI

1. Go to **Settings** → **Model Context Protocol**
2. Click **Add Server**
3. Configure:
   - **Name**: `MCP Hub - Client1`
   - **Transport Type**: `SSE` (or `HTTP with SSE`)
   - **URL**: `https://mcp.your-domain.com/client1/sse`
   - **Authentication**:
     - Type: `Header`
     - Header Name: `Authorization`
     - Header Value: `your_proxy_token_here`

### Method 2: n8n Configuration File

Add to `~/.n8n/config` or environment variables:

```json
{
  "mcpServers": {
    "mcp-hub": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/client1/sse",
      "headers": {
        "Authorization": "your_proxy_token_here"
      }
    }
  }
}
```

Or as environment variable:
```bash
N8N_MCP_SERVERS='{"mcp-hub":{"transport":"sse","url":"https://mcp.your-domain.com/client1/sse","headers":{"Authorization":"your_token"}}}'
```

### Method 3: n8n MCP Node Configuration

In your n8n workflow:

1. Add **MCP** or **AI Agent** node
2. In MCP Server settings:
   - **Server URL**: `https://mcp.your-domain.com/client1/sse`
   - **Transport**: `SSE`
   - **Headers**: Add `Authorization` with your token

---

## Test in n8n

### Example Workflow 1: List Tools

```json
{
  "nodes": [
    {
      "name": "MCP List Tools",
      "type": "n8n-nodes-base.mcp",
      "parameters": {
        "server": "mcp-hub",
        "method": "tools/list"
      }
    }
  ]
}
```

### Example Workflow 2: WordPress Search

```json
{
  "nodes": [
    {
      "name": "Search WP Posts",
      "type": "n8n-nodes-base.mcp",
      "parameters": {
        "server": "mcp-hub",
        "method": "tools/call",
        "tool": "wp/wp_posts_search",
        "arguments": {
          "search": "marketing",
          "per_page": 5
        }
      }
    }
  ]
}
```

### Example Workflow 3: SEO Analysis

```json
{
  "nodes": [
    {
      "name": "Get SERP Data",
      "type": "n8n-nodes-base.mcp",
      "parameters": {
        "server": "mcp-hub",
        "method": "tools/call",
        "tool": "dfs/serp_organic_live_advanced",
        "arguments": {
          "keyword": "digital marketing",
          "location_name": "Israel"
        }
      }
    }
  ]
}
```

---

## Available Tools in n8n

Once connected, you'll have access to **94 tools**:

### WordPress Tools (33)
- `wp/wp_posts_search` - Search posts
- `wp/wp_add_post` - Create posts
- `wp/wp_update_post` - Update posts
- `wp/wp_pages_search` - Search pages
- `wp/wp_list_categories` - List categories
- `wp/wp_list_media` - List media
- `wp/get_site_info` - Site information
- And 26 more...

### DataForSEO Tools (61)
- `dfs/serp_organic_live_advanced` - SERP analysis
- `dfs/keywords_data_google_ads_search_volume` - Keyword volume
- `dfs/backlinks_backlinks` - Backlink analysis
- `dfs/content_analysis_search` - Content analysis
- And 57 more...

---

## Troubleshooting

### ❌ "Cannot connect to MCP server"

**Check 1: SSE Transport is running**
```bash
docker logs mcp-hub | grep -i sse
```

**Check 2: Port 9093 is accessible**
```bash
curl https://mcp.your-domain.com:9093/health
```

**Check 3: Authorization token is correct**
```bash
echo $PROXY_TOKEN  # Should match what you're using in n8n
```

### ❌ "Authentication failed"

Make sure the `Authorization` header in n8n exactly matches your `PROXY_TOKEN` environment variable.

### ❌ "No tools available"

**Check WordPress and DataForSEO services:**
```bash
docker logs mcp-hub | grep -i "wordpress\|dataforseo"
```

Both should show as started.

### ❌ "SSE connection timeout"

This usually means:
1. Port 9093 not exposed/accessible
2. Firewall blocking the connection
3. SSL certificate issues

**Test directly:**
```bash
curl -v https://mcp.your-domain.com/client1/sse
```

---

## Architecture Overview

```
┌─────────┐
│   n8n   │
└────┬────┘
     │ SSE Connection
     ↓
┌────────────────────────────────────┐
│  MCP Hub (Port 9093)               │
│  sse-transport.js                  │
└────┬───────────────────────────────┘
     │
     ├─→ WordPress Proxy (9091) ─→ WordPress Sites
     │
     └─→ DataForSEO MCP (9092) ─→ DataForSEO API
```

---

## Multiple Clients

Configure multiple WordPress sites:

```bash
# Client 1
WP1_URL=https://site1.com
WP1_USER=user1@site1.com
WP1_APP_PASS=xxxx xxxx xxxx
CLIENT1_NAME=Site1

# Client 2
WP2_URL=https://site2.com
WP2_USER=user2@site2.com
WP2_APP_PASS=yyyy yyyy yyyy
CLIENT2_NAME=AcmeCorp
```

Then in n8n, configure multiple MCP servers:

```json
{
  "mcpServers": {
    "site1": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/site1/sse",
      "headers": {"Authorization": "token"}
    },
    "acmecorp": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/acmecorp/sse",
      "headers": {"Authorization": "token"}
    }
  }
}
```

---

## Security Notes

1. **Always use HTTPS** - n8n requires secure connections for SSE
2. **Strong tokens** - Use a strong `PROXY_TOKEN`
3. **Firewall rules** - Limit access to port 9093 if needed
4. **Monitor logs** - Check for unauthorized access attempts

---

## Next Steps

1. ✅ Deploy updated MCP Hub
2. ✅ Verify SSE transport is running
3. ✅ Configure n8n connection
4. ✅ Test with simple workflow
5. 🚀 Build your automation workflows!

---

## Support

- **Full Documentation**: [n8n-integration.md](./n8n-integration.md)
- **GitHub Issues**: https://github.com/Davidi18/mcp-hub/issues
- **Email**: support@strudel.marketing

---

## Summary

**Before**: ❌ No n8n connection possible  
**After**: ✅ Full SSE support with 94 tools available

**Key Endpoints**:
- Health: `https://mcp.your-domain.com/health`
- JSON-RPC: `https://mcp.your-domain.com/client1/mcp`
- **SSE (n8n)**: `https://mcp.your-domain.com/client1/sse` ⭐

Happy automating! 🎉
