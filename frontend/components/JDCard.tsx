/** 结构化 JD 展示卡片（首页解析结果与列表页共用） */
import type { JD } from "@/lib/types";

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${color}`}>
      {text}
    </span>
  );
}

export default function JDCard({ jd }: { jd: JD }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold">{jd.title || "（未识别到岗位名）"}</h2>
        <span className="text-rose-600 font-semibold">{jd.salary}</span>
      </div>
      <div className="text-sm text-slate-500 flex gap-3 flex-wrap">
        {jd.company && <span>🏢 {jd.company}</span>}
        {jd.location && <span>📍 {jd.location}</span>}
        {jd.education && <span>🎓 {jd.education}</span>}
      </div>

      {jd.skills.length > 0 && (
        <div className="space-y-1">
          <div className="text-sm font-semibold">技能要求</div>
          <div className="flex gap-1.5 flex-wrap">
            {jd.skills.map((s, i) => (
              <Tag key={i} text={s} color="bg-indigo-50 text-indigo-700" />
            ))}
          </div>
        </div>
      )}

      {jd.duties.length > 0 && (
        <div className="space-y-1">
          <div className="text-sm font-semibold">岗位职责</div>
          <ul className="text-sm text-slate-600 list-disc pl-5 space-y-0.5">
            {jd.duties.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {jd.bonus.length > 0 && (
        <div className="space-y-1">
          <div className="text-sm font-semibold">加分项</div>
          <div className="flex gap-1.5 flex-wrap">
            {jd.bonus.map((b, i) => (
              <Tag key={i} text={b} color="bg-amber-50 text-amber-700" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
