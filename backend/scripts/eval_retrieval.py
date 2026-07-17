"""检索质量评测：对比 向量 / BM25 / 混合(RRF) 三种策略的命中率。

用法（在 backend 目录下）：
    venv/Scripts/python -m scripts.eval_retrieval

评测集：每条 = (查询, 期望命中的 doc_id)。查询刻意混合两类：
- 语义型（不含原文关键词，考验向量通道）
- 关键词型（含精确术语，考验 BM25 通道）
结果写入 ../EVALS.md。
"""
import sys
import time
from pathlib import Path

# Windows GBK 控制台打印 emoji 会报错，强制 utf-8 输出
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import kb  # noqa: E402
from app.services.embedder import embed_query  # noqa: E402

# (查询, 期望 doc_id 前缀, 类型)
EVAL_SET = [
    # 语义型：不含 JD 原文的字面关键词
    ("有没有可以边上学边做的工作", "jd-", "语义"),
    ("对外语水平有要求的岗位", "jd-2", "语义"),
    ("做人工智能产品研发的职位", "jd-2", "语义"),
    ("在福建的互联网工作", "jd-1", "语义"),
    # 关键词型：含精确术语
    ("AIGC 全栈", "jd-1", "关键词"),
    ("英语六级", "jd-2", "关键词"),
    ("模型训练与部署", "jd-2", "关键词"),
    ("OpenClaw", "jd-1", "关键词"),
]

TOP_K = 3


def _vector_only(query: str, top_k: int) -> list[str]:
    col = kb._get_collection()
    res = col.query(
        query_embeddings=[embed_query(query)],
        n_results=min(top_k, col.count()),
    )
    return [m["doc_id"] for m in res["metadatas"][0]]


def _bm25_only(query: str, top_k: int) -> list[str]:
    kb._ensure_bm25()
    if kb._bm25 is None:
        return []
    scores = kb._bm25.get_scores(kb._tokenize(query))
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return [kb._bm25_chunks[i].doc_id for i in ranked[:top_k] if scores[i] > 0]


def _hybrid(query: str, top_k: int) -> list[str]:
    return [s["doc_id"] for s in kb.hybrid_search(query, top_k=top_k)]


def run() -> str:
    strategies = {"向量": _vector_only, "BM25": _bm25_only, "混合(RRF)": _hybrid}
    lines = [
        "# 检索质量评测（EVALS.md）",
        "",
        f"- 评测集：{len(EVAL_SET)} 条查询（语义型 / 关键词型各半），指标 Hit@{TOP_K}",
        f"- 知识库规模：{len(kb.list_documents())} 篇文档",
        "",
        "| 策略 | 总命中率 | 语义型 | 关键词型 | 平均耗时 |",
        "|---|---|---|---|---|",
    ]
    detail = ["", "## 逐条明细", "", "| 查询 | 类型 | 向量 | BM25 | 混合 |", "|---|---|---|---|---|"]
    per_case: dict[str, list[bool]] = {}

    for name, fn in strategies.items():
        hits = {"语义": [], "关键词": []}
        t0 = time.perf_counter()
        for query, expect, qtype in EVAL_SET:
            got = fn(query, TOP_K)
            hit = any(d.startswith(expect) for d in got)
            hits[qtype].append(hit)
            per_case.setdefault(query, []).append(hit)
        elapsed = (time.perf_counter() - t0) / len(EVAL_SET) * 1000
        total = hits["语义"] + hits["关键词"]
        lines.append(
            f"| {name} | {sum(total)}/{len(total)} | "
            f"{sum(hits['语义'])}/{len(hits['语义'])} | "
            f"{sum(hits['关键词'])}/{len(hits['关键词'])} | {elapsed:.0f}ms |"
        )

    for (query, _, qtype), marks in zip(EVAL_SET, per_case.values()):
        detail.append(
            f"| {query} | {qtype} | " + " | ".join("✅" if m else "❌" for m in marks) + " |"
        )

    report = "\n".join(lines + detail) + "\n"
    out = Path(__file__).resolve().parent.parent.parent / "EVALS.md"
    out.write_text(report, encoding="utf-8")
    print(report)
    print(f"已写入 {out}")
    return report


if __name__ == "__main__":
    run()
