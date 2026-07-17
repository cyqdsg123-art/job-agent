"""简历解析：支持 PDF 文件或纯文本。"""
import io

from pypdf import PdfReader


def pdf_to_text(pdf_bytes: bytes) -> str:
    """PDF 字节 → 纯文本（逐页拼接）。"""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()
