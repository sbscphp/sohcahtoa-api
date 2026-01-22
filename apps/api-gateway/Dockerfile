FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api-gateway ./apps/api-gateway

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build application
WORKDIR /app/apps/api-gateway
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

RUN npm install -g pnpm

WORKDIR /app

# Copy built application
COPY --from=base /app/apps/api-gateway/dist ./dist
COPY --from=base /app/apps/api-gateway/package.json ./
COPY --from=base /app/apps/api-gateway/node_modules ./node_modules

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/index.js"]
