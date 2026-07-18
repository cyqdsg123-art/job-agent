@echo off
rem Docker 一键启动（首次会构建镜像，约 3-5 分钟）
echo 构建并启动 job-agent（首次需下载依赖和模型，约 3-5 分钟）…
docker compose up -d --build
echo.
echo 前端: http://localhost:3000
echo 后端: http://localhost:8000
echo 停止: docker compose down
echo 查看日志: docker compose logs -f
