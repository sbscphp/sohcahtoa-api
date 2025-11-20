FROM node:18-alpine AS base
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/document-service ./apps/document-service
RUN pnpm install --frozen-lockfile
WORKDIR /app/apps/document-service
RUN pnpm prisma:generate && pnpm build

FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY --from=base /app/apps/document-service/dist ./dist
COPY --from=base /app/apps/document-service/package.json ./
COPY --from=base /app/apps/document-service/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/index.js"]
