
FROM node:20-alpine AS build
WORKDIR /app

# 先复制依赖清单，利用 Docker 构建缓存
COPY package*.json ./
RUN npm ci

COPY . .

# 编译 Backend TS -> Backend/dist，然后移除 devDependencies
RUN npm run ts:build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app ./

ENV PORT=80
EXPOSE 80

CMD ["node", "Backend/dist/server.js"]
