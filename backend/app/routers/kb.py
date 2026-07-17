"""知识库路由：文档上传（任意格式，自动 OCR）、列表、删除、流式问答。"""
import json

from fastapi import APIRouter, Form, HTTPException, UploadFile
from sse_starlette.sse import EventSourceResponse

from ..services import kb
from ..services.qa import ask
from ..services.resume import file_to_text

router = APIRouter(prefix="/api/kb", tags=["kb"])


@router.post("/upload")
async def upload_doc(
    file: UploadFile | None = None,
    title: str = Form(""),
    text: str = Form(""),
):
    """上传面经/资料入库：支持 pdf(自动OCR兜底) / 图片(OCR) / txt / md，或直接贴文本。"""
    content = text.strip()
    doc_title = title.strip()
    if file is not None:
        data = await file.read()
        if data:
            content = file_to_text(file.filename or "", data)
            doc_title = doc_title or (file.filename or "未命名")
    if not content:
        raise HTTPException(422, "未能提取到文字内容")
    doc_id = kb.add_document(doc_title or content[:20], content, source="upload")
    return {"doc_id": doc_id, "chars": len(content)}


@router.get("/docs")
def list_docs():
    return [
        {"id": d.id, "title": d.title, "source": d.source, "created_at": d.created_at}
        for d in kb.list_documents()
    ]


@router.delete("/docs/{doc_id}")
def delete_doc(doc_id: str):
    kb.remove_document(doc_id)
    return {"ok": True}


@router.post("/ask")
async def kb_ask(question: str = Form(...)):
    """知识库问答，SSE 事件流：sources → answer_delta* → done。"""
    q = question.strip()
    if not q:
        raise HTTPException(400, "问题不能为空")

    def event_stream():
        try:
            for event, data in ask(q):
                yield {"event": event, "data": json.dumps(data, ensure_ascii=False)}
        except Exception as e:
            yield {"event": "error", "data": json.dumps(str(e), ensure_ascii=False)}

    return EventSourceResponse(event_stream())
