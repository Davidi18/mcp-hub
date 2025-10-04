FROM node:22-alpine

RUN apk add --no-cache bash gettext

# Global MCP tools
RUN npm i -g mcp-proxy@latest \
             @automattic/mcp-wordpress-remote@latest \
             dataforseo-mcp-server@latest

WORKDIR /app

# Copy application files
COPY package.json /app/package.json
COPY entrypoint.sh /app/entrypoint.sh
COPY aggregator.js /app/aggregator.js
COPY wp-dynamic-proxy.js /app/wp-dynamic-proxy.js
COPY rate-limiter.js /app/rate-limiter.js
COPY cache-manager.js /app/cache-manager.js
COPY analytics-logger.js /app/analytics-logger.js

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9090/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

EXPOSE 9090

ENTRYPOINT ["/app/entrypoint.sh"]
