"""本地 Embedding：BAAI/bge-small-zh-v1.5（sentence-transformers）。

选型理由（见根目录 DECISIONS.md）：DeepSeek 无 embedding 接口；
本地小模型免费、离线、无隐私外泄，中文检索效果够用。
模型走 hf-mirror.com 下载（国内可达），首次加载约下载 100MB。
"""
import os
from pathlib import Path

# 必须在 import sentence_transformers 之前设置镜像
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

# 优先用本地模型目录（从魔搭 git clone 下来，见 README），否则走 HF 镜像在线下载
_LOCAL_MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "models" / "bge-small-zh-v1.5"
_MODEL_ID = str(_LOCAL_MODEL_DIR) if _LOCAL_MODEL_DIR.exists() else "BAAI/bge-small-zh-v1.5"

_model = None

# bge 中文模型官方建议：查询侧加指令前缀，文档侧不加
_QUERY_INSTRUCTION = "为这个句子生成表示以用于检索相关文章："


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # 延迟导入，加快启动
        _model = SentenceTransformer(_MODEL_ID)
    return _model


def embed_docs(texts: list[str]) -> list[list[float]]:
    return _get_model().encode(texts, normalize_embeddings=True).tolist()


def embed_query(text: str) -> list[float]:
    return _get_model().encode(
        [_QUERY_INSTRUCTION + text], normalize_embeddings=True
    ).tolist()[0]
