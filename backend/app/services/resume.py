"""文档解析：PDF / 图片 / 纯文本 统一转文字，图片型内容自动 OCR 兜底。"""
import io

from pypdf import PdfReader

from .ocr import image_to_text

# 文字层少于该字符数的 PDF 视为扫描件/图片型，走 OCR
_MIN_TEXT_LEN = 30


def _pdf_ocr(pdf_bytes: bytes) -> str:
    """图片型 PDF：逐页渲染成图（200 DPI）后 RapidOCR 识别。"""
    import fitz  # pymupdf，延迟导入

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pix = page.get_pixmap(dpi=200)
        pages.append(image_to_text(pix.tobytes("png")))
    return "\n".join(pages).strip()


def pdf_to_text(pdf_bytes: bytes) -> str:
    """PDF → 文本：优先取文字层，文字层为空（扫描件）时自动 OCR。"""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if len(text) >= _MIN_TEXT_LEN:
        return text
    return _pdf_ocr(pdf_bytes)


def file_to_text(filename: str, data: bytes) -> str:
    """按扩展名分发：pdf / 图片(OCR) / txt·md，返回纯文本。"""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return pdf_to_text(data)
    if name.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")):
        return image_to_text(data)
    # 默认按文本文件处理（utf-8 优先，gbk 兜底）
    try:
        return data.decode("utf-8").strip()
    except UnicodeDecodeError:
        return data.decode("gbk", errors="ignore").strip()
