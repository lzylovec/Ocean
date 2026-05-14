# Ocean Glass（海雾玻璃）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全站 UI 升级为“海雾玻璃 + 海洋微动态”视觉（暗色为主、亮色简版），并保证可读性、可维护性与降级能力。

**Architecture:** 在 Next.js 根布局注入全局背景组件（OceanBackdrop）与统一的 CSS tokens；通过 shadcn 主题变量与少量 Tailwind utilities 统一玻璃表面；使用 `next-themes` 提供暗/亮切换，亮色模式自动降级动效与光晕。

**Tech Stack:** Next.js(App Router) + Tailwind CSS + shadcn/ui + framer-motion（可选）+ next-themes + Vitest + Testing Library

---

## 文件结构（本计划将创建/修改的文件）

**Create**
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/ocean/ocean-backdrop.tsx`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/providers/theme-provider.tsx`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/theme-toggle.tsx`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/vitest.config.ts`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/test/setup.ts`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/ocean/ocean-backdrop.test.tsx`

**Modify**
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/package.json`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/globals.css`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/layout.tsx`
- `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/top-nav.tsx`

---

### Task 1: 引入主题切换（暗色默认 + 亮色简版入口）

**Files:**
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/package.json`
- Create: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/providers/theme-provider.tsx`
- Create: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/theme-toggle.tsx`
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/layout.tsx`

- [ ] **Step 1: 安装依赖**

Run:
```bash
npm i next-themes
npm i -D vitest vite @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jsdom
```

Expected: `package.json` 出现以上依赖项。

- [ ] **Step 2: 增加测试脚本**

将 `package.json` 的 `scripts` 调整为：
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 3: 新增 ThemeProvider**

Create `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/providers/theme-provider.tsx`：
```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 4: 新增 ThemeToggle（放到 TopNav 使用）**

Create `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/theme-toggle.tsx`：
```tsx
"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="切换主题"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 5: 在 RootLayout 注入 ThemeProvider**

Modify `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/layout.tsx`：
1) 新增导入：
```tsx
import { ThemeProvider } from "@/components/providers/theme-provider";
```
2) 用 `ThemeProvider` 包裹当前的应用内容（确保 `ThemeToggle` 渲染时已处于 provider 内）。本文件的最终结构以 Task 4 提供的完整 `layout.tsx` 为准。

- [ ] **Step 6: 运行 Next.js 确认可用**

Run:
```bash
npm run dev
```

Expected: 页面正常渲染；控制台无 `next-themes` 相关错误。

- [ ] **Step 7: Commit（可选，按你的工作流）**

```bash
git add package.json package-lock.json src/app/layout.tsx src/components/providers/theme-provider.tsx src/components/theme-toggle.tsx
git commit -m "feat(ui): add theme provider and toggle"
```

---

### Task 2: 落地 Ocean Glass Tokens（暗色主、亮色简版）

**Files:**
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/globals.css`

- [ ] **Step 1: 写一个最小 CSS token 集（先让暗色正确）**

将 `globals.css` 的 `:root` 与 `.dark` 变量调整为“暗色为默认，亮色为简版”的结构：
1) 把暗色变量放在 `:root`
2) 把亮色简版变量放在 `.light`

参考实现（直接替换 `:root` / `.dark` 两段变量定义）：
```css
@layer base {
  :root {
    --background: 222 35% 6%;
    --foreground: 210 40% 98%;

    --card: 222 35% 8%;
    --card-foreground: 210 40% 98%;

    --popover: 222 35% 8%;
    --popover-foreground: 210 40% 98%;

    --primary: 187 88% 55%;
    --primary-foreground: 222 35% 8%;

    --secondary: 199 89% 55%;
    --secondary-foreground: 222 35% 8%;

    --muted: 222 18% 14%;
    --muted-foreground: 215 18% 72%;

    --accent: 222 18% 14%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 70% 40%;
    --destructive-foreground: 210 40% 98%;

    --border: 222 18% 16%;
    --input: 222 18% 16%;
    --ring: 187 88% 55%;

    --radius: 0.9rem;

    --ocean-glow-1: 187 88% 55%;
    --ocean-glow-2: 199 89% 55%;
    --ocean-mist: 215 20% 65%;
  }

  .light {
    --background: 210 50% 97%;
    --foreground: 208 54% 18%;

    --card: 0 0% 100%;
    --card-foreground: 208 54% 18%;

    --popover: 0 0% 100%;
    --popover-foreground: 208 54% 18%;

    --primary: 187 88% 40%;
    --primary-foreground: 0 0% 100%;

    --secondary: 199 89% 42%;
    --secondary-foreground: 0 0% 100%;

    --muted: 210 50% 94%;
    --muted-foreground: 208 20% 45%;

    --accent: 210 50% 94%;
    --accent-foreground: 187 88% 40%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 210 40% 88%;
    --input: 210 40% 88%;
    --ring: 187 88% 40%;

    --ocean-glow-1: 187 88% 40%;
    --ocean-glow-2: 199 89% 42%;
    --ocean-mist: 215 25% 55%;
  }
}
```

- [ ] **Step 2: 统一玻璃 utilities（适配暗色）**

将 `@layer utilities` 下的 `.glass*` 系列改为基于 tokens 的暗色玻璃（保留 class 名，避免大规模改动调用处）：
```css
@layer utilities {
  .glass {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06));
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(14px);
    box-shadow: 0 22px 80px rgba(0, 0, 0, 0.55);
  }

  .glass-card {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.05));
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
    transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
  }

  .glass-card:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.18);
    box-shadow: 0 24px 72px rgba(0, 0, 0, 0.55);
  }

  .glass-panel {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
    border-right: 1px solid rgba(255, 255, 255, 0.10);
    backdrop-filter: blur(16px);
    box-shadow: 10px 0 60px rgba(0, 0, 0, 0.45);
  }
}
```

- [ ] **Step 3: Body 只保留干净底色**

将 `body` 的 `background-image` 那两层弱渐变移除，避免与 OceanBackdrop 叠加冲突；保留：
```css
body {
  @apply bg-background text-foreground overflow-x-hidden;
}
```

- [ ] **Step 4: Commit（可选）**

```bash
git add src/app/globals.css
git commit -m "feat(ui): add ocean glass tokens and glass utilities"
```

---

### Task 3: 实现 OceanBackdrop（雾漂移 + 扫光，支持 Reduced Motion 与亮色简版降级）

**Files:**
- Create: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/ocean/ocean-backdrop.tsx`
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/globals.css`

- [ ] **Step 1: 在 globals.css 增加 OceanBackdrop 动画与类**

在 `@layer utilities`（或 `@layer base` 末尾）追加：
```css
.ocean-backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background: linear-gradient(135deg, #0b1220, #070b12);
}

.ocean-fog {
  position: absolute;
  inset: -35% -25% -45% -25%;
  border-radius: 42%;
  opacity: 0.95;
  mix-blend-mode: screen;
}

.ocean-fog-1 {
  background: radial-gradient(circle at 42% 35%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 62%);
  animation: oceanFogA 10s ease-in-out infinite;
}

.ocean-fog-2 {
  background: radial-gradient(circle at 60% 45%, hsl(var(--ocean-glow-1) / 0.22), rgba(0, 0, 0, 0) 62%);
  animation: oceanFogB 14s ease-in-out infinite;
}

.ocean-scan {
  position: absolute;
  left: -50%;
  top: 38%;
  width: 200%;
  height: 2px;
  transform: rotate(-10deg);
  background: linear-gradient(90deg, rgba(0, 0, 0, 0), hsl(var(--ocean-glow-2) / 0.26), rgba(0, 0, 0, 0));
  opacity: 0.10;
  animation: oceanScan 8s ease-in-out infinite;
}

.light .ocean-fog-2 {
  background: radial-gradient(circle at 60% 45%, hsl(var(--ocean-glow-1) / 0.10), rgba(0, 0, 0, 0) 62%);
}

.light .ocean-scan {
  opacity: 0.06;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0), rgba(255, 255, 255, 0.16), rgba(0, 0, 0, 0));
}

@keyframes oceanFogA {
  0% { transform: translate(-7%, -2%) rotate(0deg); }
  50% { transform: translate(7%, 2%) rotate(18deg); }
  100% { transform: translate(-7%, -2%) rotate(0deg); }
}

@keyframes oceanFogB {
  0% { transform: translate(6%, -3%) rotate(0deg); }
  50% { transform: translate(-6%, 3%) rotate(-14deg); }
  100% { transform: translate(6%, -3%) rotate(0deg); }
}

@keyframes oceanScan {
  0% { transform: translateX(-12%) rotate(-10deg); opacity: 0.08; }
  45% { opacity: 0.60; }
  100% { transform: translateX(12%) rotate(-10deg); opacity: 0.06; }
}

@media (prefers-reduced-motion: reduce) {
  .ocean-fog-1,
  .ocean-fog-2,
  .ocean-scan {
    animation: none !important;
  }
}
```

- [ ] **Step 2: 新增 OceanBackdrop 组件**

Create `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/ocean/ocean-backdrop.tsx`：
```tsx
import { cn } from "@/lib/utils";

export function OceanBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn("ocean-backdrop", className)} aria-hidden="true">
      <div className="ocean-fog ocean-fog-1" />
      <div className="ocean-fog ocean-fog-2" />
      <div className="ocean-scan" />
    </div>
  );
}
```

- [ ] **Step 3: Commit（可选）**

```bash
git add src/app/globals.css src/components/ocean/ocean-backdrop.tsx
git commit -m "feat(ui): add ocean backdrop"
```

---

### Task 4: RootLayout 注入 OceanBackdrop，并统一层级（背景在底、内容在上）

**Files:**
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/layout.tsx`

- [x] **Step 1: 引入 OceanBackdrop**

新增导入：
```tsx
import { OceanBackdrop } from "@/components/ocean/ocean-backdrop";
```

- [x] **Step 2: 调整 body 内结构层级**

将 `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/layout.tsx` 调整为以下完整内容（背景在底层、内容在上层、ThemeProvider/ThemeToggle 均接入）：
```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TopNav } from "@/components/top-nav";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { OceanBackdrop } from "@/components/ocean/ocean-backdrop";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "sonner";
import { Badge } from "@/components/ui/badge";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Ocean | 水下垃圾识别与数据管理 MVP",
  description: "面向水下垃圾治理的 AI 图像增强、识别、溯源与协同管理平台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <QueryProvider>
            <OceanBackdrop />
            <div className="relative z-10 flex min-h-screen">
              <TopNav />
              <div className="flex-1 flex flex-col min-w-0 overflow-auto">
                <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-8 py-4 glass">
                  <div>
                    <strong className="block text-base">治理工作台</strong>
                    <p className="mt-1 text-sm text-muted-foreground">面向采集、分析、核对与治理闭环的业务系统</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Badge variant="secondary">本地开发环境</Badge>
                    <Badge variant="default" className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      数据库已接通
                    </Badge>
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
```

- [x] **Step 2.1: 运行构建验证类型与依赖**

Run:
```bash
npm run build
```

Expected: Build 成功（无 TS 错误）。

- [x] **Step 3: 运行并人工验证**

Run:
```bash
npm run dev
```

Expected:
- 背景在滚动时保持固定
- 内容区域可读性正常
- 点击/滚动不被背景拦截（pointer-events none）

- [x] **Step 4: Commit（可选）**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): mount ocean backdrop in root layout"
```

---

### Task 5: 统一 TopNav / Header 为 Ocean Glass 质感，并接入主题切换按钮

**Files:**
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/top-nav.tsx`
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/app/layout.tsx`

- [ ] **Step 1: TopNav 使用暗色玻璃（避免白底）**

Modify `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/top-nav.tsx`：
1) 侧栏顶部装饰光晕从 `from-primary/10` 调整为更克制的冰蓝青雾：
```tsx
<div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none -z-10" />
```

2) 将导航项的 active/hover 背景从白底改为暗色玻璃（保持 motion 结构）：
```tsx
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
```

3) 图标与文本颜色在暗色下更亮一点（避免过灰）：
```tsx
<Icon
  className={cn(
    "w-4 h-4 transition-colors duration-300",
    active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
  )}
/>
<span
  className={cn(
    "relative z-10 transition-colors duration-300",
    active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
  )}
>
  {item.label}
</span>
```

- [x] **Step 2: 验证 layout.tsx 已按 Task 4 完整替换**

确认 `header` 使用 `glass`，并且右侧包含 `<ThemeToggle />`。

- [x] **Step 4: 手工验证亮色简版**

在 UI 点击主题切换：
- 暗色：海雾玻璃明显、背景雾与扫光可见但不干扰阅读
- 亮色：整体更克制，背景动效与光晕明显变弱

- [x] **Step 5: Commit（可选）**

```bash
git add src/components/top-nav.tsx src/app/layout.tsx src/components/theme-toggle.tsx
git commit -m "feat(ui): apply ocean glass to nav and add theme toggle"
```

---

### Task 6: 建立最小 UI 测试（OceanBackdrop 渲染与可访问性）

**Files:**
- Create: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/vitest.config.ts`
- Create: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/test/setup.ts`
- Create: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/ocean/ocean-backdrop.test.tsx`
- Modify: `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/ocean/ocean-backdrop.tsx`

- [x] **Step 1: 新增 vitest 配置**

Create `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/vitest.config.ts`：
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [x] **Step 2: 新增测试 setup**

Create `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/test/setup.ts`：
```ts
import "@testing-library/jest-dom";
```

- [x] **Step 3: 写 OceanBackdrop 单测**

Create `/Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/src/components/ocean/ocean-backdrop.test.tsx`：
```tsx
import { render, screen } from "@testing-library/react";
import { OceanBackdrop } from "@/components/ocean/ocean-backdrop";

describe("OceanBackdrop", () => {
  it("renders and contains fog layers and scanline", () => {
    render(<OceanBackdrop />);

    const root = screen.getByTestId("ocean-backdrop");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.querySelector(".ocean-fog-1")).toBeTruthy();
    expect(root.querySelector(".ocean-fog-2")).toBeTruthy();
    expect(root.querySelector(".ocean-scan")).toBeTruthy();
  });
});
```

将组件调整为可测试：把 `OceanBackdrop` 根节点补充 `data-testid="ocean-backdrop"`：
```tsx
<div className={cn("ocean-backdrop", className)} aria-hidden="true" data-testid="ocean-backdrop">
```

- [x] **Step 4: 运行测试**

Run:
```bash
npm run test:run
```

Expected: PASS。

- [x] **Step 5: Commit（可选）**

```bash
git add vitest.config.ts src/test/setup.ts src/components/ocean/ocean-backdrop.test.tsx src/components/ocean/ocean-backdrop.tsx package.json package-lock.json
git commit -m "test(ui): add vitest and ocean backdrop tests"
```

---

## 最终验收清单（手工 + 自动）

- [x] `npm run lint` 通过
- [x] `npm run test:run` 通过
- [x] 暗色默认：全站背景为海雾玻璃风格，雾漂移与扫光低频存在
- [x] 亮色简版：切换后背景动效与光晕明显更弱，内容阅读更舒适
- [x] `prefers-reduced-motion`：系统设置开启减少动态后，背景动画停止
- [x] 关键页面（首页/采集/看板/后台）玻璃容器层级一致、文字对比度正常
