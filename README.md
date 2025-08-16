🌐 Unified MCP Hub — Per-Client URL (WordPress + DataForSEO)
כתובת אחת לכל לקוח המאחדת את כלי WordPress MCP של אותו לקוח וגם את כלי DataForSEO.
🔗 דוגמאות כתובות
https://mcp.your-domain.com/client1/mcp
https://mcp.your-domain.com/client2/mcp
...
https://mcp.your-domain.com/client15/mcp
האימות מול השכבה נעשה בכותרת:
Authorization: <PROXY_TOKEN>
🏗️ מה בפנים
Aggregator (פורט 9090):

מחזיר tools/list מאוחד
מנתב tools/call לפי prefix:

כלי WP בשם wp/<toolName>
כלי DataForSEO בשם dfs/<toolName>



Upstreams (פנימי, פורט 9091):

@automattic/mcp-wordpress-remote (לכל לקוח WP; ברירת מחדל עם Application Password)
dataforseo-mcp-server (כללי)


ברירת המחדל ל-WP היא Application Password (לא פג תוקף) כדי להימנע מחידושי JWT.

📁 מבנה הריפו
mcp-hub/
├─ Dockerfile
├─ entrypoint.sh
├─ aggregator.js
└─ upstreams.template.json

Dockerfile – בונה אימג׳ עם כל הכלים
entrypoint.sh – מרכיב קונפיג מ-ENV ומריץ גם upstreams וגם aggregator
aggregator.js – שרת HTTP שמאחד כלים ומנתב קריאות
upstreams.template.json – תבנית להרצת כל לקוחות ה-WP + DataForSEO כ-upstreams פנימיים


💡 אין צורך ב-docker-compose ב-Coolify. פריסה מומלצת כ-Dockerfile App ישירות מהריפו.

⚙️ דרישות

דומיין/תת-דומיין (למשל mcp.your-domain.com)
Coolify (Dockerfile from Git)
משתמש WP ייעודי + Application Password לכל לקוח (Capabilities מינימליים)
חשבון DataForSEO (אם משתמשים בכלים שלהם)

🚀 פריסה ב-Coolify (Dockerfile from Git)

New App → Dockerfile from Git והצביעו אל הריפו
הגדירו HTTP Port: 9090 ודומיין עם SSL
הוסיפו את משתני הסביבה (Env Vars) הבאים, ואז Deploy

🔑 משתני סביבה להגדרה
חובה
bashPROXY_TOKEN=your_long_random_string_here

מחרוזת אקראית ארוכה; תשמש כ-Authorization מה-n8n

DataForSEO (אופציונלי)
bashDFS_USER=your_dataforseo_username
DFS_PASS=your_dataforseo_password
לקוחות WordPress (עד 15)
לכל לקוח:
bashWP1_URL=https://client1.example
WP1_USER=mcp-bot
WP1_APP_PASS=xxxx xxxx xxxx xxxx

WP2_URL=https://client2.example
WP2_USER=mcp-bot
WP2_APP_PASS=yyyy yyyy yyyy yyyy

# ... עד WP15
🔧 שימוש מ-n8n
כתובת ללקוח
URL ללקוח 1: https://mcp.your-domain.com/client1/mcp
כותרות
json{
  "Authorization": "<PROXY_TOKEN>",
  "Content-Type": "application/json"
}
🧪 בדיקות
בדיקת בריאות (curl)
bashcurl -sS https://mcp.your-domain.com/client1/mcp \
  -H "Authorization: YOUR_PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
קריאת כלי (דוגמה)
bashcurl -sS https://mcp.your-domain.com/client1/mcp \
  -H "Authorization: YOUR_PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "id":"1",
    "method":"tools/call",
    "params": { 
      "name": "wp/wp_get_posts", 
      "arguments": { "per_page": 3 } 
    }
  }'

לכלי DataForSEO השתמשו בשם עם prefix dfs/...

➕ הוספת לקוח חדש

הוסיפו ב-Coolify את שלישיית ה-ENV: WPN_URL, WPN_USER, WPN_APP_PASS
Deploy — אין צורך לשנות קוד

🔄 מעבר ל-OAuth/JWT (אופציונלי)

OAuth דרך ה-remote: קבעו OAUTH_ENABLED=true ללקוח הספציפי (רענון טוקנים אוטומטי)
JWT: אם מוכרחים, החליפו אימות ל-JWT (ENV JWT_TOKEN) ונהלו ריענון חיצוני (למשל n8n שמעדכן ENV ועושה restart)


ברירת מחדל מומלצת: Application Password (ללא תפוגה) + משתמש ייעודי עם מינימום הרשאות

🔒 אבטחה מומלצת

✅ דרישת PROXY_TOKEN לכל קריאה (נאכף באגרגטור)
✅ משתמש WP ייעודי לכל לקוח עם Capabilities מינימליים (לא Admin)
✅ HTTPS בלבד; מומלץ WAF/IP Allowlist
✅ אל תשמרו סודות בלוגים
✅ אפשר להפריד סטייג׳ינג/פרודקשן בדומיינים שונים

🔍 פתרון בעיות
שגיאהפתרון401בדקו את כותרת Authorization מול PROXY_TOKEN404ודאו שה-URL הוא /clientN/mcp ושקיימים ENV ללקוח Nשגיאות WPבדקו WPn_URL/USER/APP_PASS והרשאות המשתמשDataForSEOודאו DFS_USER/PASS ותוקף החשבוןלוגיםבדשבורד Coolify → Logs של האפליקציה
❓ שאלות נפוצות
האם כל הכלים זמינים באותה כתובת?
✅ כן — לכל לקוח יש כתובת אחת (/clientN/mcp) עם רשימת כלים מאוחדת (WP + DataForSEO). ההפרדה היא בין לקוחות, לא בין שירותים.
חייבים docker-compose?
❌ לא. פרסו כ-Dockerfile App (פשוט יותר).

🎯 Ready for deployment! פתרון מאוחד ופשוט לניהול כלי MCP מרובים עבור מספר לקוחות.Retry Mהאם זב בפורמט מארקדאון קלאסי שאוכל להעתיק ולהדביק בגיטהאב as is?EditRemembering...
כן, זה בפורמט מארקדאון קלאסי! הקוד שכתבתי משתמש בתחביר מארקדאון סטנדרטי שיעבוד מצוין ב-GitHub. הנה רק גרסה מעודכנת עם כמה תיקונים קלים לתאימות מושלמת:
markdown# 🌐 Unified MCP Hub — Per-Client URL (WordPress + DataForSEO)

**כתובת אחת לכל לקוח** המאחדת את כלי **WordPress MCP** של אותו לקוח **וגם** את כלי **DataForSEO**. 

## 🔗 דוגמאות כתובות
https://mcp.your-domain.com/client1/mcp
https://mcp.your-domain.com/client2/mcp
...
https://mcp.your-domain.com/client15/mcp

האימות מול השכבה נעשה בכותרת:
Authorization: <PROXY_TOKEN>

## 🏗️ מה בפנים

### **Aggregator (פורט 9090):**
- מחזיר `tools/list` מאוחד 
- מנתב `tools/call` לפי prefix:
  - כלי WP בשם `wp/<toolName>`
  - כלי DataForSEO בשם `dfs/<toolName>`

### **Upstreams (פנימי, פורט 9091):**
- `@automattic/mcp-wordpress-remote` (לכל לקוח WP; ברירת מחדל עם Application Password)
- `dataforseo-mcp-server` (כללי)

> ברירת המחדל ל-WP היא **Application Password** (לא פג תוקף) כדי להימנע מחידושי JWT.

## 📁 מבנה הריפו
mcp-hub/
├─ Dockerfile
├─ entrypoint.sh
├─ aggregator.js
└─ upstreams.template.json

- `Dockerfile` – בונה אימג׳ עם כל הכלים
- `entrypoint.sh` – מרכיב קונפיג מ-ENV ומריץ גם upstreams וגם aggregator
- `aggregator.js` – שרת HTTP שמאחד כלים ומנתב קריאות
- `upstreams.template.json` – תבנית להרצת כל לקוחות ה-WP + DataForSEO כ-upstreams פנימיים

> **💡 אין צורך ב-docker-compose ב-Coolify.** פריסה מומלצת כ-**Dockerfile App** ישירות מהריפו.

## ⚙️ דרישות

- דומיין/תת-דומיין (למשל `mcp.your-domain.com`)
- Coolify (Dockerfile from Git)
- משתמש WP ייעודי + Application Password לכל לקוח (Capabilities מינימליים)
- חשבון DataForSEO (אם משתמשים בכלים שלהם)

## 🚀 פריסה ב-Coolify (Dockerfile from Git)

1. **New App → Dockerfile from Git** והצביעו אל הריפו
2. הגדירו **HTTP Port: 9090** ודומיין עם SSL
3. הוסיפו את משתני הסביבה (Env Vars) הבאים, ואז **Deploy**

## 🔑 משתני סביבה להגדרה

### חובה
```bash
PROXY_TOKEN=your_long_random_string_here

מחרוזת אקראית ארוכה; תשמש כ-Authorization מה-n8n

DataForSEO (אופציונלי)
bashDFS_USER=your_dataforseo_username
DFS_PASS=your_dataforseo_password
לקוחות WordPress (עד 15)
לכל לקוח:
bashWP1_URL=https://client1.example
WP1_USER=mcp-bot
WP1_APP_PASS=xxxx xxxx xxxx xxxx

WP2_URL=https://client2.example
WP2_USER=mcp-bot
WP2_APP_PASS=yyyy yyyy yyyy yyyy

# ... עד WP15
🔧 שימוש מ-n8n
כתובת ללקוח
URL ללקוח 1: https://mcp.your-domain.com/client1/mcp
כותרות
json{
  "Authorization": "<PROXY_TOKEN>",
  "Content-Type": "application/json"
}
🧪 בדיקות
בדיקת בריאות (curl)
bashcurl -sS https://mcp.your-domain.com/client1/mcp \
  -H "Authorization: YOUR_PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
קריאת כלי (דוגמה)
bashcurl -sS https://mcp.your-domain.com/client1/mcp \
  -H "Authorization: YOUR_PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "id":"1",
    "method":"tools/call",
    "params": { 
      "name": "wp/wp_get_posts", 
      "arguments": { "per_page": 3 } 
    }
  }'

לכלי DataForSEO השתמשו בשם עם prefix dfs/...

➕ הוספת לקוח חדש

הוסיפו ב-Coolify את שלישיית ה-ENV: WPN_URL, WPN_USER, WPN_APP_PASS
Deploy — אין צורך לשנות קוד

🔄 מעבר ל-OAuth/JWT (אופציונלי)

OAuth דרך ה-remote: קבעו OAUTH_ENABLED=true ללקוח הספציפי (רענון טוקנים אוטומטי)
JWT: אם מוכרחים, החליפו אימות ל-JWT (ENV JWT_TOKEN) ונהלו ריענון חיצוני (למשל n8n שמעדכן ENV ועושה restart)


ברירת מחדל מומלצת: Application Password (ללא תפוגה) + משתמש ייעודי עם מינימום הרשאות

🔒 אבטחה מומלצת

✅ דרישת PROXY_TOKEN לכל קריאה (נאכף באגרגטור)
✅ משתמש WP ייעודי לכל לקוח עם Capabilities מינימליים (לא Admin)
✅ HTTPS בלבד; מומלץ WAF/IP Allowlist
✅ אל תשמרו סודות בלוגים
✅ אפשר להפריד סטייג׳ינג/פרודקשן בדומיינים שונים

🔍 פתרון בעיות
שגיאהפתרון401בדקו את כותרת Authorization מול PROXY_TOKEN404ודאו שה-URL הוא /clientN/mcp ושקיימים ENV ללקוח Nשגיאות WPבדקו WPn_URL/USER/APP_PASS והרשאות המשתמשDataForSEOודאו DFS_USER/PASS ותוקף החשבוןלוגיםבדשבורד Coolify → Logs של האפליקציה
❓ שאלות נפוצות
האם כל הכלים זמינים באותה כתובת?
✅ כן — לכל לקוח יש כתובת אחת (/clientN/mcp) עם רשימת כלים מאוחדת (WP + DataForSEO). ההפרדה היא בין לקוחות, לא בין שירותים.
חייבים docker-compose?
❌ לא. פרסו כ-Dockerfile App (פשוט יותר).
