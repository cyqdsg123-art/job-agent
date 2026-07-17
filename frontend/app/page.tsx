"use client";

/** 首页：上传招聘截图 → OCR + LLM 解析 → 展示结构化 JD */
import { useRef, useState } from "react";
import Link from "next/link";
import JDCard from "@/components/JDCard";
import { parseJD } from "@/lib/api";
import type { JD } from "@/lib/types";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
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
          <p className="text-slate-400">点击选择或拖拽截图到这里</p>
        )}
      </div>

      <button
        onClick={handleParse}
        disabled={!file || loading}
        className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
      >
        {loading ? "解析中（OCR + LLM，约 10 秒）…" : "开始解析"}
      </button>

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
