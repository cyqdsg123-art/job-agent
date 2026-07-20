#!/bin/bash
set -e
echo "=== 求职助手 Agent 部署 ==="

# 1. 等待 pip 完成（如果还在跑）
if ps aux | grep -q "[p]ip"; then
    echo "pip 还在安装中，等待完成..."
    while ps aux | grep -q "[p]ip"; do sleep 10; done
    echo "pip 完成"
fi

# 2. 检查 Python 依赖
/root/job-agent/backend/venv/bin/python -c "import fastapi, langgraph; print('Python依赖 OK')" || {
    echo "依赖缺失，重新安装..."
    cd /root/job-agent/backend
    venv/bin/pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
}

# 3. BGE 模型
if [ ! -d /root/job-agent/backend/models/bge-small-zh-v1.5 ]; then
    echo "下载 BGE 模型..."
    cd /root/job-agent/backend
    mkdir -p models
    cd models
    git clone --depth 1 https://www.modelscope.cn/BAAI/bge-small-zh-v1.5.git
fi
echo "模型 OK"

# 4. Nginx
cat > /etc/nginx/sites-available/default << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINXEOF
nginx -t && systemctl restart nginx
echo "Nginx OK"

# 5. 启动后端
pkill -f uvicorn 2>/dev/null || true
sleep 1
cd /root/job-agent/backend
nohup venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /var/log/job-agent-backend.log 2>&1 &
echo "后端 PID=$!"

# 6. 启动前端
pkill -f "node server.js" 2>/dev/null || true
sleep 1
cd /opt/job-agent-frontend/.next/standalone
PORT=3000 nohup node server.js > /var/log/job-agent-frontend.log 2>&1 &
echo "前端 PID=$!"

# 7. 等待验证
sleep 8
echo "--- 健康检查 ---"
curl -s http://127.0.0.1:8000/api/health || echo "后端异常"
echo ""
curl -s -o /dev/null -w "前端HTTP: %{http_code}\n" http://127.0.0.1:3000/ || echo "前端异常"
echo "--- 完成 ---"
echo "公网访问: http://60.205.214.68"
