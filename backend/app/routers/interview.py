"""模拟面试路由：开始面试、逐轮回答（SSE 流式点评+追问）、会话查询。"""
import json

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlmodel import Session
from sse_starlette.sse import EventSourceResponse

from ..db import get_session
from ..models import InterviewSession, JDOut, JobDescription
from ..services.interviewer import MAX_ROUNDS, make_question, stream_feedback, stream_report
from ..services.repo import RepoError, ingest_repo
from ..services.resume import file_to_text

router = APIRouter(prefix="/api/interview", tags=["interview"])


def _jd_dict(session: Session, jd_id: int) -> dict:
    row = session.get(JobDescription, jd_id)
    if not row:
        raise HTTPException(404, "JD 不存在")
    d = JDOut.from_row(row).model_dump(mode="json")
    d.pop("raw_text", None)
    return d


@router.post("/start")
async def start_interview(
    jd_id: int = Form(...),
    resume_text: str = Form(""),
    repo: str = Form(""),
    resume_file: UploadFile | None = None,
    session: Session = Depends(get_session),
):
    """开始一场模拟面试，返回第一题。repo 可选：本地仓库路径 / git 链接。"""
    text = resume_text.strip()
    if resume_file is not None:
        data = await resume_file.read()
        if data:
            text = file_to_text(resume_file.filename or "", data)
    if not text:
        raise HTTPException(400, "请粘贴简历文本或上传简历文件")

    # 可选：摄取候选人代码仓库，让面试官针对真实代码提问
    repo_doc_id = ""
    repo_profile = None
    if repo.strip():
        try:
            info = ingest_repo(repo)
            repo_doc_id = info["doc_id"]
            repo_profile = info["profile"]
        except RepoError as e:
            raise HTTPException(422, str(e))

    jd = _jd_dict(session, jd_id)
    try:
        q = make_question(jd, text, [], repo_doc_id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    row = InterviewSession(
        jd_id=jd_id,
        resume_text=text,
        repo_doc_id=repo_doc_id,
        rounds_json=json.dumps([{"q": q["question"], "focus": q["focus"]}], ensure_ascii=False),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return {
        "session_id": row.id,
        "question": q["question"],
        "focus": q["focus"],
        "round": 1,
        "total_rounds": MAX_ROUNDS,
        "repo_profile": repo_profile,
    }


@router.post("/{sid}/answer")
def answer(sid: int, answer: str = Form(...), session: Session = Depends(get_session)):
    """提交本轮回答。SSE：feedback_delta* → (question | report_delta* → done)。"""
    row = session.get(InterviewSession, sid)
    if not row:
        raise HTTPException(404, "面试会话不存在")
    if row.status == "done":
        raise HTTPException(400, "本场面试已结束，请开始新的面试")
    text = answer.strip()
    if not text:
        raise HTTPException(400, "回答不能为空")

    jd = _jd_dict(session, row.jd_id)
    rounds: list[dict] = json.loads(row.rounds_json)
    current = rounds[-1]  # 最后一轮是"已出题待回答"
    current["a"] = text

    def event_stream():
        try:
            # 1) 流式点评
            fb_parts: list[str] = []
            for tok in stream_feedback(
                jd, row.resume_text, rounds[:-1], current["q"], text, row.repo_doc_id
            ):
                fb_parts.append(tok)
                yield {"event": "feedback_delta", "data": json.dumps(tok, ensure_ascii=False)}
            current["feedback"] = "".join(fb_parts)

            if len(rounds) < MAX_ROUNDS:
                # 2a) 出下一题
                q = make_question(jd, row.resume_text, rounds, row.repo_doc_id)
                rounds.append({"q": q["question"], "focus": q["focus"]})
                row.rounds_json = json.dumps(rounds, ensure_ascii=False)
                session.add(row)
                session.commit()
                yield {
                    "event": "question",
                    "data": json.dumps(
                        {
                            "question": q["question"],
                            "focus": q["focus"],
                            "round": len(rounds),
                            "total_rounds": MAX_ROUNDS,
                        },
                        ensure_ascii=False,
                    ),
                }
            else:
                # 2b) 最后一轮：生成总结报告
                rp_parts: list[str] = []
                for tok in stream_report(jd, row.resume_text, rounds):
                    rp_parts.append(tok)
                    yield {"event": "report_delta", "data": json.dumps(tok, ensure_ascii=False)}
                row.report = "".join(rp_parts)
                row.status = "done"
                row.rounds_json = json.dumps(rounds, ensure_ascii=False)
                session.add(row)
                session.commit()
                yield {"event": "done", "data": json.dumps(row.report, ensure_ascii=False)}
        except Exception as e:
            yield {"event": "error", "data": json.dumps(str(e), ensure_ascii=False)}

    return EventSourceResponse(event_stream())


@router.get("/{sid}")
def get_session_detail(sid: int, session: Session = Depends(get_session)):
    """回看一场面试的完整记录。"""
    row = session.get(InterviewSession, sid)
    if not row:
        raise HTTPException(404, "面试会话不存在")
    return {
        "session_id": row.id,
        "jd_id": row.jd_id,
        "rounds": json.loads(row.rounds_json),
        "status": row.status,
        "report": row.report,
        "created_at": row.created_at,
    }
