"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/project-data";
import { motion } from "framer-motion";
import { LayoutDashboard, Database, Camera, Activity } from "lucide-react";

const statusItems = [
  "增强、检测、OCR、语义分析已联通",
  "垃圾身份证支持数据库持久化",
  "后台页支持记录核对与状态更新",
];

const iconMap: Record<string, React.ElementType> = {
  "/": LayoutDashboard,
  "/collect": Camera,
  "/dashboard": Activity,
  "/admin/trash": Database,
};

export function TopNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-72 flex-shrink-0 glass-panel p-6 flex flex-col gap-8 overflow-y-auto relative z-30">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none -z-10" />

      <div className="flex flex-col gap-1 relative z-10">
        <Link className="text-2xl font-extrabold tracking-tight text-gradient flex items-center gap-2" href="/">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l3-9 5 18 3-9h5" />
            </svg>
          </div>
          Ocean
        </Link>
        <p className="text-xs text-muted-foreground font-medium mt-1">水下垃圾识别与数据管理平台</p>
      </div>

      <div className="flex flex-col gap-3 mt-4 relative z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-4">
          工作区
        </span>
        <nav className="flex flex-col gap-1.5" aria-label="Primary">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = iconMap[item.href] || LayoutDashboard;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative group px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-3 overflow-hidden"
              >
                {active && (
                  <motion.div
                    layoutId="active-nav-bg"
                    className="absolute inset-0 bg-white/10 shadow-sm border border-white/15 rounded-xl -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {!active && (
                  <div className="absolute inset-0 bg-white/6 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl -z-10" />
                )}

                <Icon className={cn(
                  "w-4 h-4 transition-colors duration-300",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )} />
                <span className={cn(
                  "relative z-10 transition-colors duration-300",
                  active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  {item.label}
                </span>

                {active && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto glass-card p-5 rounded-2xl text-sm flex flex-col gap-4 relative z-10 overflow-hidden group">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary/10 rounded-full blur-2xl group-hover:bg-secondary/20 transition-all duration-500" />

        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          系统状态
        </span>
        <div className="flex items-center gap-2.5 font-semibold text-secondary">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary/60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </div>
          AI 工作流在线
        </div>
        <ul className="flex flex-col gap-2.5 text-xs text-muted-foreground/80 font-medium">
          {statusItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 text-secondary/50 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
