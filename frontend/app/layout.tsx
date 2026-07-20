import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "求职助手 Agent",
  description: "招聘截图解析 + 简历匹配打分 + 模拟面试",
};

const nav = [
  { href: "/", label: "📸 解析截图", emoji: "" },
  { href: "/jd", label: "📋 JD 列表", emoji: "" },
  { href: "/match", label: "🎯 简历匹配", emoji: "" },
  { href: "/ask", label: "💬 岗位问答", emoji: "" },
  { href: "/interview", label: "🤖 模拟面试", emoji: "" },
  { href: "/prep", label: "📝 准备包", emoji: "" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* 导航栏 — 玻璃态渐变 */}
        <header className="sticky top-0 z-50" style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.95) 0%, rgba(109,40,217,0.95) 50%, rgba(91,33,182,0.95) 100%)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
        }}>
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              <span className="text-xl">🎯</span>
              <span className="font-bold text-white text-[17px] tracking-tight group-hover:opacity-90 transition-opacity">
                求职助手 Agent
              </span>
            </Link>
            <nav className="flex gap-1 overflow-x-auto">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/15 transition-all whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {/* 主内容 */}
        <main className="max-w-5xl mx-auto px-5 py-8 w-full flex-1 animate-fade-in">
          {children}
        </main>

        {/* 底部 */}
        <footer className="text-center text-xs text-slate-400 py-6">
          🎯 求职助手 Agent · 让每一次投递都有准备
        </footer>
      </body>
    </html>
  );
}
