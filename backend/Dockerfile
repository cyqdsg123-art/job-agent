# 国内无法直连 Docker Hub，使用 docker.m.daocloud.io 镜像
FROM docker.m.daocloud.io/library/python:3.13-slim

WORKDIR /app

# 系统依赖：pymupdf 渲染 PDF 需要，git-lfs 用于从魔搭下载模型
RUN apt-get update && apt-get install -y --no-install-recommends \
    git git-lfs \
    && rm -rf /var/lib/apt/lists/*

RUN git lfs install

# Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 本地 BGE embedding 模型（从魔搭下载）
RUN mkdir -p models && \
    cd models && \
    git clone --depth 1 https://www.modelscope.cn/BAAI/bge-small-zh-v1.5.git && \
    rm -rf bge-small-zh-v1.5/.git

# 应用代码
COPY . .

# 数据库和 Chroma 向量库数据用卷挂载，不入镜像
VOLUME ["/app/data"]

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
