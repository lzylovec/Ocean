# Ocean Frontend Refactor Design

**Date**: 2026-04-13
**Status**: Approved
**Context**: Ocean MVP (Underwater Trash Recognition & Data Management)

## 1. Overview
The goal of this refactor is to establish a modern, scalable frontend architecture for the Ocean MVP project. We are transitioning from raw CSS and basic React state to a robust tech stack incorporating Tailwind CSS, Shadcn UI, Zustand, and React Query (TanStack Query), all built on top of the existing Next.js App Router framework.

The visual theme will reflect an "Ocean" identity—featuring deep blues, teals, and clean layouts—to align with the project's environmental focus.

## 2. Architecture & Tech Stack
- **Framework**: Next.js (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Global State**: Zustand
- **Data Fetching & Caching**: TanStack Query (React Query)
- **Form Handling**: `react-hook-form` + `zod`
- **Charts**: Recharts
- **Icons**: `lucide-react`

## 3. Visual System (Ocean Theme)
The application will utilize a custom Tailwind theme matching the "Ocean" aesthetic:
- **Primary Color**: Deep Ocean Blue (`#0f6ccf`)
- **Accent/Success**: Sea Teal (`#169678`)
- **Backgrounds**: Clean whites (`#ffffff`) and soft gray-blues (`#f4f8fc` / `slate-50`)
- **Typography**: Inter (sans-serif)
- **Component Style**: Modern, slightly rounded corners (`radius-md: 0.5rem`), clean borders, and soft shadows to mimic depth.

## 4. Components & Routing Redesign
We will migrate existing raw CSS and custom HTML structures to Shadcn UI components:

### 4.1 Layout & Navigation (`/src/app/layout.tsx`)
- Migrate `TopNav` to a responsive Sidebar/Header layout using Shadcn `NavigationMenu` or `Sheet` for mobile.
- Implement global `sonner` Toasts for system notifications (e.g., API success/failure).

### 4.2 Home / Workspace (`/src/app/page.tsx`)
- Migrate the `workspace-hero` and stat cards to Shadcn `Card` components.
- Use CSS Grid/Flexbox via Tailwind (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).

### 4.3 Data Collection (`/src/app/collect/page.tsx`)
- Upgrade the file upload interface using a styled drag-and-drop zone.
- Visualize the AI pipeline (Upload -> Enhance -> Detect -> OCR -> Semantic) using a stepper or progressive loading states.

### 4.4 Dashboard (`/src/app/dashboard/page.tsx`)
- Replace simple tables with `Recharts` for visualizing metrics.
- Ensure heavy chart components are dynamically imported (`next/dynamic`) to optimize initial bundle size.

### 4.5 Admin / Review Queue (`/src/app/admin/trash/page.tsx`)
- Implement Shadcn `DataTable` (powered by `@tanstack/react-table`) with sorting, filtering, and pagination capabilities.
- Integrate React Query to handle data refetching seamlessly after a review action (e.g., Confirm/Reject).

## 6. Performance & UX Optimizations
- **Data Fetching**: Use React Query for all client-side data fetching. This provides automatic retries, background refetching, and caching.
- **Error Boundaries**: Implement `error.tsx` at the route level to catch rendering errors and display a user-friendly fallback UI.
- **Loading States**: Implement `loading.tsx` skeleton screens for seamless route transitions.
- **SEO & Accessibility (a11y)**: Shadcn UI components natively support Radix UI primitives, ensuring high accessibility. Update Metadata for SEO optimization.

## 7. Implementation Steps
1. **Scaffolding & Setup**: Initialize Tailwind, Shadcn, Zustand, and React Query. Configure the `Ocean` theme in `tailwind.config.ts`.
2. **Component Migration**: Iteratively replace global CSS classes with Tailwind utility classes and Shadcn components.
3. **State & Data Migration**: Refactor `fetch` calls in client components to use custom React Query hooks. Move global UI state (if any) to Zustand.
4. **Page Refactoring**: Update Home, Collect, Dashboard, and Admin pages one by one.
5. **Testing & QA**: Verify responsive layouts, verify AI pipeline connections, and ensure no regressions in functionality.
