"""面试准备包路由：SSE 流式生成。"""
import json

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlmodel import Session
from sse_starlette.sse import EventSourceResponse

from ..db import get_session
from ..models import JDOut, JobDescription
from ..services.prep import stream_prep
from ..services.repo import RepoError, ingest_repo

router = APIRouter(prefix="/api/prep", tags=["prep"])


@router.post("")
def generate_prep(
    jd_id: int = Form(...),
    resume_text: str = Form(...),
    repo: str = Form(""),
    session: Session = Depends(get_session),
):
    """生成面试准备包。SSE：prep_delta* → done。"""
    row = session.get(JobDescription, jd_id)
    if not row:
        raise HTTPException(404, "JD 不存在")
    text = resume_text.strip()
    if not text:
        raise HTTPException(400, "请提供简历文本")

    repo_doc_id = ""
    if repo.strip():
        try:
            repo_doc_id = ingest_repo(repo)["doc_id"]  # 已入库的仓库会直接复用
        except RepoError as e:
            raise HTTPException(422, str(e))

    jd = JDOut.from_row(row).model_dump(mode="json")
    jd.pop("raw_text", None)

    def event_stream():
        try:
            parts: list[str] = []
            for tok in stream_prep(jd, text, repo_doc_id):
                parts.append(tok)
                yield {"event": "prep_delta", "data": json.dumps(tok, ensure_ascii=False)}
            yield {"event": "done", "data": json.dumps("".join(parts), ensure_ascii=False)}
        except Exception as e:
            yield {"event": "error", "data": json.dumps(str(e), ensure_ascii=False)}

    return EventSourceResponse(event_stream())
