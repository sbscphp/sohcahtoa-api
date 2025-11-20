FROM node:18-alpine AS base
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/compliance-service ./apps/compliance-service
RUN pnpm install --frozen-lockfile
WORKDIR /app/apps/compliance-service
RUN pnpm prisma:generate && pnpm build

FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY --from=base /app/apps/compliance-service/dist ./dist
COPY --from=base /app/apps/compliance-service/package.json ./
COPY --from=base /app/apps/compliance-service/node_modules ./node_modules
EXPOSE 3005
CMD ["node", "dist/index.js"]
