# 🎯 求职助手 Agent（Job Agent）

> 上传招聘截图 → 自动 OCR + LLM 结构化解析 → 简历逐维度匹配打分 → 流式生成差距分析与投递话术。
> 一个"吃自己的狗粮"的全栈 AI Agent 项目：我用它来找 AI 应用开发实习。

## ✨ 功能

| 功能 | 说明 |
|---|---|
| **JD 截图解析** | 上传 Boss 直聘等 App 的职位截图，RapidOCR 离线识别 + DeepSeek JSON 模式结构化提取（岗位/薪资/技能/职责/加分项），自动过滤界面噪声与 OCR 错字 |
| **JD 链接导入** | 粘贴公开职位页 URL（公司官网/校招网站/实习僧等），trafilatura 抽取正文后走同一解析管线；含 SSRF 防护，登录墙/JS 页面给出可读指引 |
| **简历-JD 匹配** | LangGraph 三节点状态图：简历画像提取 → 逐维度打分（技能/项目/学历/加分项）→ 差距分析与改进建议，最后一步 **SSE 流式输出**，前端打字机渲染 |
| **岗位知识库问答（RAG）** | 解析的 JD 自动入库 + 支持上传面经/资料（PDF 自动 OCR 兜底、图片 OCR、txt/md）；**混合检索（本地 BGE 向量 + BM25 + RRF 融合）**，回答带编号引用，检索质量见 [EVALS.md](EVALS.md) |
| **投递话术生成** | 报告末尾自动生成 100 字以内、可直接发给招聘者的打招呼语 |

> 关键选型的"为什么"（LangGraph vs Dify、Chroma vs Milvus、RRF vs 加权、SSE vs WebSocket…）见 [DECISIONS.md](DECISIONS.md)。

## 🏗 架构

```
招聘截图 ─→ RapidOCR（离线）─→ DeepSeek JSON 模式 ─→ SQLite
                                                      │
简历(PDF/文本) ─→ LangGraph StateGraph ──────────────┤
   profile_extract → dimension_score → gap_advice     │
        (JSON)          (JSON)        (Token 流)       ▼
                            └─ SSE ─→ Next.js 前端流式渲染
```

- **后端**：FastAPI + LangGraph + SQLModel(SQLite) + RapidOCR + sse-starlette
- **前端**：Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + react-markdown
- **模型**：DeepSeek（OpenAI 兼容接口，可一行配置切换任意厂商）

## 🚀 快速开始

### Docker 一键部署（推荐）

```bash
# 1. 配置 API Key
cp .env.example .env   # 编辑 .env 填入 DEEPSEEK_API_KEY

# 2. 启动
docker compose up -d --build
```
> 首次构建约 3-5 分钟（含依赖下载和 BGE 模型拉取）。启动后 http://localhost:3000 。

### 本地开发

#### 1. 后端

```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # Linux/Mac: venv/bin/pip

# 配置 API Key（https://platform.deepseek.com 注册获取）
cp .env.example .env    # 编辑 .env 填入 DEEPSEEK_API_KEY

# 下载本地 embedding 模型（RAG 知识库用，~100MB，从魔搭拉取无需梯子）
git clone --depth 1 https://www.modelscope.cn/BAAI/bge-small-zh-v1.5.git models/bge-small-zh-v1.5

venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

### 3. 使用

1. 打开 http://localhost:3000 ，上传一张职位详情截图 → 查看结构化解析结果
2. 进入「简历匹配」页，粘贴简历文本或上传 PDF → 实时查看画像、评分与建议

## 📁 项目结构

```
backend/app/
├── main.py              # FastAPI 入口
├── config.py            # .env 配置（pydantic-settings）
├── db.py / models.py    # SQLite + SQLModel
├── routers/
│   ├── jd.py            # 截图解析、JD 增删查
│   └── match.py         # SSE 流式匹配
└── services/
    ├── ocr.py           # RapidOCR 封装
    ├── llm.py           # DeepSeek 客户端（JSON 模式 / 流式）
    ├── jd_parser.py     # JD 结构化提取 prompt
    ├── resume.py        # PDF 简历解析
    └── matcher.py       # LangGraph 三节点匹配 Agent ⭐
frontend/
├── app/page.tsx         # 截图上传解析页
├── app/jd/page.tsx      # JD 列表页
├── app/match/page.tsx   # 匹配报告页（SSE 流式渲染）
├── lib/api.ts           # API 封装 + SSE 解析器
└── components/JDCard.tsx
```

## 🗺 Roadmap

- [ ] 定制求职信/自我介绍生成
- [ ] 基于 JD 的模拟面试（多轮对话 + 回答点评）
- [ ] 多 JD 横向对比（哪个岗位最适合我）
- [ ] OpenClaw 技能插件形态：招聘信息监控 + 自动整理
