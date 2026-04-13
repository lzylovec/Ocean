"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/project-data";

const statusItems = [
  "增强、检测、OCR、语义分析已联通",
  "垃圾身份证支持数据库持久化",
  "后台页支持记录核对与状态更新",
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-72 flex-shrink-0 border-r bg-slate-50/50 p-6 flex flex-col gap-8 overflow-y-auto">
      <div className="flex flex-col gap-1">
        <Link className="text-xl font-extrabold tracking-tight text-primary" href="/">
          Ocean
        </Link>
        <p className="text-xs text-muted-foreground">水下垃圾识别与数据管理平台</p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          工作区
        </span>
        <nav className="flex flex-col gap-1" aria-label="Primary">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-3 rounded-xl text-sm font-semibold transition-colors",
                  active
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-white hover:text-primary hover:shadow-sm"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 rounded-xl bg-white/80 border text-sm flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          系统状态
        </span>
        <div className="flex items-center gap-2 font-medium text-secondary">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
          </span>
          AI 工作流在线
        </div>
        <ul className="flex flex-col gap-2 text-xs text-muted-foreground list-disc pl-4">
          {statusItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
