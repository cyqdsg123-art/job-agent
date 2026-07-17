"""面试准备包：针对某个 JD，结合简历/代码仓库/面经生成备考文档（流式）。"""
import json

from .kb import hybrid_search
from .llm import chat_stream

_SYSTEM = """你是资深求职教练，为候选人生成针对该岗位的《面试准备包》，Markdown 格式：

# 面试准备包：{岗位名}

## 一、岗位考点拆解
把 JD 的技能要求逐条翻译成"面试官会怎么考"（每条对应可能的考察形式）。

## 二、高频面试题与回答要点（8-10 题）
每题包含：
- **题目**（结合候选人简历/代码里的真实内容出题，面试官最可能问的）
- 回答要点（基于候选人的真实材料给出要点，不编造经历）
- ⚠️ 追问预判（面试官可能顺着答案追问什么）

## 三、项目讲述脚本
用 STAR 法则把候选人最强的项目组织成 60 秒讲述脚本（用候选人真实项目）。

## 四、反问环节建议
3 个适合该岗位的高质量反问。

要求：所有内容基于给定材料，绝不虚构候选人没有的经历；要点式表达，务实不空洞。"""


def stream_prep(jd: dict, resume_text: str, repo_doc_id: str = ""):
    """生成准备包（流式 token）。"""
    parts = [
        f"【岗位 JD】\n{json.dumps(jd, ensure_ascii=False)}",
        f"【候选人简历】\n{resume_text}",
    ]
    if repo_doc_id:
        from .repo import repo_overview

        overview = repo_overview(repo_doc_id)
        if overview:
            parts.append(f"【候选人代码仓库概览】\n{overview[:3000]}")
        hits = hybrid_search(jd.get("title", "") + " 核心实现", top_k=4, doc_id=repo_doc_id)
        code = "\n\n".join(h["text"] for h in hits if h["chunk_id"] != f"{repo_doc_id}-0")
        if code:
            parts.append(f"【候选人代码片段】\n{code[:5000]}")
    # 知识库中的面经（用户上传的资料）
    refs = hybrid_search(f"{jd.get('title', '')} 面试 问题", top_k=3)
    ref_texts = [r["text"] for r in refs if r.get("doc_id", "").startswith("doc-")]
    if ref_texts:
        parts.append("【相关面经】\n" + "\n---\n".join(ref_texts))

    yield from chat_stream(_SYSTEM, "\n\n".join(parts))
