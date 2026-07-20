"use client";

/** 首页：上传/粘贴招聘截图 + URL + 文本 → OCR/LLM 解析 → 展示结构化 JD */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import JDCard from "@/components/JDCard";
import { parseJD, parseJDText, parseJDUrl } from "@/lib/api";
import type { JD } from "@/lib/types";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<JD | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
    setPreview(URL.createObjectURL(f));
  };

  // Ctrl+V 粘贴剪贴板截图
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const f = item?.getAsFile();
      if (f) { e.preventDefault(); pick(f); }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const handleParse = async () => {
    if (!file) return;
    setLoading(true); setError("");
    try { setResult(await parseJD(file)); }
    catch (e) { setError(e instanceof Error ? e.message : "解析失败"); }
    finally { setLoading(false); }
  };

  const handleParseUrl = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try { setResult(await parseJDUrl(url)); }
    catch (e) { setError(e instanceof Error ? e.message : "解析失败"); }
    finally { setLoading(false); }
  };

  const handleParseText = async () => {
    if (!pasteText.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try { setResult(await parseJDText(pasteText)); setPasteText(""); }
    catch (e) { setError(e instanceof Error ? e.message : "解析失败"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">📸 解析职位信息</h1>
        <p className="text-sm text-slate-500 mt-1">
          支持截图(OCR)、公开链接、粘贴文本三种方式 —— 一键结构化入库
        </p>
      </div>

      {/* 上传区 */}
      <div className="card rounded-2xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-700">上传截图</div>
        <div
          className="border-2 border-dashed border-purple-200 rounded-2xl bg-white/50 p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        >
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => pick(e.target.files?.[0])} />
          {preview ? (
            <img src={preview} alt="截图预览" className="max-h-56 mx-auto rounded-xl shadow-sm" />
          ) : (
            <div className="space-y-2">
              <div className="text-4xl">📤</div>
              <p className="text-slate-500 text-sm">
                点击选择 / 拖拽 / <b>Ctrl+V 粘贴</b>截图
              </p>
              <p className="text-xs text-slate-400">
                Win+Shift+S 框选职位区域 → 回来 Ctrl+V 即解析
              </p>
            </div>
          )}
        </div>
        <button onClick={handleParse} disabled={!file || loading}
          className="btn btn-primary w-full justify-center">
          {loading ? "⏳ 解析中…" : "🚀 开始解析"}
        </button>
      </div>

      {/* URL 导入 */}
      <details className="card rounded-2xl p-5">
        <summary className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
          或粘贴公开职位链接
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-400">适用：公司官网/校招网/实习僧等公开页面；登录墙页面请用截图</p>
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleParseUrl()}
              placeholder="https://公司官网/careers/..." className="input flex-1" />
            <button onClick={handleParseUrl} disabled={!url.trim() || loading}
              className="btn btn-secondary">抓取解析</button>
          </div>
        </div>
      </details>

      {/* 文本粘贴 */}
      <details className="card rounded-2xl p-5">
        <summary className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
          或粘贴职位描述文本
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-400">
            需要登录的页面（如 Boss 直聘）：全选(Ctrl+A)复制职位内容后贴进来
          </p>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            rows={4} placeholder="把职位详情的文字整段粘贴进来…" className="textarea" />
          <button onClick={handleParseText} disabled={!pasteText.trim() || loading}
            className="btn btn-secondary">解析文本</button>
        </div>
      </details>

      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-2xl p-4 animate-fade-in">{error}</p>}

      {result && (
        <div className="space-y-3 animate-slide-up">
          <JDCard jd={result} />
          <Link href={`/match?jd=${result.id}`}
            className="btn btn-primary inline-flex">
            🎯 用我的简历匹配这个岗位
          </Link>
        </div>
      )}
    </div>
  );
}
