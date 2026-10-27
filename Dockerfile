# syntax=docker/dockerfile:1

# Stage 1: Build Frontend and Backend (runs natively on build platform)
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

# Install pnpm (pinned for reproducible lockfile handling)
RUN npm install -g pnpm@11.17.0

# Copy workspace definitions
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY shared/ ./shared/
COPY server/ ./server/
COPY web/ ./web/

# Build backend and frontend
RUN pnpm build

# Deploy isolated server production dependencies (runs on native host, avoids QEMU emulation)
RUN pnpm --filter ./server --prod deploy --legacy /prod/server

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Runtime state lives in /app/server/data (mount a volume here);
# bundled installer scripts and templates live in /app/server/assets so a mounted
# data volume can neither hide them nor pin them to an old release.
ENV NODE_ENV=production \
    PORT=3880 \
    HOST=0.0.0.0 \
    NODEMASTER_DATA_DIR=/app/server/data \
    NODEMASTER_ASSETS_DIR=/app/server/assets

# Node resolves TZ (daily traffic buckets start at local midnight) from its bundled ICU data;
# tzdata keeps OS-level times (logs, shell tools) in the same zone, since alpine ships none
RUN apk add --no-cache tzdata

# Copy isolated production dependencies from builder stage
COPY --from=builder /prod/server/node_modules ./server/node_modules
COPY --from=builder /prod/server/package.json ./server/package.json

# Copy compiled backend dist
COPY --from=builder /app/server/dist ./server/dist

# Copy installer scripts, probe agent and templates
COPY --from=builder /app/server/data ./server/assets
RUN mkdir -p ./server/data

# Copy compiled frontend dist
COPY --from=builder /app/web/dist ./web/dist

# Expose default listening port
EXPOSE 3880

# Health check (busybox wget ships with alpine; no extra packages needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/health" || exit 1

# Start NodeMaster server
CMD ["node", "server/dist/index.js"]
