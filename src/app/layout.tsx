import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { TopNav } from "@/components/top-nav";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { OceanBackdrop } from "@/components/ocean/ocean-backdrop";
import { Toaster } from "sonner";
import { Badge } from "@/components/ui/badge";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ocean | 水下垃圾识别与数据管理 MVP",
  description: "面向水下垃圾治理的 AI 图像增强、识别、溯源与协同管理平台。",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn("font-sans")} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary">
        <ThemeProvider>
          <QueryProvider>
            <OceanBackdrop />
            <div className="relative z-10 flex min-h-screen p-4 gap-4">
              <TopNav />
              <div className="flex-1 flex flex-col min-w-0 overflow-auto bg-background/80 backdrop-blur-md rounded-xl border border-border shadow-2xl relative">
                <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-5 border-b border-border bg-background/50 backdrop-blur-sm">
                  <div>
                    <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-3">
                      治理工作台
                      <div className="h-4 w-[1px] bg-border" />
                      <span className="text-sm font-medium text-muted-foreground">面向采集、分析、核对与治理闭环</span>
                    </h1>
                  </div>
                  <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-border bg-background/50 text-muted-foreground rounded-sm">本地开发环境</Badge>
                      <Badge className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors rounded-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5" />
                        数据库已接通
                      </Badge>
                    </div>
                  </div>
                </header>
                <main className="flex-1 p-8 lg:p-10">{children}</main>
              </div>
            </div>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
