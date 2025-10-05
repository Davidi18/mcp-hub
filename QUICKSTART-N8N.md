# 🚀 Quick Start - n8n Integration

הדרכה מהירה לחיבור WordPress MCP Hub עם n8n.

## 📋 דרישות

- Docker מותקן
- n8n instance (ענן או self-hosted)
- Application Passwords מ-WordPress

## ⚡ התקנה ב-3 צעדים

### 1️⃣ הגדר משתני סביבה

צור קובץ `.env`:

```bash
# Client 1
WP1_URL=https://yoursite.com/wp-json
WP1_USER=admin
WP1_APP_PASS=xxxx xxxx xxxx xxxx xxxx xxxx
CLIENT1_NAME=Your Company

# Client 2 (אופציונלי)
WP2_URL=https://client2.com/wp-json
WP2_USER=admin
WP2_APP_PASS=yyyy yyyy yyyy yyyy yyyy yyyy
CLIENT2_NAME=Client 2

# Security (מומלץ מאוד!)
AUTH_TOKEN=your-random-secret-token-here
```

### 2️⃣ הרץ Docker Container

```bash
docker run -d \
  --name wp-mcp-hub \
  -p 9090:9090 \
  --restart unless-stopped \
  --env-file .env \
  ghcr.io/davidi18/wordpress-mcp:latest
```

או עם Docker Compose:

```yaml
version: '3.8'
services:
  wp-mcp-hub:
    image: ghcr.io/davidi18/wordpress-mcp:latest
    container_name: wp-mcp-hub
    ports:
      - "9090:9090"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9090/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

```bash
docker-compose up -d
```

### 3️⃣ בדוק שהכל עובד

```bash
# Health check
curl http://localhost:9090/health | jq

# רשימת לקוחות
curl http://localhost:9090/clients | jq

# בדיקת WordPress connections
curl http://localhost:9090/debug/upstreams | jq
```

## 🔗 חיבור ל-n8n

### אופציה A: HTTP Request Node (פשוט)

1. צור HTTP Request node חדש
2. הגדר:
   - **Method**: POST
   - **URL**: `http://your-server:9090/mcp`
   - **Authentication**: None (או Bearer Token אם הגדרת AUTH_TOKEN)
   - **Headers**:
     - `X-Client-ID`: `your-company` (שם הלקוח שלך ב-lowercase)
     - `Content-Type`: `application/json`
   - **Body**:
     ```json
     {
       "jsonrpc": "2.0",
       "method": "tools/list",
       "id": "1"
     }
     ```

### אופציה B: MCP Client Node (מתקדם)

אם n8n תומך ב-MCP natively:

```json
{
  "mcpServers": {
    "wordpress": {
      "url": "http://your-server:9090/mcp",
      "headers": {
        "X-Client-ID": "your-company",
        "Authorization": "Bearer YOUR-TOKEN"
      }
    }
  }
}
```

## 📡 דוגמאות שימוש

### דוגמה 1: קבלת רשימת פוסטים

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_posts",
    "arguments": {
      "per_page": 10,
      "status": "publish"
    }
  },
  "id": "1"
}
```

### דוגמה 2: יצירת פוסט חדש

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_post",
    "arguments": {
      "title": "כותרת הפוסט",
      "content": "תוכן הפוסט",
      "status": "draft"
    }
  },
  "id": "2"
}
```

### דוגמה 3: עדכון פוסט קיים

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "update_post",
    "arguments": {
      "id": 123,
      "title": "כותרת מעודכנת",
      "status": "publish"
    }
  },
  "id": "3"
}
```

## 🎯 Workflow לדוגמה ב-n8n

### Workflow: פרסום תוכן אוטומטי

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Schedule   │────▶│  AI Generate │────▶│  WordPress MCP │
│  Trigger    │     │    Content   │     │  Create Post   │
└─────────────┘     └──────────────┘     └────────────────┘
```

**JSON של ה-Workflow**:

```json
{
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "days",
              "value": 1
            }
          ]
        }
      }
    },
    {
      "name": "AI Generate Content",
      "type": "n8n-nodes-base.openAi",
      "position": [450, 300],
      "parameters": {
        "operation": "text",
        "prompt": "Write a blog post about..."
      }
    },
    {
      "name": "Create WordPress Post",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300],
      "parameters": {
        "url": "http://mcp-server:9090/mcp",
        "method": "POST",
        "headerParameters": {
          "parameters": [
            {
              "name": "X-Client-ID",
              "value": "your-company"
            },
            {
              "name": "Authorization",
              "value": "Bearer YOUR-TOKEN"
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
                "name": "create_post",
                "arguments": {
                  "title": "={{ $json.choices[0].message.content.split('\\n')[0] }}",
                  "content": "={{ $json.choices[0].message.content }}",
                  "status": "draft"
                }
              }
            },
            {
              "name": "id",
              "value": "1"
            }
          ]
        }
      }
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "AI Generate Content",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AI Generate Content": {
      "main": [
        [
          {
            "node": "Create WordPress Post",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## 🔍 בדיקת תקינות

### בדיקה 1: MCP Hub פעיל

```bash
curl http://localhost:9090/health
```

**תוצאה מצופה**:
```json
{
  "status": "healthy",
  "version": "3.0.1",
  "registeredClients": ["your-company"],
  "features": {
    "rateLimiting": true,
    "caching": true,
    "analytics": true
  }
}
```

### בדיקה 2: חיבור ל-WordPress

```bash
curl http://localhost:9090/debug/upstreams
```

**תוצאה מצופה**:
```json
{
  "your-company": {
    "status": "ok",
    "code": 200,
    "port": 9101,
    "wpUrl": "https://yoursite.com/wp-json"
  }
}
```

### בדיקה 3: קריאת Tools

```bash
curl -X POST http://localhost:9090/mcp \
  -H "X-Client-ID: your-company" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": "1"
  }' | jq
```

**תוצאה מצופה**: רשימת tools זמינים (get_posts, create_post, וכו')

## 🔐 הגדרת HTTPS (Production)

### עם Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:9090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # הגבלת גישה (אופציונלי)
        allow 1.2.3.4;  # IP של n8n
        deny all;
    }
}
```

### עם Caddy (פשוט יותר!)

```
mcp.yourdomain.com {
    reverse_proxy localhost:9090
}
```

## 💡 טיפים

### 1. שימוש במספר לקוחות באותו Workflow

```javascript
// בתוך Function node
const clients = ['client1', 'client2', 'client3'];

return clients.map(client => ({
  json: {
    url: 'http://mcp-server:9090/mcp',
    headers: {
      'X-Client-ID': client,
      'Authorization': 'Bearer YOUR-TOKEN'
    },
    body: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_posts',
        arguments: { per_page: 5 }
      },
      id: '1'
    }
  }
}));
```

### 2. Error Handling

```javascript
// בתוך Function node אחרי HTTP Request
if ($input.item.json.error) {
  throw new Error(`MCP Error: ${$input.item.json.error.message}`);
}

return $input.item.json.result;
```

### 3. Caching חכם

השתמש ב-cache של MCP Hub:
- קריאות זהות יחזרו מהcache
- Header `X-Cache: HIT` מציין שהתוצאה מה-cache
- חוסך זמן וקריאות מיותרות ל-WordPress

## 🆘 פתרון בעיות נפוצות

### שגיאה: "Client not found"

**פתרון**: בדוק ש-`X-Client-ID` תואם לשם שהגדרת ב-`CLIENT1_NAME` (lowercase, ללא רווחים)

```bash
# בדוק שמות לקוחות זמינים
curl http://localhost:9090/clients
```

### שגיאה: "unauthorized"

**פתרון**: הוסף את ה-`Authorization` header:

```javascript
headers: {
  "Authorization": "Bearer YOUR-TOKEN"
}
```

### שגיאה: "WordPress MCP error 500"

**פתרון**: בדוק שה-Application Password תקין:

```bash
# בדוק חיבור ישיר ל-WordPress
curl -u "admin:xxxx xxxx xxxx xxxx" \
  https://yoursite.com/wp-json/wp/v2/posts
```

### WordPress MCP לא מגיב

**פתרון**: בדוק logs:

```bash
docker logs wp-mcp-hub | grep "WP-Your Company"
```

## 📊 ניטור וסטטיסטיקות

```bash
# ביצועים ושימוש
curl http://localhost:9090/stats | jq

# אנליטיקס של השעה האחרונה
curl http://localhost:9090/analytics?minutes=60 | jq
```

---

**צריך עזרה?** פתח Issue ב-GitHub או שלח לי הודעה! 🚀
