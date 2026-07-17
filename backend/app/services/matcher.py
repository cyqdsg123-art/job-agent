"""简历-JD 匹配 Agent：LangGraph 三节点状态图。

图结构：
    profile_extract（简历 → 技能画像）
        ↓
    dimension_score（对照 JD 逐维度打分）
        ↓
    gap_advice（差距分析 + 改进建议，流式输出）

前两个节点产出结构化 JSON（通过 updates 流推给前端），
第三个节点用 StreamWriter 把 token 增量通过 custom 流推给前端。
"""
import json
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import StreamWriter

from .llm import chat_json, chat_stream


class MatchState(TypedDict, total=False):
    jd: dict            # 结构化 JD（JDOut 的 dict 形式）
    resume_text: str    # 简历纯文本
    profile: dict       # 简历画像
    scores: dict        # 维度评分
    advice: str         # 完整建议文本


# ---------- 节点 1：简历画像提取 ----------

_PROFILE_SYSTEM = """你是简历分析助手。从用户提供的简历文本中提取候选人画像，输出 JSON：
{
  "education": "最高学历与院校专业",
  "skills": ["掌握的技能，逐条"],
  "projects": [{"name": "项目名", "highlights": "一句话亮点"}],
  "experience": "实习/工作经历一句话概括，没有则为空串"
}
只输出 JSON。"""


def profile_extract(state: MatchState) -> MatchState:
    profile = chat_json(_PROFILE_SYSTEM, state["resume_text"])
    return {"profile": profile}


# ---------- 节点 2：逐维度打分 ----------

_SCORE_SYSTEM = """你是严格的招聘匹配评估官。对照 JD 要求与候选人画像，逐维度打分（0-100 整数），输出 JSON：
{
  "dimensions": [
    {"name": "技能匹配", "score": 0, "reason": "一两句依据"},
    {"name": "项目经验", "score": 0, "reason": "一两句依据"},
    {"name": "学历要求", "score": 0, "reason": "一两句依据"},
    {"name": "加分项", "score": 0, "reason": "一两句依据"}
  ],
  "overall": 0,
  "verdict": "一句话总评（如：匹配度较高，可直接投递）"
}
打分要有区分度，依据必须来自给定材料，不要臆测。只输出 JSON。"""


def dimension_score(state: MatchState) -> MatchState:
    user = (
        f"【JD】\n{json.dumps(state['jd'], ensure_ascii=False)}\n\n"
        f"【候选人画像】\n{json.dumps(state['profile'], ensure_ascii=False)}"
    )
    scores = chat_json(_SCORE_SYSTEM, user)
    return {"scores": scores}


# ---------- 节点 3：差距分析与建议（流式） ----------

_ADVICE_SYSTEM = """你是求职教练。基于 JD、候选人画像和各维度评分，用 Markdown 输出：

## 差距分析
逐条指出候选人与 JD 要求的主要差距（引用 JD 原文要求）。

## 改进建议
给出 3-5 条可执行的建议（如补什么项目、简历怎么改写、面试准备什么），越具体越好。

## 投递话术
写一段 100 字以内、可直接发给招聘者的打招呼语，突出候选人与该岗位最契合的点。

语气务实，不要空话。"""


def gap_advice(state: MatchState, writer: StreamWriter) -> MatchState:
    user = (
        f"【JD】\n{json.dumps(state['jd'], ensure_ascii=False)}\n\n"
        f"【候选人画像】\n{json.dumps(state['profile'], ensure_ascii=False)}\n\n"
        f"【评分】\n{json.dumps(state['scores'], ensure_ascii=False)}"
    )
    parts: list[str] = []
    for token in chat_stream(_ADVICE_SYSTEM, user):
        writer({"advice_delta": token})  # 通过 custom 流实时推给前端
        parts.append(token)
    return {"advice": "".join(parts)}


# ---------- 组装状态图 ----------

def build_graph():
    g = StateGraph(MatchState)
    g.add_node("profile_extract", profile_extract)
    g.add_node("dimension_score", dimension_score)
    g.add_node("gap_advice", gap_advice)
    g.add_edge(START, "profile_extract")
    g.add_edge("profile_extract", "dimension_score")
    g.add_edge("dimension_score", "gap_advice")
    g.add_edge("gap_advice", END)
    return g.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def run_match(jd: dict, resume_text: str):
    """执行匹配流程，产出 SSE 事件流：

    ("profile", dict) → ("scores", dict) → ("advice_delta", str)* → ("done", advice全文)
    """
    advice_parts: list[str] = []
    stream = get_graph().stream(
        {"jd": jd, "resume_text": resume_text},
        stream_mode=["updates", "custom"],
    )
    for mode, chunk in stream:
        if mode == "custom" and "advice_delta" in chunk:
            advice_parts.append(chunk["advice_delta"])
            yield "advice_delta", chunk["advice_delta"]
        elif mode == "updates":
            for node_name, update in chunk.items():
                if node_name == "profile_extract":
                    yield "profile", update["profile"]
                elif node_name == "dimension_score":
                    yield "scores", update["scores"]
    yield "done", "".join(advice_parts)
