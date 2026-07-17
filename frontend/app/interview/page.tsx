"use client";

/** 模拟面试页：选岗位+简历 → 5 轮问答（流式点评）→ 总结报告 */
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { answerInterview, listJDs, startInterview } from "@/lib/api";
import type { JD } from "@/lib/types";

/** 对话消息：面试官提问 / 我的回答 / 点评 / 报告 */
interface Msg {
  kind: "question" | "answer" | "feedback" | "report";
  text: string;
  meta?: string; // 题号/考察点
}

export default function InterviewPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [jdId, setJdId] = useState(0);
  const [resume, setResume] = useState("");
  const [repo, setRepo] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listJDs().then((list) => {
      setJds(list);
      if (list.length) setJdId(list[0].id);
    });
    setResume(localStorage.getItem("resume_text") ?? "");
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  /** 更新最后一条指定类型消息的文本（流式追加用） */
  const appendTo = (kind: Msg["kind"], chunk: string) => {
    setMsgs((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.kind === kind) {
        next[next.length - 1] = { ...last, text: last.text + chunk };
      } else {
        next.push({ kind, text: chunk });
      }
      return next;
    });
  };

  const start = async () => {
    if (!jdId || !resume.trim()) return;
    setBusy(true);
    setError("");
    localStorage.setItem("resume_text", resume);
    try {
      const r = await startInterview(jdId, resume, repo);
      setSessionId(r.session_id);
      setMsgs([
        {
          kind: "question",
          text: r.question,
          meta: `第 ${r.round}/${r.total_rounds} 题 · ${r.focus}`,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "开始失败");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!sessionId || !input.trim() || busy) return;
    const ans = input.trim();
    setInput("");
    setBusy(true);
    setError("");
    setMsgs((prev) => [...prev, { kind: "answer", text: ans }]);
    try {
      await answerInterview(sessionId, ans, {
        onFeedbackDelta: (c) => appendTo("feedback", c),
        onQuestion: (q) =>
          setMsgs((prev) => [
            ...prev,
            {
              kind: "question",
              text: q.question,
              meta: `第 ${q.round}/${q.total_rounds} 题 · ${q.focus}`,
            },
          ]),
        onReportDelta: (c) => appendTo("report", c),
        onDone: () => setFinished(true),
        onError: setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSessionId(null);
    setMsgs([]);
    setFinished(false);
    setError("");
  };

  // 未开始：配置界面
  if (sessionId === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">模拟面试</h1>
          <p className="text-sm text-slate-500 mt-1">
            AI 面试官基于岗位 JD 和你的简历出题，5 轮问答 + 逐轮点评 + 总结报告
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
              rows={6}
              placeholder="粘贴简历内容（会记住，下次不用重复粘贴）"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">
              你的代码仓库（可选，强烈推荐）
            </label>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="本地路径（如 D:\job-agent）或 GitHub/Gitee 链接"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              提供后面试官会读你的真实代码，针对具体实现提问（首次分析约 30 秒）
            </p>
          </div>
          <button
            onClick={start}
            disabled={busy || !jdId || !resume.trim()}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
          >
            {busy ? (repo.trim() ? "分析仓库并准备第一题中…" : "面试官准备第一题中…") : "开始面试"}
          </button>
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // 面试进行中/结束：对话界面
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">模拟面试</h1>
        <button onClick={reset} className="text-sm text-slate-400 hover:text-indigo-600">
          {finished ? "再来一场" : "放弃本场"}
        </button>
      </div>

      <div className="space-y-3">
        {msgs.map((m, i) => {
          if (m.kind === "question")
            return (
              <div key={i} className="bg-white rounded-xl border border-indigo-200 p-4">
                {m.meta && <div className="text-xs text-indigo-500 mb-1">{m.meta}</div>}
                <div className="text-sm font-medium">🧑‍💼 {m.text}</div>
              </div>
            );
          if (m.kind === "answer")
            return (
              <div key={i} className="bg-indigo-600 text-white rounded-xl p-4 ml-12 text-sm whitespace-pre-wrap">
                {m.text}
              </div>
            );
          if (m.kind === "feedback")
            return (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <div className="text-xs text-amber-600 mb-1">💬 面试官点评</div>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              </div>
            );
          return (
            <div key={i} className="bg-white rounded-xl border border-emerald-200 p-4">
              <div className="text-xs text-emerald-600 mb-1">📋 面试总结报告</div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            </div>
          );
        })}
        {busy && <p className="text-sm text-slate-400 animate-pulse">面试官思考中…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>}

      {!finished && (
        <div className="flex gap-2 sticky bottom-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
            rows={3}
            placeholder="输入你的回答（Ctrl+Enter 提交）…"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
            disabled={busy}
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            className="px-5 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
          >
            提交
          </button>
        </div>
      )}
    </div>
  );
}
