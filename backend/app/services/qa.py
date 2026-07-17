"""知识库问答：混合检索 → 带编号引用的流式回答。"""
import json

from .kb import hybrid_search
from .llm import chat_stream

_SYSTEM = """你是求职知识库助手。根据给定的【资料】回答用户问题：
- 回答中引用资料时标注编号，如 [1]、[2]
- 资料里没有的信息就直说"知识库中没有相关信息"，绝不编造
- 涉及多个岗位比较时用表格
- 用简洁的 Markdown 回答"""


def ask(question: str, top_k: int = 5):
    """生成器：("sources", list) → ("answer_delta", str)* → ("done", 全文)。"""
    sources = hybrid_search(question, top_k=top_k)
    yield "sources", sources

    if not sources:
        msg = "知识库还是空的：先在首页解析几个 JD，或在本页上传面经/资料。"
        yield "answer_delta", msg
        yield "done", msg
        return

    context = "\n\n".join(
        f"[{i + 1}]《{s['title']}》\n{s['text']}" for i, s in enumerate(sources)
    )
    user = f"【资料】\n{context}\n\n【问题】\n{question}"

    parts: list[str] = []
    for token in chat_stream(_SYSTEM, user):
        parts.append(token)
        yield "answer_delta", token
    yield "done", "".join(parts)
