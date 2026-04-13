# Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a modern, scalable frontend architecture for the Ocean MVP project using Tailwind CSS, Shadcn UI, Zustand, and React Query.

**Architecture:** We are replacing raw CSS with Tailwind CSS and Shadcn UI components. We will integrate React Query for server state and Zustand for global client state. Next.js App Router remains the core framework.

**Tech Stack:** Next.js (App Router), Tailwind CSS, Shadcn UI, Zustand, React Query, `react-hook-form`, `zod`, `recharts`, `lucide-react`.

---

### Task 1: Scaffolding & Setup

**Files:**
- Create/Modify: `tailwind.config.ts`, `postcss.config.js`, `components.json`
- Modify: `package.json`

- [ ] **Step 1: Install Dependencies**
```bash
npm install tailwindcss postcss autoprefixer
npm install lucide-react clsx tailwind-merge
npm install @tanstack/react-query zustand react-hook-form @hookform/resolvers zod recharts sonner
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Shadcn UI**
```bash
npx shadcn-ui@latest init -y
```

- [ ] **Step 3: Setup React Query Provider**
Create `src/components/providers/query-provider.tsx`:
```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "chore: setup tailwind, shadcn, zustand, and react-query"
```

### Task 2: Visual System (Ocean Theme)

**Files:**
- Modify: `src/app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Configure Tailwind Theme**
Update `tailwind.config.ts` with Ocean colors:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#f4f8fc",
        foreground: "#153047",
        primary: {
          DEFAULT: "#0f6ccf",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#169678",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#153047",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 2: Update Global CSS**
Modify `src/app/globals.css` to include Tailwind directives and base Shadcn styles, removing old raw CSS.
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 50% 97%;
    --foreground: 208 54% 18%;
    --primary: 211 86% 44%;
    --primary-foreground: 0 0% 100%;
    --secondary: 166 74% 34%;
    --secondary-foreground: 0 0% 100%;
    --radius: 0.5rem;
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "style: configure ocean theme and tailwind base"
```

### Task 3: Layout & Navigation

**Files:**
- Modify: `src/app/layout.tsx`, `src/components/top-nav.tsx`

- [ ] **Step 1: Update Root Layout**
Wrap children with `QueryProvider` and `Toaster`.
```tsx
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";
// ...
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased min-h-screen">
        <QueryProvider>
          <div className="flex min-h-screen flex-col">
            <TopNav />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Refactor TopNav**
Update `src/components/top-nav.tsx` using Tailwind classes instead of custom CSS.

- [ ] **Step 3: Commit**
```bash
git add src/app/layout.tsx src/components/top-nav.tsx src/components/providers/query-provider.tsx
git commit -m "feat: refactor layout and navigation"
```

### Task 4: Home / Workspace Refactor

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Install Shadcn Card**
```bash
npx shadcn-ui@latest add card badge
```

- [ ] **Step 2: Refactor Home Page**
Replace native `fetch` inside `useEffect` with React Query's `useQuery`.
Use Shadcn `Card`, `CardHeader`, `CardTitle`, `CardContent` components for layout.
Apply Tailwind grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).

- [ ] **Step 3: Commit**
```bash
git add src/app/page.tsx components.json components/ui/card.tsx components/ui/badge.tsx
git commit -m "feat: refactor home page with react-query and shadcn"
```

### Task 5: Dashboard Refactor

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Refactor Dashboard Data Fetching**
Use `useQuery` for fetching dashboard metrics.

- [ ] **Step 2: Implement Recharts**
Replace basic HTML tables/bars with responsive Recharts components for data visualization. Use `next/dynamic` for the charts to ensure lazy loading.

- [ ] **Step 3: Commit**
```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: refactor dashboard with recharts"
```

### Task 6: Data Collection Refactor

**Files:**
- Modify: `src/app/collect/page.tsx`

- [ ] **Step 1: Install Form Components**
```bash
npx shadcn-ui@latest add form input button progress
```

- [ ] **Step 2: Refactor Form & AI Pipeline**
Implement `react-hook-form` + `zod` for the upload form.
Use React Query's `useMutation` for handling the image upload and AI pipeline trigger.
Show Shadcn `Progress` bar during processing.

- [ ] **Step 3: Commit**
```bash
git add src/app/collect/page.tsx components/ui/form.tsx components/ui/input.tsx components/ui/button.tsx components/ui/progress.tsx
git commit -m "feat: refactor data collection form and AI pipeline UI"
```

### Task 7: Admin / Review Queue Refactor

**Files:**
- Modify: `src/app/admin/trash/page.tsx`

- [ ] **Step 1: Install Table Components**
```bash
npx shadcn-ui@latest add table dropdown-menu
npm install @tanstack/react-table
```

- [ ] **Step 2: Refactor Data Table**
Implement Shadcn `DataTable` for the review queue.
Add pagination and filtering features.
Use `useQuery` to fetch the list and `useMutation` for review actions (Confirm/Reject), with query invalidation to refresh the list automatically.

- [ ] **Step 3: Commit**
```bash
git add src/app/admin/trash/page.tsx components/ui/table.tsx components/ui/dropdown-menu.tsx
git commit -m "feat: refactor admin review queue with datatable"
```
