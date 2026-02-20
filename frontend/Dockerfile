# syntax=docker/dockerfile:1.4
# Multi-stage build for React frontend - optimized for fast rebuilds

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for API configuration
ARG VITE_API_BASE_URL=http://localhost:39100
ARG VITE_API_PORT=39100
ARG VITE_SENTRY_DSN=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_PORT=${VITE_API_PORT}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

# Copy package files first (for layer caching)
COPY package*.json ./

# Install dependencies with BuildKit cache mount
# npm ci is faster than npm install (skips dependency resolution)
# Cache mount preserves npm cache between builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Manually install rollup binary for Alpine (fixes optional dependency issue)
RUN --mount=type=cache,target=/root/.npm \
    npm install @rollup/rollup-linux-x64-musl --save-optional

# Copy source code (changes frequently, comes last)
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production with nginx
FROM nginx:alpine

# Create non-root user for nginx
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser && \
    chown -R appuser:appuser /var/cache/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    chown -R appuser:appuser /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appuser /var/run/nginx.pid && \
    chown -R appuser:appuser /usr/share/nginx/html

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Switch to non-root user
USER appuser

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
