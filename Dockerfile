
FROM node:20-alpine AS build
WORKDIR /app

# 先复制依赖清单，利用 Docker 构建缓存
COPY package*.json ./
RUN npm ci

COPY . .

# 编译 + 删除dev包
RUN npm run ts:build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app ./

# 外部访问(宿主机入口是7000,防止80端口已被占用)7000，转发到docker的80端口
ENV PORT=80
EXPOSE 80

CMD ["node", "Backend/dist/server.js"]
