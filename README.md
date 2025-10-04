# 🌐 MCP Hub v2.0 - Dynamic Multi-Client WordPress & SEO Integration

## 📋 סקירה כללית

**MCP Hub** הוא aggregator מאוחד של Model Context Protocol שמשלב יכולות ניהול WordPress עם כלי ניתוח SEO מתקדמים. הגרסה החדשה 2.0 מספקת endpoint דינמי אחד לכל הלקוחות עם ניתוב חכם.

### 🎯 תכונות עיקריות

- **🌐 אינטגרציה עם WordPress**: 33 כלים לניהול אתר מלא
- **📊 אינטגרציה עם DataForSEO**: 61 כלים לניתוח SEO מתקדם
- **🔐 אימות מאובטח**: בקרת גישה מבוססת token
- **🚀 ניתוב חכם**: ניתוב אוטומטי של כלים עם prefixes (`wp/`, `dfs/`)
- **⚡ ביצועים גבוהים**: מצב stateless לספידומטי
- **🎯 הפרדת לקוחות**: endpoint דינמי עם 3 דרכי זיהוי
- **🔌 תמיכה ב-n8n**: SSE transport מלא

---

## 🆕 מה חדש ב-v2.0

### Endpoint דינמי
במקום endpoint נפרד לכל לקוח, עכשיו יש **endpoint אחד אוניברסלי**:

```bash
# 3 דרכים לציין לקוח:
POST /sse?client=acmecorp          # Query parameter (מומלץ)
POST /sse + X-Client-ID: acmecorp  # HTTP Header
POST /acmecorp/sse                 # Path (תמיכה לאחור)
```

### הוספת לקוחות דינמית
```bash
# פשוט הוסף משתני סביבה:
WP4_URL=https://newclient.com
WP4_USER=admin@newclient.com
WP4_APP_PASS=xxxx xxxx xxxx
CLIENT4_NAME=NewClient

# Redeploy - והלקוח זמין! 🎉
```

### פרטי גישה דינמיים
כל פרטי הגישה של הלקוחות נשמרים במשתני סביבה בלבד - **אין קוד קשיח**.

---

## 🏗️ ארכיטקטורה

```
Internet → Traefik/Reverse Proxy
           ↓
    ┌──────────────────────────┐
    │  MCP Hub Aggregator      │ Port 9090 (JSON-RPC)
    │  + Dynamic SSE Transport │ Port 9093 (n8n/SSE)
    └──────────────────────────┘
           ↓              ↓
    ┌─────────────┐  ┌──────────────┐
    │ WordPress   │  │ DataForSEO   │
    │ Proxy       │  │ MCP Server   │
    │ Port 9091   │  │ Port 9092    │
    └─────────────┘  └──────────────┘
           ↓
    Multiple WordPress Sites
    (dynamic, based on ENV)
```

---

## 🚀 התקנה מהירה

### דרישות מוקדמות

- Docker & Docker Compose
- דומיין עם SSL (Let's Encrypt דרך Traefik)
- אתר WordPress עם תוסף MCP מותקן
- חשבון DataForSEO (אופציונלי)

### משתני סביבה

```bash
# אימות
PROXY_TOKEN=your_secure_token_here

# DataForSEO (אופציונלי)
DFS_USER=your_dataforseo_email
DFS_PASS=your_dataforseo_api_key

# לקוח 1
WP1_URL=https://your-wordpress-site.com
WP1_USER=your_wordpress_email@domain.com
WP1_APP_PASS=xxxx xxxx xxxx xxxx
CLIENT1_NAME=MyCompany  # אופציונלי

# לקוח 2
WP2_URL=https://client2-site.com
WP2_USER=client2@domain.com
WP2_APP_PASS=yyyy yyyy yyyy yyyy
CLIENT2_NAME=Client2

# ... עד 15 לקוחות
```

### Deployment ב-Coolify

1. **יצירת Application חדש**: Dockerfile from Git
2. **Repository**: כתובת ה-GitHub repository שלך
3. **Port**: `9090` (ו-`9093` ל-SSE)
4. **Domain**: `mcp.your-domain.com`
5. **Environment Variables**: הוסף את כל המשתנים למעלה
6. **Deploy**

---

## 📡 שימוש ב-API

### מבנה URL

#### JSON-RPC (API Calls)
```
https://mcp.your-domain.com/{clientname}/mcp
```

#### SSE (n8n & Automation)
```bash
# Query parameter (מומלץ)
https://mcp.your-domain.com/sse?client={clientname}

# HTTP Header
https://mcp.your-domain.com/sse
+ Header: X-Client-ID: {clientname}

# Path (backward compatible)
https://mcp.your-domain.com/{clientname}/sse
```

### אימות

כל הבקשות דורשות header של `Authorization`:

```bash
Authorization: your_proxy_token_here
```

### רשימת לקוחות זמינים

```bash
curl https://mcp.your-domain.com/clients \
  -H "Authorization: your_token"
```

תשובה:
```json
{
  "clients": [
    {"name": "MyCompany", "id": "mycompany", "url": "https://..."},
    {"name": "Client2", "id": "client2", "url": "https://..."}
  ]
}
```

---

## 🔌 אינטגרציה עם n8n

### הגדרה מהירה

```json
{
  "mcpServers": {
    "mcp-hub": {
      "transport": "sse",
      "url": "https://mcp.your-domain.com/sse?client=mycompany",
      "headers": {
        "Authorization": "your_proxy_token"
      }
    }
  }
}
```

### דוגמה לשימוש

```javascript
// חיפוש פוסטים ב-WordPress
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

// ניתוח SERP
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

📖 **מדריך מפורט**: [QUICKSTART-N8N.md](./QUICKSTART-N8N.md)

---

## 🛠️ כלים זמינים

### כלי WordPress (33)

| קטגוריה | כלים |
|----------|------|
| **Posts** | `wp_posts_search`, `wp_get_post`, `wp_add_post`, `wp_update_post` |
| **Pages** | `wp_pages_search`, `wp_get_page`, `wp_add_page`, `wp_update_page` |
| **Categories** | `wp_list_categories`, `wp_add_category`, `wp_update_category` |
| **Tags** | `wp_list_tags`, `wp_add_tag`, `wp_update_tag` |
| **Users** | `wp_users_search`, `wp_get_user`, `wp_add_user` |
| **Media** | `wp_list_media`, `wp_upload_media`, `wp_search_media` |
| **Settings** | `wp_get_general_settings`, `get_site_info` |

### כלי DataForSEO (61)

| קטגוריה | דוגמאות |
|----------|----------|
| **SERP Analysis** | `serp_organic_live_advanced` |
| **Keyword Research** | `keywords_data_google_ads_search_volume` |
| **Backlinks** | `backlinks_backlinks`, `backlinks_summary` |
| **Domain Analytics** | `domain_analytics_whois_overview` |
| **Content Analysis** | `content_analysis_search` |

---

## 🔒 אבטחה

### שיטות אימות

- **Token-based**: כל בקשה דורשת `PROXY_TOKEN` תקף
- **הפרדת לקוחות**: כל לקוח עם endpoint נפרד
- **WordPress security**: שימוש ב-Application Passwords

### Best Practices

1. **השתמש ב-tokens חזקים ויחודיים** ל-`PROXY_TOKEN`
2. **צור משתמשי WordPress ייעודיים** עם הרשאות מינימליות
3. **החלף Application Passwords** באופן קבוע
4. **עקוב אחר access logs** לפעילות חריגה
5. **השתמש ב-HTTPS בלבד**

---

## 🧪 בדיקות

### בדיקת תקינות

```bash
curl https://mcp.your-domain.com/health
```

### סקריפט בדיקה

```bash
chmod +x test-sse-transport.sh
BASE_URL=https://mcp.your-domain.com \
TOKEN=your_token \
CLIENT=mycompany \
./test-sse-transport.sh
```

---

## 🔄 הוספת לקוח חדש

### שלב 1: הוסף משתני סביבה

```bash
WP3_URL=https://new-client-site.com
WP3_USER=client3@domain.com
WP3_APP_PASS=zzzz zzzz zzzz zzzz
CLIENT3_NAME=NewClient
```

### שלב 2: Redeploy

המערכת מזהה אוטומטית את הלקוח החדש!

### שלב 3: השתמש

```bash
# n8n
https://mcp.your-domain.com/sse?client=newclient

# API
https://mcp.your-domain.com/newclient/mcp
```

**זהו!** אין צורך בשינוי קוד. 🎉

---

## 📈 ביצועים

- **זמן תגובה**: < 2 שניות לרוב הפעולות
- **בקשות concurrent**: תומך ב-100+ חיבורים בו-זמנית
- **שימוש בזיכרון**: ~200MB בסיס + 50MB ללקוח פעיל
- **שימוש ב-CPU**: < 10% בעומס רגיל

### אופטימיזציות

- **Rate Limiting**: הגבלת קצב per-client
- **Smart Caching**: שמירת תשובות DataForSEO
- **Connection Pooling**: חיבורי HTTP יעילים
- **Compression**: Gzip לכל התשובות

---

## 🚨 Troubleshooting

### בעיות נפוצות

#### 1. "Client not found"

```bash
# בדוק שהלקוח נטען
docker logs mcp-hub | grep "Client loaded"
```

#### 2. שגיאות אימות WordPress

**פתרון**: השתמש בכתובת email (לא username) ב-`WP1_USER`

#### 3. בעיות SSL Certificate

**פתרון**: וודא שTraefik מוגדר נכון עם Let's Encrypt

---

## 💼 תרחישי שימוש

### סוכנויות שיווק דיגיטלי

- **דוחות לקוחות**: דוחות SEO אוטומטיים ללקוחות מרובים
- **ניהול תוכן**: פעולות WordPress המוניות
- **ניתוח מתחרים**: מודיעין תחרותי של DataForSEO

### SEO ארגוני

- **ניהול multi-site**: שליטה מרכזית ב-WordPress
- **אנליטיקה מתקדמת**: ניתוח נתוני SEO עמוק
- **אוטומציה**: פעולות תוכן מיועלות

---

## 📞 תמיכה

### תיעוד

- **מדריך מהיר**: [QUICKSTART-N8N.md](./QUICKSTART-N8N.md) ⭐
- **אינטגרציה עם n8n**: [n8n-integration.md](./n8n-integration.md)
- **WordPress MCP**: [תיעוד רשמי](https://github.com/Automattic/wordpress-mcp)
- **DataForSEO**: [תיעוד API](https://docs.dataforseo.com/)

### קהילה

- **GitHub Issues**: דיווח על באגים ובקשות לתכונות
- **Discussions**: תמיכה קהילתית ורעיונות

---

## 📄 רישיון

MIT License - ראה קובץ [LICENSE](LICENSE) לפרטים.

---

## 🙏 תודות

- **Automattic** - אינטגרציה עם WordPress MCP
- **DataForSEO** - APIs מתקדמים לSEO
- **Model Context Protocol** - אינטגרציה סטנדרטית של כלי AI

---

**נבנה ב-❤️ עבור קהילות המפתחים והשיווק**

*שנה את זרימות העבודה של WordPress ו-SEO עם כוח של אינטגרציית API מאוחדת.*
