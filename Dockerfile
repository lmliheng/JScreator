# JScreator 后端 —— 微信云托管镜像（P1：TS 两段式构建，入口 Backend/dist/server.js）
# 微信云托管要求容器监听 80 端口

# ---------- build 阶段：安装全部依赖（含 devDeps）并编译 TS，随后剔除 devDeps ----------
FROM node:20-alpine AS build
WORKDIR /app

# 先复制依赖清单，利用 Docker 构建缓存
COPY package*.json ./
RUN npm ci

# 复制后端源码（.dockerignore 已排除 node_modules/前端/文档/.env）
COPY . .

# 编译 Backend TS -> Backend/dist，然后移除 devDependencies
RUN npm run ts:build && npm prune --omit=dev

# ---------- run 阶段：只保留运行依赖与构建产物 ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app ./

# 云托管默认监听 80
ENV PORT=80
EXPOSE 80

CMD ["node", "Backend/dist/server.js"]
