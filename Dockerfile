# JScreator 后端 —— 微信云托管镜像
# 微信云托管要求容器监听 80 端口
FROM node:18-alpine

WORKDIR /app

# 先复制依赖清单，利用 Docker 构建缓存
COPY package*.json ./
RUN npm install --production

# 复制后端源码
COPY . .

# 云托管默认监听 80
ENV PORT=80
EXPOSE 80

CMD ["node", "server.js"]
