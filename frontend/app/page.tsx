"use client";

/** 首页：上传/粘贴招聘截图 → OCR + LLM 解析 → 展示结构化 JD */
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

  // Ctrl+V 直接粘贴剪贴板里的截图（Win+Shift+S 框选后无需保存文件）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // 在文本框里粘贴文字时不拦截
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        pick(f);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      setResult(await parseJD(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
    } finally {
      setLoading(false);
    }
  };

  const handleParseUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await parseJDUrl(url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
    } finally {
      setLoading(false);
    }
  };

  const handleParseText = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await parseJDText(pasteText));
      setPasteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">上传招聘截图</h1>
        <p className="text-sm text-slate-500 mt-1">
          支持 Boss 直聘等 App 的职位详情截图，自动 OCR 并结构化解析
        </p>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 rounded-xl bg-white p-8 text-center cursor-pointer hover:border-indigo-400"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="截图预览" className="max-h-64 mx-auto rounded" />
        ) : (
          <p className="text-slate-400">
            点击选择 / 拖拽 / <b>Ctrl+V 直接粘贴</b>截图
            <br />
            <span className="text-xs">
              网页禁止复制文字？Win+Shift+S 框选职位区域，回来 Ctrl+V 即可
            </span>
          </p>
        )}
      </div>

      <button
        onClick={handleParse}
        disabled={!file || loading}
        className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
      >
        {loading ? "解析中（约 10 秒）…" : "开始解析"}
      </button>

      {/* URL 导入：公开职位页 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
        <div className="text-sm font-semibold">或粘贴职位页链接</div>
        <p className="text-xs text-slate-400">
          适用于公司官网/校招网站等公开页面；Boss 直聘详情页有登录墙，请用截图
        </p>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleParseUrl()}
            placeholder="https://公司官网/careers/职位页"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleParseUrl}
            disabled={!url.trim() || loading}
            className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm disabled:opacity-40 hover:bg-slate-800"
          >
            {loading ? "抓取中…" : "抓取解析"}
          </button>
        </div>
      </div>

      {/* 粘贴文本：登录墙页面（如 Boss 直聘网页版）全选复制后贴进来 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
        <div className="text-sm font-semibold">或粘贴职位描述文本</div>
        <p className="text-xs text-slate-400">
          需要登录的页面（如 Boss 直聘网页版）：在你的浏览器里全选(Ctrl+A)复制职位内容，贴到这里
        </p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={4}
          placeholder="把职位详情页的文字整段粘贴进来，多余的界面文字会被自动过滤…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleParseText}
          disabled={!pasteText.trim() || loading}
          className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm disabled:opacity-40 hover:bg-slate-800"
        >
          {loading ? "解析中…" : "解析文本"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>
      )}

      {result && (
        <div className="space-y-3">
          <JDCard jd={result} />
          <Link
            href={`/match?jd=${result.id}`}
            className="inline-block text-sm text-indigo-600 hover:underline"
          >
            → 用我的简历匹配这个岗位
          </Link>
        </div>
      )}
    </div>
  );
}
