FROM node:20-alpine

RUN apk add --no-cache bash gettext

# CLI גלובליים: הפרוקסי המאגד + שרתי משנה
RUN npm i -g @tbxark/mcp-proxy@latest \
              @automattic/mcp-wordpress-remote@latest \
              dataforseo-mcp-server@latest

WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh
COPY config.template.json /app/config.template.json
RUN chmod +x /app/entrypoint.sh

EXPOSE 9090
ENTRYPOINT ["/app/entrypoint.sh"]
