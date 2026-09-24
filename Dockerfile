# Schoolzone: one container serving the app and the API.
# Data (database and backups) lives in /data, which should be a persistent volume.
FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_PATH=/data/schoolzone.db \
    BACKUP_DIR=/data/backups

# Run as the unprivileged "node" user, with write access only to /data.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npx", "tsx", "server/index.ts"]
