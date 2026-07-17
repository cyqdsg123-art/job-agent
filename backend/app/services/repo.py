"""代码仓库摄取：本地路径或 git 链接 → 扫描代码 → LLM 架构概览 → 知识库。

切块策略：代码不按段落而按"文件 + 行窗口"切，每块前缀文件路径，
让检索命中时面试官能引用到具体文件（见 DECISIONS.md #12）。
"""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from . import kb
from .llm import chat_json

_SKIP_DIRS = {
    ".git", "node_modules", "venv", ".venv", "env", "__pycache__", "dist",
    "build", ".next", "out", "target", "models", "chroma_db", ".idea", ".vscode",
}
_CODE_EXTS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".vue", ".java", ".go", ".rs",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".sql",
    ".html", ".css", ".md", ".yml", ".yaml", ".toml",
}
_MAX_FILES = 120          # 摄取文件数上限
_MAX_FILE_BYTES = 60_000  # 单文件大小上限
_LINES_PER_CHUNK = 50     # 代码块行数


class RepoError(Exception):
    """摄取失败：原因直接展示给用户。"""


def _resolve(source: str) -> Path:
    """本地路径直接用；git 链接 clone 到临时目录。"""
    p = Path(source)
    if p.is_dir():
        return p
    if source.startswith(("http://", "https://")):
        dest = Path(tempfile.gettempdir()) / "job_agent_repos" / hashlib.md5(
            source.encode()
        ).hexdigest()[:10]
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            r = subprocess.run(
                ["git", "clone", "--depth", "1", source, str(dest)],
                capture_output=True, text=True, timeout=300,
            )
            if r.returncode != 0:
                raise RepoError(f"git clone 失败：{r.stderr.strip()[-200:]}")
        return dest
    raise RepoError("请输入存在的本地目录路径，或 GitHub/Gitee 仓库链接")


def _collect(root: Path) -> list[tuple[str, str]]:
    """遍历仓库，返回 [(相对路径, 内容)]，按启发式优先级排序后截断。"""
    files: list[tuple[str, str]] = []
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in _CODE_EXTS:
            continue
        if any(part in _SKIP_DIRS for part in p.parts):
            continue
        if p.stat().st_size > _MAX_FILE_BYTES:
            continue
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if content.strip():
            files.append((p.relative_to(root).as_posix(), content))

    # README 与源码优先，配置文件靠后
    def priority(item: tuple[str, str]) -> int:
        path = item[0].lower()
        if "readme" in path:
            return 0
        if path.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".vue", ".java", ".go", ".rs")):
            return 1
        return 2

    return sorted(files, key=priority)[:_MAX_FILES]


def _chunk_file(rel_path: str, content: str) -> list[str]:
    """按行窗口切块，每块带文件路径前缀。"""
    lines = content.splitlines()
    chunks = []
    for start in range(0, len(lines), _LINES_PER_CHUNK):
        seg = "\n".join(lines[start:start + _LINES_PER_CHUNK])
        if seg.strip():
            chunks.append(f"文件：{rel_path}（第 {start + 1} 行起）\n{seg}")
    return chunks


_PROFILE_SYSTEM = """你是代码架构分析师。根据仓库文件树和关键文件内容，输出 JSON：
{
  "name": "项目名",
  "tech_stack": ["技术栈"],
  "modules": [{"path": "目录/文件", "role": "职责一句话"}],
  "summary": "3-5 句话的架构概述（数据流向、核心设计）"
}
只输出 JSON。"""


def ingest_repo(source: str, refresh: bool = False) -> dict:
    """摄取仓库 → 知识库。返回 {doc_id, profile, files_indexed, chunks}。

    同一仓库已入库时默认直接复用（refresh=True 强制重新分析）。
    """
    root = _resolve(source.strip())
    doc_id = f"repo-{hashlib.md5(str(root).encode()).hexdigest()[:8]}"

    # 快路径：已入库直接复用，免去重复嵌入
    if not refresh:
        from sqlmodel import Session, select
        from ..db import engine
        from ..models import KBChunk, KBDoc

        with Session(engine) as s:
            doc = s.get(KBDoc, doc_id)
            if doc:
                n_chunks = len(
                    s.exec(select(KBChunk).where(KBChunk.doc_id == doc_id)).all()
                )
                return {
                    "doc_id": doc_id,
                    "profile": None,  # 概览在块 0，用 repo_overview() 取
                    "files_indexed": -1,
                    "chunks": n_chunks,
                    "reused": True,
                }

    files = _collect(root)
    if not files:
        raise RepoError("仓库里没有找到可分析的代码文件")

    tree = "\n".join(path for path, _ in files)
    # 概览材料：文件树 + README + 前几个源码文件的开头
    material = [f"【文件树】\n{tree}"]
    for path, content in files[:6]:
        material.append(f"【{path}】\n{content[:2000]}")
    profile = chat_json(_PROFILE_SYSTEM, "\n\n".join(material))

    # 块 0 固定为仓库概览，之后是代码块
    chunks = [f"【仓库概览】{json.dumps(profile, ensure_ascii=False)}\n【文件树】\n{tree}"]
    for path, content in files:
        chunks.extend(_chunk_file(path, content))

    kb.add_document_chunks(
        title=f"代码仓库：{profile.get('name') or root.name}",
        chunks=chunks,
        source="repo",
        doc_id=doc_id,
    )
    return {
        "doc_id": doc_id,
        "profile": profile,
        "files_indexed": len(files),
        "chunks": len(chunks),
    }


def repo_overview(doc_id: str) -> str:
    """取仓库概览块（块 0），供面试上下文使用。"""
    from sqlmodel import Session
    from ..db import engine
    from ..models import KBChunk

    with Session(engine) as s:
        chunk = s.get(KBChunk, f"{doc_id}-0")
    return chunk.text if chunk else ""
