# ========== Stage 1: Build ==========
FROM node:22-alpine AS build

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/backend/package.json packages/backend/tsconfig.json ./packages/backend/
COPY packages/frontend/package.json packages/frontend/tsconfig*.json ./packages/frontend/
COPY packages/frontend/vite.config.ts ./packages/frontend/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source
COPY packages/backend/src ./packages/backend/src
COPY packages/frontend/src ./packages/frontend/src
COPY packages/frontend/index.html ./packages/frontend/

# Copy migration files
COPY packages/backend/src/db/migrations ./packages/backend/src/db/migrations

# Build backend (tsc) and frontend (vite)
RUN npm run build

# ========== Stage 2: Runtime ==========
FROM node:22-alpine

WORKDIR /app

# Copy workspace config for production install
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install production dependencies only
# sharp needs native binaries — rebuild after install
RUN npm ci --omit=dev && npm rebuild sharp

# Copy built backend
COPY --from=build /app/packages/backend/dist ./packages/backend/dist

# Copy migration SQL files (needed at runtime — __dirname resolves to dist/db/)
COPY --from=build /app/packages/backend/src/db/migrations ./packages/backend/dist/db/migrations

# Copy built frontend
COPY --from=build /app/packages/frontend/dist ./packages/frontend/dist

# Create data directories
RUN mkdir -p /app/data /app/uploads /app/output

# Environment
ENV NODE_ENV=production
ENV PORT=3003
ENV DB_PATH=/app/data/data.db
ENV UPLOADS_DIR=/app/uploads
ENV OUTPUT_DIR=/app/output
ENV FRONTEND_DIR=/app/packages/frontend/dist

EXPOSE 3003

CMD ["node", "packages/backend/dist/index.js"]
