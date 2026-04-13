import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TopNav } from "@/components/top-nav";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "sonner";
import { Badge } from "@/components/ui/badge";

import "./globals.css";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "Ocean | 水下垃圾识别与数据管理 MVP",
  description: "面向水下垃圾治理的 AI 图像增强、识别、溯源与协同管理平台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased flex">
        <ThemeProvider>
          <QueryProvider>
            <div className="flex w-full min-h-screen">
              <TopNav />
              <div className="flex-1 flex flex-col min-w-0 overflow-auto">
                <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-8 py-4 border-b bg-background/90 backdrop-blur">
                  <div>
                    <strong className="block text-base">治理工作台</strong>
                    <p className="mt-1 text-sm text-muted-foreground">面向采集、分析、核对与治理闭环的业务系统</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Badge variant="secondary">本地开发环境</Badge>
                    <Badge variant="default" className="bg-secondary text-secondary-foreground hover:bg-secondary/80">数据库已接通</Badge>
                  </div>
                </header>
                <main className="flex-1 p-8">{children}</main>
              </div>
            </div>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
