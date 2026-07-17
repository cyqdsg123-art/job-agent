"""问答质量评测（LLM-as-Judge）：忠实度 / 幻觉率 / 拒答正确率。

用法（在 backend 目录下）：
    venv/Scripts/python -m scripts.eval_qa

方法：
- 评测集混合"可回答题"（答案在知识库里）与"陷阱题"（知识库没有，应明确拒答）
- 对每个问题跑真实 ask() 管线拿到检索源与回答
- 裁判模型只看【检索源 + 回答】，把回答拆成逐条主张核对是否有证据支撑
- 已知局限：裁判与生成是同一个模型（DeepSeek），存在自评偏置；
  缓解手段是裁判只做"证据核对"这种客观任务，不做开放评价（见 DECISIONS.md #13）
"""
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json  # noqa: E402
import re  # noqa: E402

from app.services.llm import chat_json  # noqa: E402
from app.services.qa import ask  # noqa: E402

# type: answerable=知识库应能答；trap=知识库没有，应拒答
EVAL_SET = [
    {"q": "AI Builder 岗位的薪资和工作地点是什么？", "type": "answerable"},
    {"q": "哪些岗位对英语水平有要求？", "type": "answerable"},
    {"q": "ChatGPT/AIGC 全栈开发岗位涉及哪些开发内容？", "type": "answerable"},
    {"q": "CMC AI 算法实习生要求什么学历？", "type": "answerable"},
    {"q": "这些岗位的五险一金和年终奖政策是怎样的？", "type": "trap"},
    {"q": "腾讯的算法岗位薪资是多少？", "type": "trap"},
    {"q": "有没有周末双休的说明？", "type": "trap"},
]

_JUDGE_SYSTEM = """你是严格的事实核查员。给你【资料】和一段基于资料生成的【回答】，请：
1. 把回答拆成独立的事实主张（观点/建议类语句忽略）
2. 逐条判断该主张能否被资料支撑（资料里找得到依据 = supported）
3. 判断回答整体是否属于"拒答"：回答的核心是说明资料/知识库中没有所问信息。
   注意："资料中没有 X 的信息"这类否定性说明属于拒答表述，不算事实主张，不要放进 claims。

输出 JSON：
{
  "claims": [{"claim": "主张原文", "supported": true, "evidence": "支撑它的资料编号或原句，无则为空串"}],
  "refused": false
}
只依据给定资料判断，不使用你自己的知识。只输出 JSON。"""


def run_one(q: str) -> dict:
    """跑一次真实问答，返回 {sources, answer}。"""
    sources, answer = [], ""
    for event, data in ask(q):
        if event == "sources":
            sources = data
        elif event == "done":
            answer = data
    return {"sources": sources, "answer": answer}


def judge(sources: list[dict], answer: str) -> dict:
    ctx = "\n\n".join(f"[{i + 1}]《{s['title']}》\n{s['text']}" for i, s in enumerate(sources))
    return chat_json(_JUDGE_SYSTEM, f"【资料】\n{ctx or '（无检索结果）'}\n\n【回答】\n{answer}")


def run() -> None:
    rows = []
    for item in EVAL_SET:
        t0 = time.perf_counter()
        result = run_one(item["q"])
        verdict = judge(result["sources"], result["answer"])
        elapsed = time.perf_counter() - t0

        claims = verdict.get("claims", [])
        unsupported = [c for c in claims if not c.get("supported")]
        refused = bool(verdict.get("refused"))
        if item["type"] == "trap":
            ok = refused or not claims  # 陷阱题：拒答（或未给出任何事实主张）为正确
            note = "正确拒答" if ok else f"幻觉：{unsupported[0]['claim'][:40] if unsupported else claims[0]['claim'][:40]}…"
        else:
            ok = bool(claims) and not unsupported and not refused
            note = "全部有据" if ok else (
                "误拒答" if refused else f"无据主张：{unsupported[0]['claim'][:40]}…" if unsupported else "无有效主张"
            )
        rows.append({
            "q": item["q"], "type": item["type"], "ok": ok, "note": note,
            "claims": len(claims), "unsupported": len(unsupported), "sec": elapsed,
        })
        print(f"[{'✅' if ok else '❌'}] ({item['type']}) {item['q']} — {note}")

    ans_rows = [r for r in rows if r["type"] == "answerable"]
    trap_rows = [r for r in rows if r["type"] == "trap"]
    total_claims = sum(r["claims"] for r in ans_rows)
    total_unsupported = sum(r["unsupported"] for r in ans_rows)
    faithfulness = (1 - total_unsupported / total_claims) * 100 if total_claims else 0.0

    section = [
        "## 问答质量评测（LLM-as-Judge）",
        "",
        f"- 评测集：{len(ans_rows)} 条可回答题 + {len(trap_rows)} 条陷阱题（知识库中不存在的信息）",
        "- 方法：裁判模型把回答拆成逐条事实主张，核对每条是否被检索资料支撑",
        "",
        "| 指标 | 结果 |",
        "|---|---|",
        f"| 主张级忠实度 | {faithfulness:.1f}%（{total_claims - total_unsupported}/{total_claims} 条主张有据） |",
        f"| 可回答题正确率 | {sum(r['ok'] for r in ans_rows)}/{len(ans_rows)} |",
        f"| 陷阱题拒答正确率 | {sum(r['ok'] for r in trap_rows)}/{len(trap_rows)} |",
        f"| 平均端到端耗时 | {sum(r['sec'] for r in rows) / len(rows):.1f}s |",
        "",
        "| 问题 | 类型 | 结果 | 说明 |",
        "|---|---|---|---|",
    ]
    for r in rows:
        section.append(
            f"| {r['q']} | {'可回答' if r['type'] == 'answerable' else '陷阱'} | "
            f"{'✅' if r['ok'] else '❌'} | {r['note']} |"
        )

    out = Path(__file__).resolve().parent.parent.parent / "EVALS.md"
    existing = out.read_text(encoding="utf-8") if out.exists() else "# 检索与问答质量评测（EVALS.md）\n"
    # 覆盖旧的问答评测段落
    existing = re.split(r"\n## 问答质量评测", existing)[0].rstrip()
    out.write_text(existing + "\n\n" + "\n".join(section) + "\n", encoding="utf-8")
    print(f"\n已写入 {out}")


if __name__ == "__main__":
    run()
