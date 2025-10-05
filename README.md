# 🚀 WordPress MCP Hub - Multi-Client Edition

MCP Hub אחד שמנהל מספר אתרי WordPress של לקוחות שונים, עם Rate Limiting, Caching ו-Analytics מובנים.

## 🎯 מה זה עושה?

במקום להריץ MCP נפרד לכל לקוח, יש לך:
- **נקודת קצה אחת**: `POST /mcp`
- **זיהוי לקוח**: באמצעות `X-Client-ID` header או `?client=NAME`
- **ניהול אוטומטי**: MCP Hub מנתב אוטומטית לאתר הנכון

## 📋 דרישות מקדימות

- Docker
- משתני סביבה של WordPress לכל לקוח

## 🛠️ הגדרה מהירה

### 1. הגדר משתני סביבה

צור קובץ `.env`:

```bash
# Client 1 - Strudel
WP1_URL=https://strudel.marketing/wp-json
WP1_USER=admin
WP1_APP_PASS=xxxx xxxx xxxx xxxx xxxx xxxx
CLIENT1_NAME=Strudel

# Client 2 - Another Client
WP2_URL=https://example.com/wp-json
WP2_USER=admin
WP2_APP_PASS=yyyy yyyy yyyy yyyy yyyy yyyy
CLIENT2_NAME=Example Corp

# אופציונלי: הגנה באמצעות token
AUTH_TOKEN=your-secret-token-here
```

### 2. בנה והרץ

```bash
# Build
docker build -t wordpress-mcp-hub .

# Run
docker run -d \
  --name wp-mcp-hub \
  -p 9090:9090 \
  --env-file .env \
  wordpress-mcp-hub
```

### 3. בדוק שהכל עובד

```bash
# בדיקת בריאות
curl http://localhost:9090/health

# רשימת לקוחות
curl http://localhost:9090/clients

# בדיקת WordPress MCPs
curl http://localhost:9090/debug/upstreams
```

## 📡 שימוש

### מ-n8n

הוסף את ה-MCP ל-n8n:

```json
{
  "mcpServers": {
    "wordpress": {
      "url": "https://mcp.yourdomain.com/mcp"
    }
  }
}
```

כשאתה קורא ל-tool, הוסף header:

```javascript
// בתוך HTTP Request node ב-n8n
headers: {
  "X-Client-ID": "strudel",  // או שם הלקוח שלך
  "Authorization": "Bearer YOUR-TOKEN"  // אם הגדרת AUTH_TOKEN
}
```

### דוגמת קריאה ישירה

```bash
curl -X POST http://localhost:9090/mcp \
  -H "X-Client-ID: strudel" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": "1"
  }'
```

## 🔍 Endpoints זמינים

| Endpoint | Method | תיאור |
|----------|--------|-------|
| `/mcp` | POST | נקודת הקצה הראשית של MCP |
| `/health` | GET | בדיקת בריאות המערכת |
| `/clients` | GET | רשימת כל הלקוחות |
| `/debug/upstreams` | GET | בדיקת חיבור לכל WordPress MCP |
| `/stats?client=NAME` | GET | סטטיסטיקות לפי לקוח |
| `/analytics?minutes=60` | GET | אנליטיקס של 60 הדקות האחרונות |
| `/` או `/docs` | GET | תיעוד אינטראקטיבי |

## 🎨 תכונות

### ✅ Rate Limiting
- הגבלת קריאות לפי לקוח
- הגנה מפני שימוש יתר
- Headers: `X-RateLimit-Remaining`, `Retry-After`

### ✅ Smart Caching
- Cache של תוצאות זהות
- Header: `X-Cache: HIT/MISS`
- חיסכון בקריאות ל-WordPress

### ✅ Analytics
- מעקב אחר כל הבקשות
- ביצועים לפי לקוח
- שגיאות ו-timeouts

### ✅ Multi-Client Support
- עד 15 לקוחות בו-זמנית
- כל לקוח עם MCP נפרד
- ניתוב אוטומטי

## 🏗️ ארכיטקטורה

```
┌─────────────┐
│   n8n/AI    │
└──────┬──────┘
       │ POST /mcp + X-Client-ID: strudel
       ↓
┌──────────────────────────────┐
│  Aggregator (Port 9090)      │
│  - Route by Client ID        │
│  - Rate Limiting             │
│  - Caching                   │
│  - Analytics                 │
└──────┬───────────────────────┘
       │
       ├─→ WordPress MCP 1 (Port 9101) → strudel.marketing
       ├─→ WordPress MCP 2 (Port 9102) → example.com
       └─→ WordPress MCP 3 (Port 9103) → another.com
```

## 🔧 פתרון בעיות

### הקונטיינר לא עולה
```bash
# בדוק לוגים
docker logs wp-mcp-hub

# בדוק שמשתני הסביבה הוגדרו
docker exec wp-mcp-hub env | grep WP
```

### WordPress MCP לא עונה
```bash
# בדוק upstreams
curl http://localhost:9090/debug/upstreams

# בדוק logs של MCP ספציפי
docker logs wp-mcp-hub | grep "WP-Strudel"
```

### שגיאת Authentication
- ודא ש-`AUTH_TOKEN` זהה בשרת ובקליינט
- בדוק שה-header הוא `Authorization: Bearer YOUR-TOKEN`

### לקוח לא נמצא
```bash
# בדוק רשימת לקוחות זמינים
curl http://localhost:9090/clients

# ודא שה-CLIENT_NAME תואם ל-X-Client-ID (lowercase, dashes במקום spaces)
```

## 📊 מעקב וניטור

### סטטיסטיקות בזמן אמת
```bash
# כל הלקוחות
curl http://localhost:9090/stats

# לקוח ספציפי
curl http://localhost:9090/stats?client=strudel
```

### Analytics
```bash
# 60 דקות אחרונות
curl http://localhost:9090/analytics?minutes=60

# 24 שעות אחרונות
curl http://localhost:9090/analytics?minutes=1440
```

## 🔐 אבטחה

1. **AUTH_TOKEN**: הוסף token סודי כדי להגן על ה-endpoint
2. **HTTPS**: השתמש ב-reverse proxy (nginx/caddy) עם SSL
3. **Firewall**: הגבל גישה רק ל-IP של n8n

### דוגמת Nginx config:

```nginx
server {
    listen 443 ssl;
    server_name mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # הגבלת גישה
        allow 1.2.3.4;  # n8n IP
        deny all;
    }
}
```

## 🚀 שימוש עם n8n

### צור Workflow שמשתמש במספר אתרי WordPress

```json
{
  "nodes": [
    {
      "name": "Get Posts from Strudel",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://mcp.yourdomain.com/mcp",
        "method": "POST",
        "headerParameters": {
          "parameters": [
            {
              "name": "X-Client-ID",
              "value": "strudel"
            }
          ]
        },
        "bodyParameters": {
          "parameters": [
            {
              "name": "jsonrpc",
              "value": "2.0"
            },
            {
              "name": "method",
              "value": "tools/call"
            },
            {
              "name": "params",
              "value": {
                "name": "get_posts",
                "arguments": {
                  "per_page": 10
                }
              }
            }
          ]
        }
      }
    }
  ]
}
```

## 💡 טיפים והמלצות

### זיהוי לקוח אוטומטי
אם אתה רוצה שכל workflow יתנהל אוטומטית ללקוח אחד, השתמש ב-environment variable:

```bash
# בהגדרת n8n
N8N_DEFAULT_CLIENT_ID=strudel
```

### Cache בהתאמה אישית
ניתן להגדיר זמני cache שונים לכל tool ב-`cache-manager.js`

### Rate Limiting בהתאמה אישית
ניתן להגדיר limits שונים לכל לקוח ב-`rate-limiter.js`

## 📝 היסטוריית שינויים

### v3.0.1 (2025-10-05)
- ✅ תיקון טיפול ב-JSON responses
- ✅ שיפור error handling
- ✅ תיקון הרצת WordPress MCPs דרך mcp-proxy
- ✅ הוספת timeout ל-upstream checks

### v3.0.0
- 🎉 גרסה ראשונה עם תמיכה במספר לקוחות
- Rate Limiting
- Caching
- Analytics

## 🤝 תרומה

אם מצאת בעיה או רוצה להציע שיפור:
1. פתח Issue
2. תאר את הבעיה בפירוט
3. צרף לוגים אם אפשר

## 📜 רישיון

MIT License - ראה [LICENSE](LICENSE)

## 🔗 קישורים שימושיים

- [WordPress REST API Docs](https://developer.wordpress.org/rest-api/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [n8n Documentation](https://docs.n8n.io/)
- [Original WordPress MCP](https://github.com/Automattic/wordpress-mcp)

---

Made with ❤️ for managing multiple WordPress sites efficiently
