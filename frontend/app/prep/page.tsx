"use client";

/** 面试准备包页：选 JD + 简历（+可选仓库）→ 流式生成备考文档，可下载 */
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

  useEffect(() => {
    listJDs().then((list) => {
      setJds(list);
      if (list.length) setJdId(list[0].id);
    });
    setResume(localStorage.getItem("resume_text") ?? "");
  }, []);

  const generate = async () => {
    if (!jdId || !resume.trim()) return;
    setRunning(true);
    setError("");
    setDoc("");
    setFinished(false);
    localStorage.setItem("resume_text", resume);
    try {
      await streamPrep(jdId, resume, repo, {
        onDelta: (c) => setDoc((prev) => prev + c),
        onDone: () => setFinished(true),
        onError: setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setRunning(false);
    }
  };

  const download = () => {
    const jd = jds.find((j) => j.id === jdId);
    const blob = new Blob([doc], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `面试准备包-${jd?.title ?? jdId}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">面试准备包</h1>
        <p className="text-sm text-slate-500 mt-1">
          针对岗位生成：考点拆解 + 高频题与回答要点 + 追问预判 + 项目讲述脚本 + 反问建议
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold block mb-1">选择岗位</label>
          <select
            value={jdId}
            onChange={(e) => setJdId(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {jds.length === 0 && <option value={0}>（请先在首页解析一个 JD）</option>}
            {jds.map((jd) => (
              <option key={jd.id} value={jd.id}>
                {jd.title} · {jd.company}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1">你的简历</label>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={5}
            placeholder="粘贴简历内容（与模拟面试共用，自动记忆）"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-semibold block mb-1">代码仓库（可选）</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="本地路径或 GitHub/Gitee 链接（已分析过的仓库秒级复用）"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={generate}
          disabled={running || !jdId || !resume.trim()}
          className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
        >
          {running ? "生成中…" : "生成准备包"}
        </button>
        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>
        )}
      </div>

      {doc && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">备考文档</h2>
            {finished && (
              <button
                onClick={download}
                className="text-sm text-indigo-600 hover:underline"
              >
                ⬇ 下载 Markdown
              </button>
            )}
          </div>
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown>{doc}</ReactMarkdown>
          </div>
          {running && <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse" />}
        </div>
      )}
    </div>
  );
}
