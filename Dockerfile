# syntax=docker/dockerfile:1

# Stage 1: Build Frontend and Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy workspace definitions
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY server/ ./server/
COPY web/ ./web/

# Build backend and frontend
RUN pnpm build

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3880 \
    HOST=0.0.0.0

# Install curl for container healthcheck
RUN apk add --no-cache curl && npm install -g pnpm

# Copy package manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled backend dist
COPY --from=builder /app/server/dist ./server/dist

# Copy backend static data and installer scripts
COPY --from=builder /app/server/data ./server/data

# Copy compiled frontend dist
COPY --from=builder /app/web/dist ./web/dist

# Expose default listening port
EXPOSE 3880

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3880/health || exit 1

# Start NodeMaster server
CMD ["node", "server/dist/index.js"]
