FROM node:18-alpine AS base
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/transaction-service ./apps/transaction-service
RUN pnpm install --frozen-lockfile
WORKDIR /app/apps/transaction-service
RUN pnpm prisma:generate
RUN pnpm build

FROM node:18-alpine AS production
RUN npm install -g pnpm
WORKDIR /app
COPY --from=base /app/apps/transaction-service/dist ./dist
COPY --from=base /app/apps/transaction-service/package.json ./
COPY --from=base /app/apps/transaction-service/prisma ./prisma
COPY --from=base /app/apps/transaction-service/node_modules ./node_modules
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3003
CMD ["node", "dist/index.js"]
