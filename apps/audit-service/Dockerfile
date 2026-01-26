FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps/audit-service ./apps/audit-service

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter "@fx-platform/shared-types" build
RUN pnpm --filter "@fx-platform/shared-utils" build
RUN pnpm --filter "@fx-platform/shared-middlewares" build

# Generate Prisma client and build
WORKDIR /app/apps/audit-service

# Set NODE_PATH for build stage
ENV NODE_PATH=/app/node_modules

RUN pnpm prisma:generate && pnpm build

# Production stage
FROM node:18-alpine AS production

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace configuration
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/pnpm-lock.yaml ./

# Copy shared packages (built)
COPY --from=base /app/packages ./packages

# Copy built application
COPY --from=base /app/apps/audit-service/dist ./apps/audit-service/dist
COPY --from=base /app/apps/audit-service/package.json ./apps/audit-service/
COPY --from=base /app/apps/audit-service/prisma ./apps/audit-service/prisma

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Generate Prisma Client for production
WORKDIR /app/apps/audit-service
RUN /app/node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

# Set NODE_PATH to resolve modules from root node_modules
ENV NODE_PATH=/app/node_modules

# Expose port
EXPOSE 3008

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3008/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/index.js"]
