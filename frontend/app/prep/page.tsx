"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { listJDs, streamPrep } from "@/lib/api";
import type { JD } from "@/lib/types";

export default function PrepPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [jdId, setJdId] = useState(0);
  const [resume, setResume] = useState("");
  const [repo, setRepo] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => { listJDs().then((list) => { setJds(list); if (list.length) setJdId(list[0].id); }); setResume(localStorage.getItem("resume_text") ?? ""); }, []);

  const generate = async () => {
    if (!jdId || !resume.trim()) return; setRunning(true); setError(""); setDoc(""); setFinished(false);
    localStorage.setItem("resume_text", resume);
    try { await streamPrep(jdId, resume, repo, { onDelta: (c) => setDoc((p) => p + c), onDone: () => setFinished(true), onError: setError }); }
    catch (e) { setError(e instanceof Error ? e.message : "生成失败"); }
    finally { setRunning(false); }
  };

  const download = () => {
    const jd = jds.find((j) => j.id === jdId); const blob = new Blob([doc], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `面试准备包-${jd?.title ?? jdId}.md`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-800">📝 面试准备包</h1><p className="text-sm text-slate-500 mt-1">考点拆解 + 高频题 + 追问预判 + STAR 脚本 + 反问建议</p></div>

      <div className="card rounded-2xl p-5 space-y-4">
        <div><label className="text-sm font-semibold text-slate-700 block mb-1.5">选择岗位</label><select value={jdId} onChange={(e) => setJdId(Number(e.target.value))} className="select">{jds.length === 0 ? <option value={0}>（请先在首页解析 JD）</option> : jds.map((jd) => (<option key={jd.id} value={jd.id}>{jd.title} · {jd.company}</option>))}</select></div>
        <div><label className="text-sm font-semibold text-slate-700 block mb-1.5">你的简历</label><textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={5} placeholder="粘贴简历内容" className="textarea" /></div>
        <div><label className="text-sm font-semibold text-slate-700 block mb-1.5">代码仓库（可选）</label><input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="本地路径或 GitHub 链接" className="input" /><p className="text-xs text-slate-400 mt-1">已分析过的仓库秒级复用</p></div>
        <button onClick={generate} disabled={running || !jdId || !resume.trim()} className="btn btn-primary w-full justify-center">{running ? "⏳ 生成中…" : "🚀 生成准备包"}</button>
        {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-2xl p-3">{error}</p>}
      </div>

      {doc && (
        <div className="card rounded-2xl p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700">备考文档</h2>
            {finished && <button onClick={download} className="btn btn-primary text-[13px]">⬇ 下载 Markdown</button>}
          </div>
          <div className="prose-custom"><ReactMarkdown>{doc}</ReactMarkdown></div>
          {running && <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse rounded ml-1" />}
        </div>
      )}
    </div>
  );
}
