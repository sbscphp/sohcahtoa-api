# Multi-stage build for Sochatoa API Monolith

# Stage 1: Builder
FROM node:18-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Copy package files
COPY package.json ./
COPY package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:18-slim

WORKDIR /app

# Install OpenSSL for Prisma and netcat for health checks
RUN apt-get update -y && apt-get install -y openssl netcat-openbsd && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json ./
COPY package-lock.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application and Prisma client from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]

# Start application
CMD ["node", "dist/index.js"]
