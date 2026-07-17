"""FastAPI 入口。启动：uvicorn app.main:app --reload --port 8000"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import jd, kb, match


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="求职助手 Agent", lifespan=lifespan)

# 前端开发服务器跨域放行
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jd.router)
app.include_router(match.router)
app.include_router(kb.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
