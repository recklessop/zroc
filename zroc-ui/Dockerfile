# Stage 1: Build the React SPA
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Install backend production dependencies
FROM node:20-alpine AS backend-builder

WORKDIR /build/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev --prefer-offline

# Stage 3: Production image
FROM node:20-alpine AS production

RUN addgroup -S zroc && adduser -S zroc -G zroc

WORKDIR /app

COPY backend/ ./backend/
COPY --from=backend-builder /build/backend/node_modules ./backend/node_modules
COPY --from=frontend-builder /build/frontend/dist ./dist

RUN mkdir -p /app/data && chown zroc:zroc /app/data
VOLUME ["/app/data"]

USER zroc

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "backend/server.js"]
