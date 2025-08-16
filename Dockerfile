FROM node:22-alpine

RUN apk add --no-cache bash gettext

# כלים גלובליים
RUN npm i -g mcp-proxy@latest \
             @automattic/mcp-wordpress-remote@latest \
             dataforseo-mcp-server@latest

WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh
COPY aggregator.js /app/aggregator.js
COPY upstreams.template.json /app/upstreams.template.json
RUN chmod +x /app/entrypoint.sh

EXPOSE 9090
ENTRYPOINT ["/app/entrypoint.sh"]
