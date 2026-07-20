"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { listJDs, streamMatch } from "@/lib/api";
import type { JD, Profile, Scores } from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 80) return "progress-high";
  if (score >= 60) return "progress-mid";
  return "progress-low";
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
    setResumeText(localStorage.getItem("resume_text") ?? "");
  }, []);

  const start = async () => {
    setRunning(true); setError(""); setProfile(null); setScores(null); setAdvice("");
    try {
      await streamMatch(jdId,
        { text: resumeText, file: resumeFile ?? undefined },
        { onProfile: setProfile, onScores: setScores,
          onAdviceDelta: (c) => setAdvice((p) => p + c), onError: setError });
    } catch (e) {
      setError(e instanceof Error ? e.message : "匹配失败");
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-800">🎯 简历匹配</h1>

      {/* 输入区 */}
      <div className="card rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1.5">选择岗位</label>
          <select value={jdId} onChange={(e) => setJdId(Number(e.target.value))}
            className="select">
            {jds.length === 0 && <option value={0}>（请先在首页解析一个 JD）</option>}
            {jds.map((jd) => (
              <option key={jd.id} value={jd.id}>{jd.title} · {jd.company} · {jd.salary}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1.5">简历</label>
          <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)}
            rows={6} placeholder="粘贴简历：教育经历、技能、项目经历…" className="textarea" />
          <input type="file" accept=".pdf"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            className="mt-2 text-[13px] text-slate-400" />
        </div>
        <button onClick={start} disabled={running || !jdId || (!resumeText.trim() && !resumeFile)}
          className="btn btn-primary w-full justify-center">
          {running ? "⏳ 分析中…" : "🚀 开始匹配"}
        </button>
        {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-2xl p-3">{error}</p>}
      </div>

      {/* 画像 */}
      {profile && (
        <div className="card rounded-2xl p-5 space-y-2 animate-slide-up">
          <h2 className="font-semibold text-slate-700">① 简历画像</h2>
          <p className="text-sm text-slate-600">🎓 {profile.education}</p>
          {profile.experience && <p className="text-sm text-slate-600">💼 {profile.experience}</p>}
          <div className="flex gap-1.5 flex-wrap">
            {profile.skills?.map((s, i) => (
              <span key={i} className="tag tag-primary">{s}</span>
            ))}
          </div>
          {profile.projects?.length > 0 && (
            <ul className="text-sm text-slate-600 list-disc pl-5">
              {profile.projects.map((p, i) => (
                <li key={i}><b>{p.name}</b>：{p.highlights}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {running && !profile && <p className="text-sm text-purple-500 animate-pulse-soft">正在提取简历画像…</p>}

      {/* 评分 */}
      {scores && (
        <div className="card rounded-2xl p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">② 匹配评分</h2>
            <span className="text-3xl font-extrabold text-purple-600">
              {scores.overall}<span className="text-sm text-slate-400 font-normal">/100</span>
            </span>
          </div>
          {scores.dimensions.map((d, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{d.name}</span>
                <span className="font-bold text-slate-700">{d.score}</span>
              </div>
              <div className="progress">
                <div className={`progress-fill ${scoreColor(d.score)}`}
                  style={{ width: `${d.score}%` }} />
              </div>
              <p className="text-xs text-slate-500">{d.reason}</p>
            </div>
          ))}
          <p className="text-sm bg-violet-50 text-violet-800 rounded-xl p-4 font-medium">{scores.verdict}</p>
        </div>
      )}
      {running && profile && !scores && <p className="text-sm text-purple-500 animate-pulse-soft">正在逐维度打分…</p>}

      {/* 建议 */}
      {advice && (
        <div className="card rounded-2xl p-5 animate-slide-up">
          <h2 className="font-semibold text-slate-700 mb-3">③ 差距分析与建议</h2>
          <div className="prose-custom">
            <ReactMarkdown>{advice}</ReactMarkdown>
          </div>
          {running && <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse rounded ml-1" />}
        </div>
      )}
    </div>
  );
}

export default function MatchPage() {
  return (
    <Suspense fallback={<p className="text-slate-400 text-center py-20">加载中…</p>}>
      <MatchPageInner />
    </Suspense>
  );
}
