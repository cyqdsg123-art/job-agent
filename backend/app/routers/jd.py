"""JD 路由：截图上传解析、列表、详情、删除。"""
import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlmodel import Session, select

from ..db import get_session
from ..models import JDOut, JobDescription
from ..services.jd_parser import parse_jd_text
from ..services.ocr import image_to_text

router = APIRouter(prefix="/api/jd", tags=["jd"])


@router.post("/parse", response_model=JDOut)
async def parse_jd(file: UploadFile, session: Session = Depends(get_session)):
    """上传招聘截图 → OCR → LLM 结构化 → 入库。"""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(400, "文件为空")

    raw_text = image_to_text(image_bytes)
    if not raw_text.strip():
        raise HTTPException(422, "未能从图片中识别出文字，请换一张更清晰的截图")

    parsed = None
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
    return JDOut.from_row(row)


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
    return {"ok": True}
