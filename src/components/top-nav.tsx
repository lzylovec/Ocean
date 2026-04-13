"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/lib/project-data";

const statusItems = [
  "增强、检测、OCR、语义分析已联通",
  "垃圾身份证支持数据库持久化",
  "后台页支持记录核对与状态更新",
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <Link className="brand" href="/">
          Ocean
        </Link>
        <p className="brand-subtitle">水下垃圾识别与数据管理平台</p>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-label">工作区</span>
        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} className={`sidebar-link ${active ? "active" : ""}`} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-section sidebar-status">
        <span className="sidebar-label">系统状态</span>
        <div className="nav-pill sidebar-pill">
          <span className="status-dot success" />
          AI 工作流在线
        </div>
        <ul className="bullet-list compact">
          {statusItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
