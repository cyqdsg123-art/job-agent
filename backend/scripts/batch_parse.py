"""批量解析招聘截图：把文件夹里的所有截图一次性 OCR + LLM 解析并入知识库。

用法（在 backend 目录下）：
    venv/Scripts/python -m scripts.batch_parse "C:/path/to/截图文件夹"

- 支持 jpg / jpeg / png / webp / bmp
- 按 OCR 原文去重：同一张截图重复跑不会产生重复 JD
- 单条失败不影响其余（网络抖动可直接重跑）
"""
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json  # noqa: E402

from sqlmodel import Session, select  # noqa: E402

from app.db import engine, init_db  # noqa: E402
from app.models import JobDescription  # noqa: E402
from app.services import kb  # noqa: E402
from app.services.jd_parser import parse_jd_text  # noqa: E402
from app.services.ocr import image_to_text  # noqa: E402

EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def main(folder: str) -> None:
    init_db()
    images = sorted(p for p in Path(folder).iterdir() if p.suffix.lower() in EXTS)
    if not images:
        print(f"{folder} 下没有图片")
        return
    print(f"发现 {len(images)} 张截图，开始解析…\n")

    ok = skip = fail = 0
    for i, img in enumerate(images, 1):
        prefix = f"[{i}/{len(images)}] {img.name}"
        try:
            raw_text = image_to_text(img.read_bytes())
            if not raw_text.strip():
                print(f"{prefix} ✗ OCR 未识别到文字，跳过")
                fail += 1
                continue

            # 按 OCR 原文去重
            with Session(engine) as s:
                dup = s.exec(
                    select(JobDescription).where(JobDescription.raw_text == raw_text)
                ).first()
            if dup:
                print(f"{prefix} ≡ 已存在（jd-{dup.id} {dup.title}），跳过")
                skip += 1
                continue

            parsed = parse_jd_text(raw_text)
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
            with Session(engine) as s:
                s.add(row)
                s.commit()
                s.refresh(row)
            kb.index_jd(row)
            print(f"{prefix} ✓ jd-{row.id} {parsed.title}｜{parsed.salary}｜{parsed.location}")
            ok += 1
        except Exception as e:
            print(f"{prefix} ✗ 失败：{e}")
            fail += 1

    print(f"\n完成：新增 {ok}，重复跳过 {skip}，失败 {fail}")
    print(f"知识库现有文档 {len(kb.list_documents())} 篇")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
