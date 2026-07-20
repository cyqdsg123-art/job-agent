/** 结构化 JD 展示卡片（玻璃态） */
import type { JD } from "@/lib/types";

export default function JDCard({ jd }: { jd: JD }) {
  return (
    <div className="card rounded-2xl p-5 space-y-3 animate-slide-up">
      {/* 标题行 */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-slate-800">
          {jd.title || "（未识别到岗位名）"}
        </h2>
        <span className="text-rose-500 font-bold text-sm bg-rose-50 px-3 py-1 rounded-full">
          {jd.salary || "薪资面议"}
        </span>
      </div>

      {/* 元信息 */}
      <div className="flex gap-3 flex-wrap text-[13px] text-slate-500">
        {jd.company && (
          <span className="flex items-center gap-1">
            <span className="text-base">🏢</span> {jd.company}
          </span>
        )}
        {jd.location && (
          <span className="flex items-center gap-1">
            <span className="text-base">📍</span> {jd.location}
          </span>
        )}
        {jd.education && (
          <span className="flex items-center gap-1">
            <span className="text-base">🎓</span> {jd.education}
          </span>
        )}
      </div>

      {/* 技能 */}
      {jd.skills.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[13px] font-semibold text-slate-600">技术技能</div>
          <div className="flex gap-1.5 flex-wrap">
            {jd.skills.map((s, i) => (
              <span key={i} className="tag tag-primary">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* 职责 */}
      {jd.duties.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[13px] font-semibold text-slate-600">岗位职责</div>
          <ul className="text-[13px] text-slate-500 list-disc pl-5 space-y-1">
            {jd.duties.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 加分项 */}
      {jd.bonus.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[13px] font-semibold text-amber-700">加分项</div>
          <div className="flex gap-1.5 flex-wrap">
            {jd.bonus.map((b, i) => (
              <span key={i} className="tag tag-accent">{b}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
