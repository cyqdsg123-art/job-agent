"""模拟面试官：基于 JD + 简历出题、逐轮点评追问、生成总结报告。

多轮状态存 SQLite（rounds_json）而非 LangGraph checkpointer——
线性问答对话不需要图分支，DB 存历史更直观、可回看（见 DECISIONS.md #11）。
"""
import json

from .kb import hybrid_search
from .llm import chat_json, chat_stream

MAX_ROUNDS = 5

_PERSONA = """你是一位严格但友善的技术面试官，正在面试一名候选人。
面试原则：
- 优先深挖候选人简历里写的项目和技能（防止"简历写了但说不出"）
- 结合 JD 的技能要求出题，难度贴合实习/校招水平
- 题目具体、可回答，一次只问一个问题，不出笼统的"谈谈你对XX的理解"
"""


def _context(jd: dict, resume_text: str, rounds: list[dict]) -> str:
    parts = [
        f"【岗位 JD】\n{json.dumps(jd, ensure_ascii=False)}",
        f"【候选人简历】\n{resume_text}",
    ]
    # 知识库里如有相关面经，给面试官做参考
    refs = hybrid_search(f"{jd.get('title', '')} 面试 常见问题", top_k=2)
    ref_texts = [r["text"] for r in refs if r.get("doc_id", "").startswith("doc-")]
    if ref_texts:
        parts.append("【面经参考】\n" + "\n---\n".join(ref_texts))
    if rounds:
        history = "\n".join(
            f"第{i + 1}题：{r['q']}\n候选人回答：{r['a']}" for i, r in enumerate(rounds) if r.get("a")
        )
        parts.append(f"【已进行的轮次】\n{history}")
    return "\n\n".join(parts)


def make_question(jd: dict, resume_text: str, rounds: list[dict]) -> dict:
    """出下一题。返回 {"question": ..., "focus": 考察点}。"""
    system = _PERSONA + """
根据材料出下一道面试题，输出 JSON：{"question": "题目", "focus": "考察点（一句话）"}
要求：不与已问过的题目重复；题型在"项目深挖 / 技术原理 / 场景设计"之间轮换。只输出 JSON。"""
    data = chat_json(system, _context(jd, resume_text, rounds))
    return {"question": str(data.get("question", "")), "focus": str(data.get("focus", ""))}


def stream_feedback(jd: dict, resume_text: str, rounds: list[dict], question: str, answer: str):
    """对刚才的回答做点评（流式）。"""
    system = _PERSONA + """
候选人刚回答了你的问题。请给出简短点评（150 字内，Markdown）：
- 答得好的点（如有）
- 不足或遗漏的关键点
- 一句"更好的回答思路"
点评要具体、可操作，不要客套。"""
    user = _context(jd, resume_text, rounds) + f"\n\n【本题】{question}\n【候选人回答】{answer}"
    yield from chat_stream(system, user)


def stream_report(jd: dict, resume_text: str, rounds: list[dict]):
    """全部轮次结束后的总结报告（流式）。"""
    system = _PERSONA + """
面试结束。请输出 Markdown 总结报告：
## 面试评分
表格：轮次 | 题目考察点 | 表现（0-100）| 一句话评价
## 总体评价
候选人相对该岗位的优势与主要短板（各 2-3 条，引用具体回答为证）
## 提升建议
3 条可执行建议（复习什么、项目补什么、表达怎么改进）
评分要有区分度，依据必须来自候选人的实际回答。"""
    rounds_full = "\n\n".join(
        f"第{i + 1}题（{r.get('focus', '')}）：{r['q']}\n回答：{r['a']}\n当轮点评：{r.get('feedback', '')}"
        for i, r in enumerate(rounds)
    )
    user = (
        f"【岗位 JD】\n{json.dumps(jd, ensure_ascii=False)}\n\n"
        f"【候选人简历】\n{resume_text}\n\n【完整轮次记录】\n{rounds_full}"
    )
    yield from chat_stream(system, user)
