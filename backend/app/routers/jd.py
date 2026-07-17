"""JD 路由：截图/URL 解析、列表、详情、删除。"""
import json

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from ..db import get_session
from ..models import JDOut, JobDescription
from ..services import kb
from ..services.jd_parser import parse_jd_text
from ..services.ocr import image_to_text
from ..services.web import FetchError, fetch_page_text

router = APIRouter(prefix="/api/jd", tags=["jd"])


def _parse_and_save(raw_text: str, session: Session) -> JDOut:
    """LLM 结构化 → 存库 → 入知识库（截图与 URL 两条入口共用）。"""
    try:
        parsed = parse_jd_text(raw_text)
    except RuntimeError as e:  # 未配置 API Key 等环境问题
        raise HTTPException(503, str(e))
    row = JobDescription(
        title=parsed.title,
        company=parsed.company,
        location=parsed.location,
        salary=parsed.salary,
        education=parsed.education,
        skills_json=json.dumps(parsed.skills, ensure_ascii=False),
        duties_json=json.dumps(parsed.duties, ensure_ascii=False),
        bonus_json=json.dumps(parsed.bonus, ensure_ascii=False),
        raw_text=raw_text,
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    # 同步入知识库（失败不影响解析主流程）
    try:
        kb.index_jd(row)
    except Exception:
        pass

    return JDOut.from_row(row)


@router.post("/parse", response_model=JDOut)
async def parse_jd(file: UploadFile, session: Session = Depends(get_session)):
    """上传招聘截图 → OCR → LLM 结构化 → 入库。"""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(400, "文件为空")

    raw_text = image_to_text(image_bytes)
    if not raw_text.strip():
        raise HTTPException(422, "未能从图片中识别出文字，请换一张更清晰的截图")
    return _parse_and_save(raw_text, session)


@router.post("/parse-url", response_model=JDOut)
def parse_jd_url(url: str = Form(...), session: Session = Depends(get_session)):
    """粘贴公开职位页链接 → 抓取正文 → LLM 结构化 → 入库。

    仅适用于无登录墙的公开页面；Boss 直聘详情页等请用截图解析。
    """
    try:
        raw_text = fetch_page_text(url.strip())
    except FetchError as e:
        raise HTTPException(422, str(e))
    return _parse_and_save(raw_text, session)


@router.post("/parse-text", response_model=JDOut)
def parse_jd_from_text(text: str = Form(...), session: Session = Depends(get_session)):
    """直接粘贴职位描述文本 → LLM 结构化 → 入库。

    适用于登录墙页面：用户在自己浏览器里全选复制职位内容后粘贴。
    """
    raw_text = text.strip()
    if len(raw_text) < 20:
        raise HTTPException(422, "文本太短，请把职位描述完整粘贴进来")
    return _parse_and_save(raw_text, session)


@router.get("", response_model=list[JDOut])
def list_jds(session: Session = Depends(get_session)):
    rows = session.exec(
        select(JobDescription).order_by(JobDescription.created_at.desc())
    ).all()
    return [JDOut.from_row(r) for r in rows]


@router.get("/{jd_id}", response_model=JDOut)
def get_jd(jd_id: int, session: Session = Depends(get_session)):
    row = session.get(JobDescription, jd_id)
    if not row:
        raise HTTPException(404, "JD 不存在")
    return JDOut.from_row(row)


@router.delete("/{jd_id}")
def delete_jd(jd_id: int, session: Session = Depends(get_session)):
    row = session.get(JobDescription, jd_id)
    if not row:
        raise HTTPException(404, "JD 不存在")
    session.delete(row)
    session.commit()
    kb.remove_document(f"jd-{jd_id}")  # 知识库同步删除
    return {"ok": True}
