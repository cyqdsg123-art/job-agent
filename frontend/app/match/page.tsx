"use client";

/** 匹配页：选择 JD + 简历（PDF/文本）→ SSE 流式渲染匹配报告 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { listJDs, streamMatch } from "@/lib/api";
import type { JD, Profile, Scores } from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function MatchPageInner() {
  const params = useSearchParams();
  const [jds, setJds] = useState<JD[]>([]);
  const [jdId, setJdId] = useState<number>(0);
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [advice, setAdvice] = useState("");

  useEffect(() => {
    listJDs().then((list) => {
      setJds(list);
      const fromUrl = Number(params.get("jd"));
      if (fromUrl && list.some((j) => j.id === fromUrl)) setJdId(fromUrl);
      else if (list.length) setJdId(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setRunning(true);
    setError("");
    setProfile(null);
    setScores(null);
    setAdvice("");
    try {
      await streamMatch(
        jdId,
        { text: resumeText, file: resumeFile ?? undefined },
        {
          onProfile: setProfile,
          onScores: setScores,
          onAdviceDelta: (c) => setAdvice((prev) => prev + c),
          onError: setError,
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "匹配失败");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">简历-岗位匹配</h1>

      {/* 输入区 */}
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
                {jd.title} · {jd.company} · {jd.salary}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold block mb-1">
            简历（粘贴文本，或上传 PDF）
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={6}
            placeholder="粘贴你的简历内容：教育经历、技能、项目经历…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            className="mt-2 text-sm text-slate-500"
          />
        </div>

        <button
          onClick={start}
          disabled={running || !jdId || (!resumeText.trim() && !resumeFile)}
          className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700"
        >
          {running ? "分析中…" : "开始匹配"}
        </button>
        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{error}</p>
        )}
      </div>

      {/* 第一步：简历画像 */}
      {profile && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
          <h2 className="font-semibold">① 简历画像</h2>
          <p className="text-sm text-slate-600">🎓 {profile.education}</p>
          {profile.experience && (
            <p className="text-sm text-slate-600">💼 {profile.experience}</p>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {profile.skills?.map((s, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">
                {s}
              </span>
            ))}
          </div>
          {profile.projects?.length > 0 && (
            <ul className="text-sm text-slate-600 list-disc pl-5">
              {profile.projects.map((p, i) => (
                <li key={i}>
                  <b>{p.name}</b>：{p.highlights}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {running && !profile && <p className="text-sm text-slate-400">正在提取简历画像…</p>}

      {/* 第二步：维度评分 */}
      {scores && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">② 匹配评分</h2>
            <span className="text-2xl font-bold text-indigo-600">
              {scores.overall}
              <span className="text-sm text-slate-400 font-normal"> /100</span>
            </span>
          </div>
          {scores.dimensions.map((d, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{d.name}</span>
                <span className="font-semibold">{d.score}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreColor(d.score)} transition-all duration-700`}
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">{d.reason}</p>
            </div>
          ))}
          <p className="text-sm bg-slate-50 rounded-lg p-3">{scores.verdict}</p>
        </div>
      )}
      {running && profile && !scores && (
        <p className="text-sm text-slate-400">正在逐维度打分…</p>
      )}

      {/* 第三步：流式建议 */}
      {advice && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-2">③ 差距分析与建议</h2>
          <div className="prose prose-sm prose-slate max-w-none [&_h2]:text-base [&_h2]:mt-4">
            <ReactMarkdown>{advice}</ReactMarkdown>
          </div>
          {running && <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse" />}
        </div>
      )}
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">加载中…</p>}>
      <MatchPageInner />
    </Suspense>
  );
}
