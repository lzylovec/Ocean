"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/project-data";
import { LayoutDashboard, Database, Camera, Activity, History } from "lucide-react";

const statusItems = [
  "增强、检测、OCR、语义分析已联通",
  "垃圾身份证支持数据库持久化",
  "后台页支持记录核对与状态更新",
];

const iconMap: Record<string, React.ElementType> = {
  "/": LayoutDashboard,
  "/collect": Camera,
  "/jobs": History,
  "/dashboard": Activity,
  "/admin/trash": Database,
};

export function TopNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-[calc(100vh-2rem)] w-[260px] flex-shrink-0 bg-card rounded-xl p-6 flex flex-col gap-8 overflow-y-auto relative z-30 border border-border shadow-sm">

      <div className="flex flex-col gap-1 relative z-10 pt-2">
        <Link className="text-xl font-bold tracking-tight text-foreground flex items-center gap-3 group" href="/">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/30 text-primary">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l3-9 5 18 3-9h5" />
            </svg>
          </div>
          <span>Ocean</span>
        </Link>
        <p className="text-[11px] text-muted-foreground font-medium mt-2">水下垃圾识别系统</p>
      </div>

      <div className="flex flex-col gap-4 mt-6 relative z-10">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">
          Workspace
        </span>
        <nav className="flex flex-col gap-1" aria-label="Primary">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = iconMap[item.href] || LayoutDashboard;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative group px-3 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-3 overflow-hidden",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="relative z-10">
                  {item.label}
                </span>

                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-sm" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto relative z-10 group cursor-default">
        <div className="relative p-4 flex flex-col gap-4 bg-background border border-border rounded-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <div className="flex items-center gap-2 font-semibold text-primary text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            AI 工作流在线
          </div>
          <ul className="flex flex-col gap-2 text-[10px] text-muted-foreground">
            {statusItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-primary/50 mt-0.5">›</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
