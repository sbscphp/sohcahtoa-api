FROM node:18-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY apps/api-gateway/package.json ./
COPY apps/api-gateway/src ./src
COPY apps/api-gateway/tsconfig.json ./
RUN pnpm install && pnpm build
EXPOSE 3000
CMD ["node", "dist/index.js"]
