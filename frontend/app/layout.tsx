import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "求职助手 Agent",
  description: "招聘截图解析 + 简历匹配打分",
};

const nav = [
  { href: "/", label: "解析截图" },
  { href: "/jd", label: "JD 列表" },
  { href: "/match", label: "简历匹配" },
  { href: "/ask", label: "岗位问答" },
  { href: "/interview", label: "模拟面试" },
  { href: "/prep", label: "准备包" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-6">
            <span className="font-bold text-indigo-600">🎯 求职助手 Agent</span>
            <nav className="flex gap-4 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-slate-600 hover:text-indigo-600"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
