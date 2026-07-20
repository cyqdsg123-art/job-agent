"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { answerInterview, listJDs, startInterview } from "@/lib/api";
import type { JD } from "@/lib/types";

interface Msg {
  kind: "question" | "answer" | "feedback" | "report";
  text: string; meta?: string;
}

export default function InterviewPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [jdId, setJdId] = useState(0);
  const [resume, setResume] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [repo, setRepo] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listJDs().then((list) => { setJds(list); if (list.length) setJdId(list[0].id); }); setResume(localStorage.getItem("resume_text") ?? ""); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const appendTo = (kind: Msg["kind"], chunk: string) => {
    setMsgs((prev) => { const next = [...prev]; const last = next[next.length - 1]; if (last?.kind === kind) next[next.length - 1] = { ...last, text: last.text + chunk }; else next.push({ kind, text: chunk }); return next; });
  };

  const start = async () => {
    if (!jdId || !resume.trim()) return; setBusy(true); setError("");
    localStorage.setItem("resume_text", resume);
    try { const r = await startInterview(jdId, resume, repo, resumeFile ?? undefined); setSessionId(r.session_id); setMsgs([{ kind: "question", text: r.question, meta: `第 ${r.round}/${r.total_rounds} 题 · ${r.focus}` }]); }
    catch (e) { setError(e instanceof Error ? e.message : "开始失败"); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!sessionId || !input.trim() || busy) return; const ans = input.trim(); setInput(""); setBusy(true); setError("");
    setMsgs((prev) => [...prev, { kind: "answer", text: ans }]);
    try { await answerInterview(sessionId, ans, { onFeedbackDelta: (c) => appendTo("feedback", c), onQuestion: (q) => setMsgs((prev) => [...prev, { kind: "question", text: q.question, meta: `第 ${q.round}/${q.total_rounds} 题 · ${q.focus}` }]), onReportDelta: (c) => appendTo("report", c), onDone: () => setFinished(true), onError: setError }); }
    catch (e) { setError(e instanceof Error ? e.message : "提交失败"); }
    finally { setBusy(false); }
  };

  const reset = () => { setSessionId(null); setMsgs([]); setFinished(false); setError(""); };

  if (sessionId === null) {
    return (
      <div className="space-y-5">
        <div><h1 className="text-2xl font-extrabold text-slate-800">🤖 模拟面试</h1><p className="text-sm text-slate-500 mt-1">AI 面试官基于 JD + 你的简历 + 代码仓库出题，5 轮流式点评</p></div>
        <div className="card rounded-2xl p-5 space-y-4">
          <div><label className="text-sm font-semibold text-slate-700 block mb-1.5">选择岗位</label><select value={jdId} onChange={(e) => setJdId(Number(e.target.value))} className="select">{jds.length === 0 ? <option value={0}>（请先在首页解析 JD）</option> : jds.map((jd) => (<option key={jd.id} value={jd.id}>{jd.title} · {jd.company}</option>))}</select></div>
          <div><label className="label">你的简历</label><textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={6} placeholder="粘贴简历内容" className="textarea" /><label className="file-upload">📎 上传简历文件（PDF/图片/文本）<input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md" onChange={(e) => { const f = e.target.files?.[0]; if (f) setResumeFile(f); }} /></label>{resumeFile && <p className="text-xs text-purple-600 mt-1">已选择: {resumeFile.name}</p>}</div>
          <div><label className="label">代码仓库（可选）</label><input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="本地路径或 GitHub 链接" className="input" /><p className="text-xs text-slate-400 mt-1">面试官将读你的真实代码提问</p></div>
          <button onClick={start} disabled={busy || !jdId || !resume.trim()} className="btn btn-primary w-full justify-center">{busy ? "⏳ 准备中…" : "🚀 开始面试"}</button>
          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-2xl p-3">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-800">🤖 模拟面试</h1>
        <button onClick={reset} className="text-sm text-slate-400 hover:text-purple-600">{finished ? "再来一场" : "放弃"}</button>
      </div>
      <div className="space-y-3">
        {msgs.map((m, i) => {
          if (m.kind === "question") return <div key={i} className="card rounded-2xl p-4 border-l-4 border-l-purple-500 animate-slide-up">{m.meta && <div className="text-xs text-purple-500 font-semibold mb-1">{m.meta}</div>}<div className="text-sm font-semibold text-slate-700">🧑‍💼 {m.text}</div></div>;
          if (m.kind === "answer") return <div key={i} className="bg-gradient-to-r from-purple-600 to-violet-700 text-white rounded-2xl rounded-tr-md p-4 ml-8 text-sm whitespace-pre-wrap shadow-lg shadow-purple-200 animate-slide-up">{m.text}</div>;
          if (m.kind === "feedback") return <div key={i} className="card rounded-2xl p-4 border border-amber-200 animate-slide-up"><div className="text-xs text-amber-600 font-semibold mb-1">💬 面试官点评</div><div className="prose-custom"><ReactMarkdown>{m.text}</ReactMarkdown></div></div>;
          return <div key={i} className="card rounded-2xl p-5 border-2 border-emerald-200 animate-slide-up"><div className="text-sm font-bold text-emerald-700 mb-2">📋 面试总结报告</div><div className="prose-custom"><ReactMarkdown>{m.text}</ReactMarkdown></div></div>;
        })}
        {busy && <p className="text-sm text-purple-500 animate-pulse-soft">面试官思考中…</p>}
        <div ref={bottomRef} />
      </div>
      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-2xl p-3">{error}</p>}
      {!finished && (
        <div className="flex gap-2 sticky bottom-4">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }} rows={3} placeholder="输入回答（Ctrl+Enter 提交）…" className="textarea !bg-white shadow-lg" disabled={busy} />
          <button onClick={submit} disabled={busy || !input.trim()} className="btn btn-primary shrink-0 self-end">提交</button>
        </div>
      )}
    </div>
  );
}
