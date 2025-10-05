# Changelog

כל השינויים המשמעותיים בפרויקט WordPress MCP Hub מתועדים כאן.

הפורמט מבוסס על [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.0.1] - 2025-10-05

### 🔧 Fixed
- **תיקון קריטי**: הרצת WordPress MCP instances דרך mcp-proxy בצורה תקינה
  - שינוי פקודת ההרצה ב-entrypoint.sh מ-`npx @automattic/mcp-wordpress-remote` ל-`mcp-wordpress-remote`
  - הוספת `--` separator נכון בין mcp-proxy לפקודת MCP
- **שיפור טיפול ב-JSON responses**
  - הסרת ניתוח SSE שגוי מפונקציית `rpc()`
  - שיפור error handling עם הודעות שגיאה ברורות יותר
  - הוספת logging טוב יותר לשגיאות JSON parsing
- **שיפור בדיקות upstreams**
  - הוספת timeout של 5 שניות לבדיקת `/debug/upstreams`
  - החזרת מידע מפורט יותר על כל WordPress MCP (health data)
- **תיקוני error handling**
  - הוספת `body.id` לכל תגובות שגיאה
  - שיפור הודעות שגיאה להיות יותר ידידותיות למשתמש

### 📚 Documentation
- **README.md**: תיעוד מקיף בעברית ואנגלית
  - הסבר על ארכיטקטורה
  - הוראות התקנה מפורטות
  - פתרון בעיות נפוצות
  - דוגמאות שימוש
- **QUICKSTART-N8N.md**: מדריך התחלה מהירה
  - 3 צעדים פשוטים להתקנה
  - חיבור ישיר ל-n8n
  - דוגמאות workflow מוכנות לשימוש
  - פתרון בעיות נפוצות
- **USE-CASES.md**: 9 use cases מעשיים
  - פרסום תוכן אוטומטי
  - סנכרון בין אתרים
  - ניהול מדיה
  - דוחות אנליטיקס
  - ניהול תגובות
  - עדכונים מרובים
  - גיבוי לענן
  - SEO optimization
  - Multi-site publishing

### ✨ Improved
- **Aggregator logging**
  - מידע מפורט יותר על clients רשומים
  - tracking טוב יותר של ביצועים
- **Health check endpoint**
  - הוספת מידע על analytics ו-cache stats
  - גרסה מעודכנת (3.0.1)
- **Documentation endpoint** (`/docs`)
  - UI משופר עם RTL support
  - הוספת רשימת debug endpoints
  - עיצוב נקי ומודרני

## [3.0.0] - 2025-10-04

### 🎉 Added - Initial Multi-Client Release
- **Multi-Client Architecture**
  - תמיכה בעד 15 לקוחות WordPress בו-זמנית
  - נקודת קצה אחת (`/mcp`) לכל הלקוחות
  - זיהוי לקוח דינמי דרך `X-Client-ID` header
  - ניתוב אוטומטי לWordPress MCP הנכון

- **Aggregator Layer** (`aggregator.js`)
  - מנהל את כל הבקשות ומנתב ללקוח הנכון
  - Rate limiting מובנה
  - Smart caching
  - Analytics ומעקב
  - Authentication support עם token

- **Rate Limiting** (`rate-limiter.js`)
  - הגבלת קריאות לפי לקוח
  - הגבלת קריאות לפי tool
  - Headers: `X-RateLimit-Remaining`, `Retry-After`
  - הגנה מפני שימוש יתר

- **Caching System** (`cache-manager.js`)
  - Cache חכם של תוצאות זהות
  - TTL configurable
  - Headers: `X-Cache: HIT/MISS`
  - חיסכון בקריאות מיותרות ל-WordPress

- **Analytics & Logging** (`analytics-logger.js`)
  - מעקב אחר כל הבקשות
  - ביצועים לפי לקוח
  - שגיאות ו-timeouts
  - Performance metrics

- **Docker Support**
  - Dockerfile מותאם
  - Multi-stage build
  - Health checks
  - Alpine Linux base (קטן ומהיר)

- **Debug & Monitoring Endpoints**
  - `/health` - בדיקת בריאות המערכת
  - `/clients` - רשימת לקוחות רשומים
  - `/debug/upstreams` - בדיקת חיבור לכל WordPress MCP
  - `/stats?client=NAME` - סטטיסטיקות לפי לקוח
  - `/analytics?minutes=60` - אנליטיקס של 60 דקות אחרונות
  - `/` - תיעוד אינטראקטיבי עם UI

### 🏗️ Architecture
```
┌─────────────┐
│   n8n/AI    │
└──────┬──────┘
       │
┌──────▼──────────────────────┐
│  Aggregator (Port 9090)     │
│  - Routing                  │
│  - Rate Limiting            │
│  - Caching                  │
│  - Analytics                │
└──────┬──────────────────────┘
       │
       ├─→ WP MCP 1 (Port 9101)
       ├─→ WP MCP 2 (Port 9102)
       └─→ WP MCP N (Port 910N)
```

### 🔐 Security Features
- Optional authentication עם `AUTH_TOKEN`
- Rate limiting למניעת abuse
- Validation של client IDs
- Error handling מאובטח (ללא חשיפת מידע רגיש)

### 📦 Dependencies
- `@automattic/mcp-wordpress-remote@latest` - WordPress MCP המקורי
- `mcp-proxy@latest` - Proxy layer
- Node.js 22 Alpine

### 🌐 Environment Variables
- `WP{1-15}_URL` - WordPress REST API URL
- `WP{1-15}_USER` - WordPress username
- `WP{1-15}_APP_PASS` - WordPress Application Password
- `CLIENT{1-15}_NAME` - שם הלקוח (אופציונלי)
- `AUTH_TOKEN` - Token לאימות (אופציונלי)

## [2.x.x] - Before Multi-Client Support

### Context
גרסאות קודמות השתמשו ב-WordPress MCP המקורי של Automattic ללא תמיכה multi-client.
כל לקוח דרש instance נפרד עם URL וcredentials נפרדים.

---

## תכנון עתידי

### [3.1.0] - Planned
- [ ] WebSocket support לupdates בזמן אמת
- [ ] Prometheus metrics endpoint
- [ ] Configuration UI
- [ ] Client-specific rate limits
- [ ] Custom cache TTL per tool
- [ ] Webhook support למניעת polling

### [3.2.0] - Ideas
- [ ] GraphQL endpoint
- [ ] Batch operations support
- [ ] Transaction support (rollback אם נכשל)
- [ ] Multi-language content sync
- [ ] Advanced analytics dashboard
- [ ] Auto-scaling based on load

---

## Contributing

מעוניין לתרום? ראה [CONTRIBUTING.md](CONTRIBUTING.md)

## Support

- 🐛 [Report Issues](https://github.com/Davidi18/wordpress-mcp/issues)
- 💬 [Discussions](https://github.com/Davidi18/wordpress-mcp/discussions)
- 📧 Email: support@example.com

---

**Legend:**
- 🎉 Added - תכונות חדשות
- 🔧 Fixed - תיקוני באגים
- ✨ Improved - שיפורים
- 🔐 Security - תיקוני אבטחה
- 📚 Documentation - שינויי תיעוד
- 🏗️ Architecture - שינויים ארכיטקטוניים
