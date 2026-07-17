"use client";

/** 岗位问答页：知识库上传管理 + 混合检索流式问答（带引用） */
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { deleteKBDoc, listKBDocs, streamAsk, uploadKBDoc } from "@/lib/api";
import type { KBDocMeta, KBSource } from "@/lib/types";

const EXAMPLES = [
  "哪些岗位不要求实习经验？",
  "对英语有要求的岗位有哪些？",
  "对比一下各岗位的薪资和地点",
];

export default function AskPage() {
  const [docs, setDocs] = useState<KBDocMeta[]>([]);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<KBSource[]>([]);
  const [answer, setAnswer] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshDocs = () => listKBDocs().then(setDocs).catch(() => {});
  useEffect(() => {
    refreshDocs();
  }, []);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadKBDoc({ file });
      refreshDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const ask = async (q: string) => {
    if (!q.trim() || running) return;
    setRunning(true);
    setError("");
    setSources([]);
    setAnswer("");
    try {
      await streamAsk(q, {
        onSources: setSources,
        onAnswerDelta: (c) => setAnswer((prev) => prev + c),
        onError: setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "问答失败");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">岗位问答</h1>
        <p className="text-sm text-slate-500 mt-1">
          基于知识库（已解析的 JD + 你上传的资料）混合检索后回答，带引用来源
        </p>
      </div>

      {/* 知识库管理 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">知识库文档（{docs.length}）</h2>
          <label className="text-sm text-indigo-600 cursor-pointer hover:underline">
            {uploading ? "上传解析中…" : "+ 上传面经/资料（pdf/图片/txt）"}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {docs.length === 0 && (
            <span className="text-xs text-slate-400">
              空的——去首页解析 JD 会自动入库，也可以上传资料
            </span>
          )}
          {docs.map((d) => (
            <span
              key={d.id}
              className={`group inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                d.source === "jd" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {d.title}
              <button
                onClick={() => deleteKBDoc(d.id).then(refreshDocs)}
                className="opacity-40 hover:opacity-100"
                title="删除"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* 提问区 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            placeholder="问问你的知识库，比如：哪个岗位最适合我投？"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => ask(question)}
            disabled={running || !question.trim()}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
          >
            {running ? "检索中…" : "提问"}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuestion(ex);
                ask(ex);
              }}
              className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              {ex}
            </button>
          ))}
        </div>
        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>
        )}
      </div>

      {/* 回答 */}
      {answer && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-2">回答</h2>
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
          {running && <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse" />}
        </div>
      )}

      {/* 引用来源 */}
      {sources.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <h2 className="font-semibold text-sm">引用来源（混合检索 Top {sources.length}）</h2>
          {sources.map((s, i) => (
            <details key={s.chunk_id} className="text-sm border-b border-slate-100 pb-2">
              <summary className="cursor-pointer text-slate-700">
                [{i + 1}]《{s.title}》
                <span className="ml-2 text-xs text-slate-400">
                  {s.channels.map((c) => (c === "vector" ? "语义" : "关键词")).join(" + ")}
                  命中 · RRF {s.rrf_score}
                </span>
              </summary>
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{s.text}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
