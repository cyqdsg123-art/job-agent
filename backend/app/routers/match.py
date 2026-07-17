"""匹配路由：简历 + JD → SSE 流式匹配报告。"""
import json

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlmodel import Session
from sse_starlette.sse import EventSourceResponse

from ..db import get_session
from ..models import JDOut, JobDescription
from ..services.matcher import run_match
from ..services.resume import pdf_to_text

router = APIRouter(prefix="/api/match", tags=["match"])


@router.post("")
async def match(
    jd_id: int = Form(...),
    resume_text: str = Form(""),
    resume_file: UploadFile | None = None,
    session: Session = Depends(get_session),
):
    """简历（PDF 文件或纯文本）对照指定 JD，流式返回匹配报告。

    SSE 事件序列：profile → scores → advice_delta* → done
    """
    row = session.get(JobDescription, jd_id)
    if not row:
        raise HTTPException(404, "JD 不存在")

    text = resume_text.strip()
    if resume_file is not None:
        pdf_bytes = await resume_file.read()
        if pdf_bytes:
            text = pdf_to_text(pdf_bytes)
    if not text:
        raise HTTPException(400, "请上传简历 PDF 或粘贴简历文本")

    jd_dict = JDOut.from_row(row).model_dump(mode="json")
    # raw_text 太长且有噪声，不进入 prompt
    jd_dict.pop("raw_text", None)

    def event_stream():
        # 统一 JSON 编码：token 里可能含换行，裸文本会破坏 SSE 帧格式
        try:
            for event, data in run_match(jd_dict, text):
                yield {"event": event, "data": json.dumps(data, ensure_ascii=False)}
        except Exception as e:  # 把后端错误显式推给前端，而不是静默断流
            yield {"event": "error", "data": json.dumps(str(e), ensure_ascii=False)}

    return EventSourceResponse(event_stream())
