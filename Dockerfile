# ---- BASE IMAGE ----
FROM node:20-alpine

# ---- ENV SETUP ----
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9090

# ---- DEPENDENCIES ----
COPY package*.json ./
RUN npm install --production

# ---- APP CODE ----
COPY . .

# ---- HEALTHCHECK ----
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:9090/health || exit 1

# ---- START ----
EXPOSE 9090
CMD ["node", "aggregator.js"]
