"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { deleteKBDoc, listKBDocs, streamAsk, uploadKBDoc } from "@/lib/api";
import type { KBDocMeta, KBSource } from "@/lib/types";

export default function AskPage() {
  const [docs, setDocs] = useState<KBDocMeta[]>([]);
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<KBSource[]>([]);
  const [answer, setAnswer] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listKBDocs().then(setDocs); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [answer]);

  const ask = async () => {
    if (!question.trim()) return;
    setRunning(true); setError(""); setSources([]); setAnswer("");
    try { await streamAsk(question, { onSources: setSources, onAnswerDelta: (c) => setAnswer((p) => p + c), onError: setError }); }
    catch (e) { setError(e instanceof Error ? e.message : "问答失败"); }
    finally { setRunning(false); }
  };

  const upload = async (file?: File) => {
    if (!file) return; setUploading(true);
    try { await uploadKBDoc({ file }); setDocs(await listKBDocs()); }
    catch (e) { setError(e instanceof Error ? e.message : "上传失败"); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">💬 岗位问答</h1>
        <p className="text-sm text-slate-500 mt-1">基于 JD 知识库和上传的资料，回答求职相关问题</p>
      </div>

      <div className="card rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">📚</span>
          <span className="text-slate-600">知识库已有</span>
          <span className="font-bold text-purple-600">{docs.length}</span>
          <span className="text-slate-600">篇文档</span>
        </div>
        <label className="btn btn-secondary cursor-pointer text-[13px]">
          {uploading ? "上传中…" : "+ 上传资料"}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md" className="hidden"
            onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </div>

      <div className="card rounded-2xl p-4 flex gap-2">
        <input value={question} onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="哪些岗位对英语有要求？对比各岗位薪资？" className="input flex-1" />
        <button onClick={ask} disabled={running || !question.trim()}
          className="btn btn-primary shrink-0">{running ? "…" : "提问"}</button>
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-2xl p-3">{error}</p>}

      {sources.length > 0 && (
        <div className="card rounded-2xl p-4 animate-slide-up">
          <details>
            <summary className="text-sm font-semibold text-slate-600 cursor-pointer">
              引用来源（{sources.length} 条）
            </summary>
            <div className="mt-2 space-y-2">
              {sources.map((s, i) => (
                <div key={s.chunk_id} className="bg-violet-50/70 rounded-xl p-3 text-[13px] space-y-1 border border-violet-100">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-purple-700">[{i + 1}] {s.title}</span>
                    <span className="text-xs bg-white text-purple-500 px-2 py-0.5 rounded-full">
                      {s.channels.includes("vector") ? "🔍语义" : ""}
                      {s.channels.includes("bm25") ? " 🔑关键词" : ""}
                    </span>
                  </div>
                  <p className="text-slate-500 line-clamp-2">{s.text}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {answer && (
        <div className="card rounded-2xl p-5 animate-slide-up">
          <div className="prose-custom">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
          {running && <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse rounded ml-1" />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
