"""JD 解析：OCR 文本 → DeepSeek 结构化提取。"""
from ..models import ParsedJD
from .llm import chat_json

_SYSTEM = """你是一个招聘信息结构化助手。用户给你一段从招聘 App 截图 OCR 出来的文字（可能含有识别错误、界面按钮文字等噪声），你需要提取岗位信息并输出 JSON，格式如下：

{
  "title": "岗位名称",
  "company": "公司或团队名称（含招聘者身份，如 xx公司·CEO）",
  "location": "工作地点",
  "salary": "薪资（保留原文写法，如 2-6K、80-160元/天）",
  "education": "学历要求（如 本科、硕士，没写则为空串）",
  "skills": ["技能/任职要求，逐条列出"],
  "duties": ["岗位职责，逐条列出"],
  "bonus": ["加分项/优先条件，逐条列出"]
}

要求：
- 忽略与岗位无关的界面文字（如 立即沟通、分享、收藏、时间、电量等）
- OCR 常见错误要纠正（如 A/ 应为 AI、明显的错别字）
- 找不到的字段用空串或空数组，不要编造
- 只输出 JSON，不要其它内容"""


def parse_jd_text(raw_text: str) -> ParsedJD:
    """将 OCR 原文解析为结构化 JD；字段缺失时保留默认值，不抛异常。"""
    data = chat_json(_SYSTEM, raw_text)
    # Pydantic 校验兜底：LLM 少给/多给字段都能容忍
    return ParsedJD.model_validate({
        k: v for k, v in data.items() if k in ParsedJD.model_fields
    })
