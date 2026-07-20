# ---- 构建阶段 ----
# 国内无法直连 Docker Hub，使用 docker.m.daocloud.io 镜像
FROM docker.m.daocloud.io/library/node:24-alpine AS builder
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=${BACKEND_URL}
WORKDIR /app
COPY package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM docker.m.daocloud.io/library/node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone 模式下只需这三个目录
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# standalone 产物自带 server.js，直接 node 启动
CMD ["node", "server.js"]
