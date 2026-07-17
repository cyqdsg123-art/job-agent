"""OCR 服务：用 RapidOCR 从招聘截图中提取文字（离线、免费、中文效果好）。"""
from rapidocr_onnxruntime import RapidOCR

_ocr: RapidOCR | None = None


def _get_ocr() -> RapidOCR:
    """懒加载：模型只初始化一次（首次约 1~2 秒）。"""
    global _ocr
    if _ocr is None:
        _ocr = RapidOCR()
    return _ocr


def image_to_text(image_bytes: bytes) -> str:
    """图片字节 → 按行拼接的纯文本。识别不到内容时返回空串。"""
    result, _ = _get_ocr()(image_bytes)
    if not result:
        return ""
    return "\n".join(line[1] for line in result)
