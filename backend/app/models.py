"""数据模型：SQLModel 表 + API 请求/响应模型。"""
import json
from datetime import datetime

from pydantic import BaseModel, Field as PField
from sqlmodel import Field, SQLModel


# ---------- 数据库表 ----------

class JobDescription(SQLModel, table=True):
    """解析后的招聘 JD。列表字段以 JSON 字符串存储。"""

    id: int | None = Field(default=None, primary_key=True)
    title: str = ""            # 岗位名称
    company: str = ""          # 公司/团队
    location: str = ""         # 工作地点
    salary: str = ""           # 薪资
    education: str = ""        # 学历要求
    skills_json: str = "[]"    # 技能要求
    duties_json: str = "[]"    # 岗位职责
    bonus_json: str = "[]"     # 加分项/优先条件
    raw_text: str = ""         # OCR 原文（供人工核对）
    created_at: datetime = Field(default_factory=datetime.now)


# ---------- 知识库 ----------

class KBDoc(SQLModel, table=True):
    """知识库文档（一份 JD / 一篇面经 / 一份资料）。"""

    id: str = Field(primary_key=True)   # 如 jd-3 / doc-uuid
    title: str = ""
    source: str = ""                    # jd / upload
    created_at: datetime = Field(default_factory=datetime.now)


class KBChunk(SQLModel, table=True):
    """文档切块（BM25 语料与引用展示的数据源，向量存 Chroma）。"""

    id: str = Field(primary_key=True)   # {doc_id}-{seq}
    doc_id: str = Field(index=True)
    seq: int = 0
    title: str = ""
    text: str = ""


# ---------- 模拟面试 ----------

class InterviewSession(SQLModel, table=True):
    """一场模拟面试：轮次历史以 JSON 存储，支持中断后回看。"""

    id: int | None = Field(default=None, primary_key=True)
    jd_id: int = 0
    resume_text: str = ""
    rounds_json: str = "[]"   # [{"q": 题目, "focus": 考察点, "a": 回答, "feedback": 点评}]
    status: str = "active"    # active / done
    report: str = ""          # 结束后的总结报告
    created_at: datetime = Field(default_factory=datetime.now)


# ---------- LLM 结构化提取结果 ----------

class ParsedJD(BaseModel):
    """DeepSeek 从 OCR 文本中提取的结构化 JD。"""

    title: str = ""
    company: str = ""
    location: str = ""
    salary: str = ""
    education: str = ""
    skills: list[str] = PField(default_factory=list)
    duties: list[str] = PField(default_factory=list)
    bonus: list[str] = PField(default_factory=list)


# ---------- API 响应模型 ----------

class JDOut(BaseModel):
    id: int
    title: str
    company: str
    location: str
    salary: str
    education: str
    skills: list[str]
    duties: list[str]
    bonus: list[str]
    raw_text: str
    created_at: datetime

    @classmethod
    def from_row(cls, row: JobDescription) -> "JDOut":
        return cls(
            id=row.id,
            title=row.title,
            company=row.company,
            location=row.location,
            salary=row.salary,
            education=row.education,
            skills=json.loads(row.skills_json),
            duties=json.loads(row.duties_json),
            bonus=json.loads(row.bonus_json),
            raw_text=row.raw_text,
            created_at=row.created_at,
        )
