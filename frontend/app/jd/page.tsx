"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import JDCard from "@/components/JDCard";
import { deleteJD, listJDs } from "@/lib/api";
import type { JD } from "@/lib/types";

export default function JDListPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => listJDs().then(setJds).finally(() => setLoading(false));

  useEffect(() => { refresh(); }, []);

  if (loading) return (
    <div className="text-center py-20">
      <div className="text-4xl animate-bounce mb-3">🔍</div>
      <p className="text-slate-400">加载中…</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-800">已解析的岗位（{jds.length}）</h1>
      {jds.length === 0 && (
        <div className="card rounded-2xl p-8 text-center space-y-3">
          <div className="text-5xl">📭</div>
          <p className="text-slate-400">
            还没有数据——去<Link href="/" className="text-purple-600 font-semibold hover:underline">首页</Link>上传截图吧
          </p>
        </div>
      )}
      {jds.map((jd) => (
        <div key={jd.id} className="space-y-1 animate-slide-up">
          <JDCard jd={jd} />
          <div className="flex gap-5 text-[13px] px-3">
            <Link href={`/match?jd=${jd.id}`}
              className="text-purple-600 font-medium hover:underline">🎯 简历匹配</Link>
            <button onClick={async () => { await deleteJD(jd.id); refresh(); }}
              className="text-slate-400 hover:text-rose-600 transition-colors">删除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
