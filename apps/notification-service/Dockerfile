FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY apps/notification-service/package.json ./
COPY apps/notification-service/src ./src
COPY apps/notification-service/tsconfig.json ./
RUN pnpm install && pnpm build
EXPOSE 3006
CMD ["node", "dist/index.js"]
