FROM node:22-alpine

# 🧩 מערכת בסיסית
RUN apk add --no-cache bash gettext curl

# 🪄 התקנת גרסה ספציפית ומתוקנת של MCP WordPress
RUN npm install -g @automattic/mcp-wordpress-remote@2.1.1

WORKDIR /app

# 📦 העתקת קבצי האפליקציה
COPY package.json /app/package.json
COPY entrypoint.sh /app/entrypoint.sh
COPY aggregator.js /app/aggregator.js
COPY rate-limiter.js /app/rate-limiter.js
COPY cache-manager.js /app/cache-manager.js
COPY analytics-logger.js /app/analytics-logger.js
COPY wordpress-mcp-server.js /app/wordpress-mcp-server.js

# 🧰 מתן הרשאות הרצה
RUN chmod +x /app/entrypoint.sh /app/wordpress-mcp-server.js

# 🩺 בדיקת בריאות השירות
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9090/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

EXPOSE 9090

ENTRYPOINT ["/app/entrypoint.sh"]
