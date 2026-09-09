FROM node:20-alpine AS build
WORKDIR /app

# 依赖清单（从根 package.json 复制到 deploy/ 目录）
COPY deploy/package*.json ./
RUN npm ci

# 已编译产物
COPY dist ./dist

# 删除开发依赖
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app ./

ENV PORT=80
EXPOSE 80

CMD ["node", "dist/server.js"]