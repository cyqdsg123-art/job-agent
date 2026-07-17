"use client";

/** JD 列表页：查看已解析的岗位，可删除或跳转匹配 */
import { useEffect, useState } from "react";
import Link from "next/link";
import JDCard from "@/components/JDCard";
import { deleteJD, listJDs } from "@/lib/api";
import type { JD } from "@/lib/types";

export default function JDListPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () =>
    listJDs()
      .then(setJds)
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  if (loading) return <p className="text-slate-400">加载中…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">已解析的岗位（{jds.length}）</h1>
      {jds.length === 0 && (
        <p className="text-slate-400 text-sm">
          还没有数据，去<Link href="/" className="text-indigo-600">首页</Link>上传一张招聘截图吧
        </p>
      )}
      {jds.map((jd) => (
        <div key={jd.id} className="space-y-1">
          <JDCard jd={jd} />
          <div className="flex gap-4 text-sm px-1">
            <Link href={`/match?jd=${jd.id}`} className="text-indigo-600 hover:underline">
              简历匹配
            </Link>
            <button
              onClick={async () => {
                await deleteJD(jd.id);
                refresh();
              }}
              className="text-slate-400 hover:text-rose-600"
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
