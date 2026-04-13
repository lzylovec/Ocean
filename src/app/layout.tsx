import type { Metadata } from "next";

import { TopNav } from "@/components/top-nav";

import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Ocean | 水下垃圾识别与数据管理 MVP",
  description: "面向水下垃圾治理的 AI 图像增强、识别、溯源与协同管理平台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className="app-body">
        <div className="app-shell">
          <TopNav />
          <div className="app-main">
            <header className="app-topbar">
              <div>
                <strong>治理工作台</strong>
                <p>面向采集、分析、核对与治理闭环的业务系统</p>
              </div>
              <div className="topbar-meta">
                <span className="inline-badge info">本地开发环境</span>
                <span className="inline-badge success">数据库已接通</span>
              </div>
            </header>
            <div className="app-content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
