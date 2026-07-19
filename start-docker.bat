@echo off
rem Docker 一键启动（首次会构建镜像，约 3-5 分钟）

rem 检测 Docker 是否在运行
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未运行！
    echo 请先启动 Docker Desktop（开始菜单里找），等右下角小鲸鱼图标变绿后重试。
    pause
    exit /b 1
)

echo 构建并启动 job-agent（首次需下载依赖和模型，约 3-5 分钟）…
docker compose up -d --build
if %errorlevel% neq 0 (
    pause
    exit /b 1
)
echo.
echo ============================================
echo  前端: http://localhost:3000
echo  后端: http://localhost:8000
echo ============================================
echo.
echo 停止: docker compose down
echo 查看日志: docker compose logs -f
pause
