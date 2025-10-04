# 🚀 שדרוג ל-MCP Hub v2.0

## מה חדש ב-v2.0?

### ✨ תכונות חדשות

1. **SSE Support** - תמיכה מלאה ב-Server-Sent Events
2. **MCP Protocol** - תאימות 100% ל-MCP standard (initialize handshake)
3. **Company Names** - שימוש בשמות חברות במקום מספרים (`/teena/mcp` במקום `/client3/mcp`)
4. **n8n Integration** - תמיכה מלאה ב-MCP Client Tool המובנה של n8n
5. **Health Check** - `/health` endpoint לניטור
6. **Documentation** - דף תיעוד אינטראקטיבי ב-`/`
7. **Better Logging** - לוגים משופרים עם metadata

### 🔄 שינויים שוברי תאימות

- **אין!** גרסה 2 תומכת לאחור בפורמט הישן `/client{N}/mcp`

---

## 📋 שלבי השדרוג

### שלב 1: גיבוי

```bash
# גיבוי משתני סביבה
docker exec mcp-hub env | grep -E "^(WP|DFS|CLIENT|PROXY)" > backup-env.txt

# גיבוי קונפיגורציה
docker inspect mcp-hub > backup-config.json
```

### שלב 2: עדכון קבצים

החלף את הקבצים הבאים בריפו שלך:

1. **aggregator-v2.js** - החלף/הוסף
2. **entrypoint-v2.sh** - החלף/הוסף  
3. **Dockerfile** - עדכן
4. **test-mcp-v2.sh** - הוסף (אופציונלי)

### שלב 3: הוספת שמות חברות (אופציונלי)

ב-Coolify, הוסף משתני סביבה חדשים:

```bash
# דוגמה: אם WP3 הוא האתר של Teena
CLIENT3_NAME=Teena Digital
# זה יצור endpoint: /teena-digital/mcp

# דוגמה נוספת
CLIENT1_NAME=Strudel Marketing
# זה יצור endpoint: /strudel-marketing/mcp
```

**תאימות לאחור:** אם לא תוסיף `CLIENT{N}_NAME`, המערכת תשתמש ב-`/client{N}/mcp` כרגיל.

### שלב 4: Deploy

```bash
# ב-Coolify: לחץ על "Redeploy"
# או ב-Git:
git add .
git commit -m "Upgrade to MCP Hub v2.0"
git push

# Coolify יזהה אוטומטית וי-deploy
```

### שלב 5: בדיקה

```bash
# הפעל את סקריפט הבדיקה
chmod +x test-mcp-v2.sh

# הרץ בדיקות
MCP_BASE_URL=https://mcp.strudel.marketing \
PROXY_TOKEN=your_token \
CLIENT_NAME=teena-digital \
./test-mcp-v2.sh
```

---

## 🧪 בדיקת שדרוג מוצלח

### 1. Health Check

```bash
curl https://mcp.strudel.marketing/health | jq .
```

**תוצאה מצופה:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 123.45,
  "clients": 3,
  "endpoints": [
    "/strudel-marketing/mcp",
    "/teena-digital/mcp",
    "/client3/mcp"
  ]
}
```

### 2. Documentation Page

פתח בדפדפן:
```
https://mcp.strudel.marketing/
```

צריך לראות דף תיעוד אינטראקטיבי עם כל ה-endpoints.

### 3. MCP Initialize

```bash
curl -X POST https://mcp.strudel.marketing/teena-digital/mcp \
  -H "Authorization: your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-01",
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }' | jq .
```

**תוצאה מצופה:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "protocolVersion": "2025-03-01",
    "capabilities": {
      "tools": {"listChanged": false}
    },
    "serverInfo": {
      "name": "MCP Hub - Teena Digital",
      "version": "2.0.0",
      "vendor": "Strudel Marketing"
    },
    "_meta": {
      "clientId": "3",
      "clientName": "teena-digital",
      "wpUrl": "https://teena.co.il"
    }
  }
}
```

### 4. SSE Streaming Test

```bash
curl -X POST https://mcp.strudel.marketing/teena-digital/mcp \
  -H "Authorization: your_token" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/list"
  }'
```

**תוצאה מצופה:**
```
data: {"jsonrpc":"2.0","id":"1","result":{"tools":[...]}}
```

---

## 🔧 שימוש ב-n8n

### הגדרת MCP Client Tool

1. **צור workflow חדש** או ערוך את הקיים
2. **הוסף AI Agent node**
3. **הוסף MCP Client Tool node**
4. **הגדר:**
   - **Endpoint URL**: `https://mcp.strudel.marketing/teena-digital/mcp`
   - **Headers**: 
     ```json
     {
       "Authorization": "your_proxy_token"
     }
     ```
   - **Connection Type**: `SSE (Server-Sent Events)`

5. **חבר ל-AI Agent** דרך `ai_tool` connection

### דוגמת Workflow

```json
{
  "nodes": [
    {
      "type": "@n8n/n8n-nodes-langchain.chatTrigger",
      "name": "Chat Trigger"
    },
    {
      "type": "@n8n/n8n-nodes-langchain.agent",
      "name": "AI Agent"
    },
    {
      "type": "@n8n/n8n-nodes-langchain.mcpClientTool",
      "name": "MCP Tools",
      "parameters": {
        "endpointUrl": "https://mcp.strudel.marketing/teena-digital/mcp",
        "headers": {
          "Authorization": "={{$env.PROXY_TOKEN}}"
        }
      }
    }
  ]
}
```

---

## 🐛 פתרון בעיות

### בעיה: "Client not found"

**פתרון:**
```bash
# בדוק אילו clients מוגדרים
docker logs mcp-hub | grep "Client"

# ודא ש-CLIENT_NAME תואם ל-endpoint
# אם הגדרת CLIENT3_NAME=Teena Digital
# השתמש ב: /teena-digital/mcp
```

### בעיה: SSE לא עובד

**בדיקה:**
```bash
# וודא שה-Accept header נכון
curl -X POST ... \
  -H "Accept: text/event-stream"

# בדוק logs
docker logs mcp-hub --tail 50 | grep SSE
```

### בעיה: n8n MCP Client לא מתחבר

**פתרון:**
1. בדוק Endpoint URL (חייב להיות מלא עם `/mcp`)
2. בדוק Headers (Authorization)
3. נסה בדיקה ידנית עם curl
4. בדוק n8n logs: Settings → Log Streaming

### בעיה: Tools לא מופיעים

**בדיקה:**
```bash
# בדוק שה-upstreams עובדים
docker logs mcp-hub | grep -E "(WordPress|DataForSEO)"

# בדוק tools/list
curl -X POST https://mcp.strudel.marketing/client3/mcp \
  -H "Authorization: token" \
  -d '{"jsonrpc":"2.0","method":"tools/list"}' | jq '.result.tools | length'
```

---

## 📊 השוואת גרסאות

| תכונה | v1.0 | v2.0 |
|-------|------|------|
| **SSE Support** | ⚠️ חלקי | ✅ מלא |
| **MCP Protocol** | ⚠️ בסיסי | ✅ מלא |
| **Client Names** | ❌ מספרים בלבד | ✅ שמות חברות |
| **n8n Integration** | ⚠️ HTTP Tools בלבד | ✅ MCP Client Tool |
| **Health Check** | ❌ | ✅ |
| **Documentation** | ❌ | ✅ |
| **Logging** | 📊 בסיסי | 📊 משופר |

---

## 🎯 מה הלאה?

### שלב 1: בדיקה בסיסית
- [x] Deploy v2
- [x] בדוק `/health`
- [x] בדוק documentation
- [x] הרץ test script

### שלב 2: הגדרת n8n
- [ ] צור workflow חדש
- [ ] הוסף MCP Client Tool
- [ ] בדוק את כל 94 הכלים
- [ ] שמור workflow template

### שלב 3: הגדרת שמות חברות
- [ ] הוסף `CLIENT{N}_NAME` לכל לקוח
- [ ] עדכן endpoints ב-n8n
- [ ] עדכן תיעוד פנימי

### שלב 4: ניטור
- [ ] הגדר alerts ב-Coolify
- [ ] מעקב אחר logs
- [ ] בדוק performance

---

## 📞 תמיכה

אם יש בעיות:

1. **בדוק logs**: `docker logs mcp-hub --tail 100`
2. **הרץ test script**: `./test-mcp-v2.sh`
3. **בדוק health**: `curl https://mcp.strudel.marketing/health`

---

## ✅ Checklist סופי

לפני שמסמנים את השדרוג כמוצלח:

- [ ] Health check מחזיר status: healthy
- [ ] Documentation page נטען
- [ ] Initialize method עובד
- [ ] tools/list מחזיר 94+ tools
- [ ] tools/call עובד (WordPress)
- [ ] tools/call עובד (DataForSEO)
- [ ] SSE streaming עובד
- [ ] n8n MCP Client מתחבר
- [ ] AI Agent מזהה את הכלים
- [ ] Authentication enforced
- [ ] Logs נקיים (אין errors)

**ברגע שהכל ✅ - מזל טוב! MCP Hub v2.0 פועל!** 🎉
