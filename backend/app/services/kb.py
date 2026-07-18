"""知识库：切块 → 本地向量化(Chroma) + BM25 → RRF 融合的混合检索。

选型理由（见根目录 DECISIONS.md）：
- Chroma：单机零运维的持久化向量库，本项目数据量（百级文档）远达不到 Milvus 的场景
- 混合检索：JD 里满是精确技能词（如 "LangGraph"、"六级"），BM25 抓关键词，
  向量抓语义（"会英语的岗位" ≈ "英语六级"），RRF 融合两路排名
"""
import json
import re
import uuid

import chromadb
import jieba
from rank_bm25 import BM25Okapi
from sqlmodel import Session, select

from ..db import engine
from ..models import JobDescription, KBChunk, KBDoc
from .embedder import embed_docs, embed_query

_CHUNK_SIZE = 400   # 字符数：JD/面经以短段落为主，400 字能装下一个完整语义单元
_CHUNK_OVERLAP = 50

# Chroma 懒加载：模块导入时不打开数据库文件，避免 uvicorn 热重载时新旧进程争锁
import os as _os  # noqa: E402

_collection = None


def _get_collection():
    global _collection
    if _collection is None:
        chroma_path = _os.path.join(_os.environ.get("DATA_DIR", _os.getcwd()), "chroma_db")
        client = chromadb.PersistentClient(path=chroma_path)
        _collection = client.get_or_create_collection(
            "job_kb", metadata={"hnsw:space": "cosine"}
        )
    return _collection

# BM25 索引常驻内存，数据变更后置脏重建（语料在百级规模，重建是毫秒级）
_bm25: BM25Okapi | None = None
_bm25_chunks: list[KBChunk] = []
_dirty = True


def _tokenize(text: str) -> list[str]:
    return [t for t in jieba.lcut(text.lower()) if t.strip()]


def chunk_text(text: str) -> list[str]:
    """按段落聚合切块，超长段落再按窗口硬切。"""
    paras = [p.strip() for p in re.split(r"\n{2,}|\r\n{2,}", text) if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        if len(buf) + len(p) + 1 <= _CHUNK_SIZE:
            buf = f"{buf}\n{p}" if buf else p
            continue
        if buf:
            chunks.append(buf)
        buf = p
        while len(buf) > _CHUNK_SIZE:  # 超长段落硬切
            chunks.append(buf[:_CHUNK_SIZE])
            buf = buf[_CHUNK_SIZE - _CHUNK_OVERLAP:]
    if buf:
        chunks.append(buf)
    return chunks


def _mark_dirty():
    global _dirty
    _dirty = True


def _ensure_bm25():
    global _bm25, _bm25_chunks, _dirty
    if not _dirty:
        return
    with Session(engine) as s:
        _bm25_chunks = list(s.exec(select(KBChunk)).all())
    corpus = [_tokenize(c.text) for c in _bm25_chunks]
    _bm25 = BM25Okapi(corpus) if corpus else None
    _dirty = False


def add_document(title: str, text: str, source: str, doc_id: str | None = None) -> str:
    """入库一份文档：按段落切块后入库。可重复调用（覆盖同 id）。"""
    return add_document_chunks(title, chunk_text(text), source, doc_id)


def add_document_chunks(
    title: str, chunks: list[str], source: str, doc_id: str | None = None
) -> str:
    """入库预切好块的文档（代码仓库等自定义切块场景直接用这个）。"""
    doc_id = doc_id or f"doc-{uuid.uuid4().hex[:8]}"
    remove_document(doc_id)  # 幂等：先清旧数据

    chunks = [c for c in chunks if c.strip()]
    if not chunks:
        raise ValueError("文档内容为空")

    embeddings = embed_docs(chunks)
    ids = [f"{doc_id}-{i}" for i in range(len(chunks))]
    _get_collection().add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"doc_id": doc_id, "title": title} for _ in chunks],
    )
    with Session(engine) as s:
        s.add(KBDoc(id=doc_id, title=title, source=source))
        for i, c in enumerate(chunks):
            s.add(KBChunk(id=ids[i], doc_id=doc_id, seq=i, title=title, text=c))
        s.commit()
    _mark_dirty()
    return doc_id


def index_jd(row: JobDescription) -> str:
    """把一条已解析的 JD 索引进知识库（幂等，doc_id = jd-{id}）。"""
    skills = json.loads(row.skills_json)
    duties = json.loads(row.duties_json)
    bonus = json.loads(row.bonus_json)
    text = "\n\n".join(filter(None, [
        f"岗位：{row.title}\n公司：{row.company}\n地点：{row.location}\n"
        f"薪资：{row.salary}\n学历要求：{row.education}",
        ("技能要求：\n" + "\n".join(skills)) if skills else "",
        ("岗位职责：\n" + "\n".join(duties)) if duties else "",
        ("加分项：\n" + "\n".join(bonus)) if bonus else "",
    ]))
    return add_document(
        title=f"{row.title}（{row.company}）",
        text=text,
        source="jd",
        doc_id=f"jd-{row.id}",
    )


def remove_document(doc_id: str) -> None:
    with Session(engine) as s:
        doc = s.get(KBDoc, doc_id)
        if doc:
            s.delete(doc)
        for c in s.exec(select(KBChunk).where(KBChunk.doc_id == doc_id)).all():
            s.delete(c)
        s.commit()
    try:
        _get_collection().delete(where={"doc_id": doc_id})
    except Exception:
        pass
    _mark_dirty()


def list_documents() -> list[KBDoc]:
    with Session(engine) as s:
        return list(s.exec(select(KBDoc).order_by(KBDoc.created_at.desc())).all())


def hybrid_search(
    query: str, top_k: int = 5, candidate_n: int = 15, doc_id: str | None = None
) -> list[dict]:
    """向量检索 + BM25 各取 candidate_n 条，RRF（k=60）融合后返回 top_k。

    doc_id 非空时只在该文档内检索（如限定某个代码仓库）。
    """
    _ensure_bm25()
    rrf: dict[str, float] = {}
    hit_channel: dict[str, set] = {}

    # 通道一：向量（语义）
    col = _get_collection()
    if col.count() > 0:
        res = col.query(
            query_embeddings=[embed_query(query)],
            n_results=min(candidate_n, col.count()),
            where={"doc_id": doc_id} if doc_id else None,
        )
        for rank, cid in enumerate(res["ids"][0]):
            rrf[cid] = rrf.get(cid, 0) + 1 / (60 + rank + 1)
            hit_channel.setdefault(cid, set()).add("vector")

    # 通道二：BM25（关键词）
    if _bm25 is not None:
        scores = _bm25.get_scores(_tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        picked = 0
        for idx in ranked:
            if scores[idx] <= 0 or picked >= candidate_n:
                break
            chunk = _bm25_chunks[idx]
            if doc_id and chunk.doc_id != doc_id:
                continue
            rrf[chunk.id] = rrf.get(chunk.id, 0) + 1 / (60 + picked + 1)
            hit_channel.setdefault(chunk.id, set()).add("bm25")
            picked += 1

    top_ids = sorted(rrf, key=rrf.get, reverse=True)[:top_k]
    if not top_ids:
        return []

    with Session(engine) as s:
        rows = {c.id: c for c in s.exec(select(KBChunk).where(KBChunk.id.in_(top_ids))).all()}
    return [
        {
            "chunk_id": cid,
            "doc_id": rows[cid].doc_id,
            "title": rows[cid].title,
            "text": rows[cid].text,
            "channels": sorted(hit_channel.get(cid, [])),
            "rrf_score": round(rrf[cid], 5),
        }
        for cid in top_ids if cid in rows
    ]
