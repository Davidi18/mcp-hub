FROM node:22-alpine

RUN apk add --no-cache bash gettext curl git

# 🪄 התקנת MCP WordPress ישירות מגיטהאב (כולל כל התיקונים האחרונים)
RUN npm install -g "git+https://github.com/Automattic/mcp-wordpress-remote.git#trunk"
WORKDIR /app

COPY package.json /app/package.json
COPY entrypoint.sh /app/entrypoint.sh
COPY aggregator.js /app/aggregator.js
COPY rate-limiter.js /app/rate-limiter.js
COPY cache-manager.js /app/cache-manager.js
COPY analytics-logger.js /app/analytics-logger.js
COPY wordpress-mcp-server.js /app/wordpress-mcp-server.js

RUN chmod +x /app/entrypoint.sh /app/wordpress-mcp-server.js

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9090/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

EXPOSE 9090

ENTRYPOINT ["/app/entrypoint.sh"]
