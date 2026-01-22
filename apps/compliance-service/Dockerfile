FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/compliance-service ./apps/compliance-service

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client and build
WORKDIR /app/apps/compliance-service
RUN pnpm prisma:generate && pnpm build

# Production stage
FROM node:18-alpine AS production

RUN npm install -g pnpm

WORKDIR /app

# Copy built application
COPY --from=base /app/apps/compliance-service/dist ./dist
COPY --from=base /app/apps/compliance-service/package.json ./
COPY --from=base /app/apps/compliance-service/prisma ./prisma
COPY --from=base /app/apps/compliance-service/node_modules ./node_modules
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/index.js"]
