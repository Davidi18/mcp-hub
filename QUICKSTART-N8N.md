# 🚀 MCP Hub v2.0 - Quick Start

## מה השתנה? 🎯

### הגרסה החדשה כוללת:
✅ **Endpoint דינמי אחד** - `/sse` עם 3 דרכים לציין לקוח  
✅ **הוספת לקוחות דרך ENV בלבד** - אין קוד קשיח  
✅ **פרטי גישה דינמיים** - הכל מתוך משתני סביבה  
✅ **ניקיון קוד** - הוסרו קבצים ישנים  

---

## הגדרת לקוחות (Environment Variables)

```bash
# Authentication
PROXY_TOKEN=your_secure_token

# DataForSEO (אופציונלי)
DFS_USER=your_dataforseo_email
DFS_PASS=your_dataforseo_api_key

# Client 1
WP1_URL=https://site1.com
WP1_USER=admin@site1.com
WP1_APP_PASS=xxxx xxxx xxxx xxxx
CLIENT1_NAME=Site1  # אופציונלי - אם לא מוגדר יהיה "client1"

# Client 2
WP2_URL=https://acme.com
WP2_USER=admin@acme.com
WP2_APP_PASS=yyyy yyyy yyyy yyyy
CLIENT2_NAME=AcmeCorp

# Client 3
WP3_URL=https://techstartup.com
WP3_USER=admin@techstartup.com
WP3_APP_PASS=zzzz zzzz zzzz zzzz
CLIENT3_NAME=TechStartup

# ... עד 15 לקוחות
```

---

## 3 דרכים להשתמש ב-SSE Endpoint

### דרך 1: Query Parameter (מומלץ ל-n8n) ⭐

```bash
POST https://mcp.your-domain.com/sse?client=acmecorp
Authorization: your_token
```

**יתרונות:**
- ✅ Endpoint אחד לכל הלקוחות
- ✅ קל להגדיר ב-n8n
- ✅ קל לשנות לקוח

### דרך 2: HTTP Header

```bash
POST https://mcp.your-domain.com/sse
Authorization: your_token
X-Client-ID: acmecorp
```

### דרך 3: Path (תמיכה לאחור)

```bash
POST https://mcp.your-domain.com/acmecorp/sse
Authorization: your_token
```

---

## הגדרה ב-n8n

### אופציה 1: Endpoint אוניברסלי (מומלץ)

```json
{
  "mcpServers": {
    "mcp-hub-acme": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/sse?client=acmecorp",
      "headers": {
        "Authorization": "your_proxy_token"
      }
    },
    "mcp-hub-site1": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/sse?client=site1",
      "headers": {
        "Authorization": "your_proxy_token"
      }
    }
  }
}
```

### אופציה 2: Header-Based

```json
{
  "mcpServers": {
    "mcp-hub": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/sse",
      "headers": {
        "Authorization": "your_proxy_token",
        "X-Client-ID": "acmecorp"
      }
    }
  }
}
```

---

## בדיקה מהירה

### רשימת לקוחות זמינים

```bash
curl https://mcp.your-domain.com/clients \
  -H "Authorization: your_token"
```

תשובה:
```json
{
  "clients": [
    {"name": "Site1", "id": "site1", "url": "https://site1.com"},
    {"name": "AcmeCorp", "id": "acmecorp", "url": "https://acme.com"},
    {"name": "TechStartup", "id": "techstartup", "url": "https://techstartup.com"}
  ]
}
```

### בדיקת חיבור

```bash
curl -X POST "https://mcp.your-domain.com/sse?client=acmecorp" \
  -H "Authorization: your_token" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

---

## הוספת לקוח חדש

### שלב 1: הוסף משתנים ב-Coolify/Docker

```bash
WP4_URL=https://newclient.com
WP4_USER=admin@newclient.com
WP4_APP_PASS=your_app_password
CLIENT4_NAME=NewClient
```

### שלב 2: Redeploy

הלקוח החדש יזוהה אוטומטית!

### שלב 3: שימוש ב-n8n

```
https://mcp.your-domain.com/sse?client=newclient
```

**זהו!** אין צורך בשינוי קוד. 🎉

---

## Endpoints זמינים

| Endpoint | תיאור | דוגמה |
|----------|------|-------|
| `/health` | בדיקת תקינות | `GET /health` |
| `/clients` | רשימת לקוחות | `GET /clients` (requires auth) |
| `/sse` | SSE אוניברסלי | `POST /sse?client=name` |
| `/sse` | SSE עם header | `POST /sse` + `X-Client-ID` header |
| `/{client}/sse` | SSE path-based | `POST /acmecorp/sse` |
| `/{client}/mcp` | JSON-RPC | `POST /acmecorp/mcp` |

---

## כלים זמינים

כל לקוח מקבל גישה ל:

### WordPress (33 כלים)
- `wp/wp_posts_search` - חיפוש פוסטים
- `wp/wp_add_post` - יצירת פוסט
- `wp/wp_update_post` - עדכון פוסט
- `wp/wp_list_media` - רשימת מדיה
- `wp/get_site_info` - מידע על האתר
- ועוד 28 כלים...

### DataForSEO (61 כלים)
- `dfs/serp_organic_live_advanced` - ניתוח SERP
- `dfs/keywords_data_google_ads_search_volume` - נפח חיפוש
- `dfs/backlinks_backlinks` - ניתוח קישורים חוזרים
- `dfs/content_analysis_search` - ניתוח תוכן
- ועוד 57 כלים...

---

## Troubleshooting

### ❌ "Client not found"

בדוק שהמשתנים מוגדרים נכון:
```bash
docker logs mcp-hub | grep "Client loaded"
```

אמור להראות:
```
✅ Client loaded: AcmeCorp (acmecorp)
✅ Client loaded: Site1 (site1)
```

### ❌ "Unauthorized"

וודא ש-`Authorization` header תואם ל-`PROXY_TOKEN`:
```bash
echo $PROXY_TOKEN
```

### ❌ "No tools available"

בדוק ש-WordPress ו-DataForSEO רצים:
```bash
docker logs mcp-hub | grep -i "proxy\|dataforseo"
```

---

## דוגמאות שימוש ב-n8n

### דוגמה 1: חיפוש פוסטים

```javascript
// In n8n MCP node
{
  "method": "tools/call",
  "params": {
    "name": "wp/wp_posts_search",
    "arguments": {
      "search": "marketing",
      "per_page": 5
    }
  }
}
```

### דוגמה 2: ניתוח SEO

```javascript
{
  "method": "tools/call",
  "params": {
    "name": "dfs/serp_organic_live_advanced",
    "arguments": {
      "keyword": "digital marketing",
      "location_name": "Israel"
    }
  }
}
```

### דוגמה 3: יצירת פוסט חדש

```javascript
{
  "method": "tools/call",
  "params": {
    "name": "wp/wp_add_post",
    "arguments": {
      "title": "פוסט חדש",
      "content": "תוכן הפוסט...",
      "status": "draft"
    }
  }
}
```

---

## יתרונות הגרסה החדשה

### לפני v2.0:
❌ Endpoint נפרד לכל לקוח  
❌ צריך לעדכן קוד להוסיף לקוח  
❌ פרטי גישה בקוד  

### אחרי v2.0:
✅ Endpoint אחד דינמי  
✅ הוספת לקוח דרך ENV בלבד  
✅ כל הפרטים דינמיים  
✅ 3 דרכים לציין לקוח  
✅ קוד נקי ומסודר  

---

## סיכום

**להוספת לקוח:**
1. הוסף 4 משתנים ל-ENV (URL, USER, APP_PASS, NAME)
2. Redeploy
3. השתמש: `/sse?client=clientname`

**לשימוש ב-n8n:**
1. URL: `https://mcp.your-domain.com/sse?client=<name>`
2. Headers: `Authorization: your_token`
3. Transport: `SSE`

**זהו!** 🎉

---

## קישורים

- **מדריך מפורט**: [n8n-integration.md](./n8n-integration.md)
- **סקריפט בדיקה**: `./test-sse-transport.sh`
- **בעיות**: [GitHub Issues](https://github.com/Davidi18/mcp-hub/issues)
