# 🆕 What's New - n8n Integration

## Latest Update: SSE Transport for n8n ✨

**Date**: October 2025  
**Version**: 3.1.0

### Problem Solved
Previously, after deploying MCP Hub, there was **no way to connect it to n8n** because:
- n8n requires SSE (Server-Sent Events) transport
- MCP Hub only provided JSON-RPC endpoints
- Missing proper MCP protocol implementation for automation tools

### Solution Implemented
Added complete SSE transport layer with:
- ✅ **New SSE Transport Server** (Port 9093)
- ✅ **Full MCP Protocol Support**
- ✅ **n8n Compatible Endpoints**
- ✅ **94 Tools Available** (33 WordPress + 61 DataForSEO)

---

## Quick Setup

### 1. Deploy Latest Version
```bash
# Pull latest changes
git pull origin main

# Redeploy in Coolify or your platform
# The new SSE transport will start automatically
```

### 2. Verify SSE is Running
```bash
docker logs mcp-hub | grep "SSE Transport"
# Should show: ✅ SSE Transport listening on :9093
```

### 3. Configure in n8n

**Connection Details:**
- **URL**: `https://mcp.your-domain.com/client1/sse`
- **Transport**: `SSE`
- **Auth Header**: `Authorization: your_proxy_token`

### 4. Test Connection
```bash
chmod +x test-sse-transport.sh
BASE_URL=https://mcp.your-domain.com TOKEN=your_token ./test-sse-transport.sh
```

---

## New Files

| File | Purpose |
|------|---------|
| `sse-transport.js` | SSE server for n8n integration |
| `QUICKSTART-N8N.md` | Complete n8n setup guide |
| `n8n-integration.md` | Detailed integration docs |
| `test-sse-transport.sh` | SSE endpoint test script |

---

## New Endpoints

Each client now has **two endpoints**:

### JSON-RPC (API Calls)
```
POST https://mcp.your-domain.com/client1/mcp
Content-Type: application/json
```

### SSE (n8n & Automation)
```
POST https://mcp.your-domain.com/client1/sse
Accept: text/event-stream
```

---

## Documentation

- **Quick Start**: [QUICKSTART-N8N.md](./QUICKSTART-N8N.md) ⭐ Start here
- **Full Guide**: [n8n-integration.md](./n8n-integration.md)
- **Main README**: [README.md](./README.md)

---

## Breaking Changes

**None!** The update is fully backward compatible:
- ✅ Existing JSON-RPC endpoints still work
- ✅ All WordPress/DataForSEO tools unchanged
- ✅ Authentication method same
- ➕ New SSE endpoints added

---

## Support

Having issues? Check:
1. [QUICKSTART-N8N.md](./QUICKSTART-N8N.md) - Common issues & solutions
2. Run `test-sse-transport.sh` for diagnostics
3. [GitHub Issues](https://github.com/Davidi18/mcp-hub/issues)

---

**Happy automating with n8n! 🎉**
