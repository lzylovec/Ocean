"use client";

import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  FileEdit,
  Archive,
  Loader2,
  Trash2,
  ArrowRight,
  Database,
  Search,
  Sparkles,
  MapPin,
  CalendarDays,
  ShieldAlert,
  Tags,
  ScanText,
  MessageSquareText,
} from "lucide-react";
import { readApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

type TrashIdentityItem = {
  identityId: string;
  siteName: string;
  volunteerNote: string;
  manualTextClue: string;
  originalUrl: string;
  enhancedUrl: string;
  recognizedCategory: string;
  professionalCategory: string;
  primaryCategory: string;
  materialHint: string;
  sourceHint: string;
  topConfidence: number;
  reviewStatus: string;
  volunteerRiskLevel: string;
  categories: string[];
  volunteerTags: string[];
  volunteerSummary: string;
  ocrTexts: string[];
  ocrKeywords: string[];
  actionSuggestions: string[];
  createdAt: string;
};

type TrashIdentityResponse = {
  items: TrashIdentityItem[];
  counts: {
    pendingReview: number;
    needsOcr: number;
    confirmed: number;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const reviewStatusOptions = ["待复核", "待补文字线索", "已确认"];
const riskLevelOptions = [
  { label: "低风险", value: "low" },
  { label: "中风险", value: "medium" },
  { label: "高风险", value: "high" },
];

type FilterState = {
  q: string;
  reviewStatus: string;
  riskLevel: string;
  site: string;
  category: string;
};

const subscribeLocation = () => () => {};
const getServerLocationSearch = () => "";
const getClientLocationSearch = () => window.location.search;

const riskLevelMeta: Record<
  string,
  { label: string; badgeClassName: string }
> = {
  low: {
    label: "低风险",
    badgeClassName: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  medium: {
    label: "中风险",
    badgeClassName: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  high: {
    label: "高风险",
    badgeClassName: "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

const reviewStatusMeta: Record<
  string,
  { label: string; badgeClassName: string }
> = {
  "待复核": {
    label: "待复核",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
  },
  "待补文字线索": {
    label: "待补文字线索",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
  },
  "待补OCR": {
    label: "待补文字线索",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
  },
  "已确认": {
    label: "已确认",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

function resolveMediaUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}

function getRiskMeta(level: string) {
  return riskLevelMeta[level] ?? riskLevelMeta.medium;
}

function getReviewStatusMeta(status: string) {
  return reviewStatusMeta[status] ?? {
    label: status,
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function formatDisplayTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function explainActionSuggestion(suggestion: string) {
  if (suggestion.includes("后台复核")) {
    return "当前证据还需要人工判断，建议重点核对图片主体、类别判断和来源提示。";
  }
  if (suggestion.includes("岸线来源")) {
    return "这类垃圾更可能与岸线消费或近岸输入有关，适合结合潜点位置做来源判断。";
  }
  if (suggestion.includes("OCR")) {
    return "如果图片中有品牌、材质或包装文字，可利用这些文字线索继续做来源溯源。";
  }
  if (suggestion.includes("渔业")) {
    return "该结果更接近渔业活动遗留垃圾，建议结合附近作业区或渔具特征复核。";
  }
  return "作为后续复核或治理动作的优先提示，帮助判断这条记录下一步该怎么处理。";
}

export default function TrashAdminPage() {
  const queryClient = useQueryClient();
  const locationSearch = useSyncExternalStore(
    subscribeLocation,
    getClientLocationSearch,
    getServerLocationSearch,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    reviewStatus: "",
    riskLevel: "",
    site: "",
    category: "",
  });
  const [manualTextClueRecordId, setManualTextClueRecordId] = useState<string | null>(null);
  const [manualTextClueDraft, setManualTextClueDraft] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: "80" });
    Object.entries(filters).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (trimmed) params.set(key, trimmed);
    });
    return params.toString();
  }, [filters]);

  const { data, isLoading, error } = useQuery<TrashIdentityResponse>({
    queryKey: ["trash-identities", filters],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities?${queryString}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, "垃圾身份证列表加载失败。"));
      return response.json();
    },
  });

  const selected = useMemo(() => {
    if (!data?.items) return null;
    const requestedId = selectedId ?? new URLSearchParams(locationSearch).get("selected");
    if (requestedId) return data.items.find((item) => item.identityId === requestedId) || data.items[0] || null;
    return data.items[0] || null;
  }, [data, locationSearch, selectedId]);

  function updateFilter(key: keyof FilterState, value: string) {
    setSelectedId(null);
    setManualTextClueRecordId(null);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setSelectedId(null);
    setManualTextClueRecordId(null);
    setFilters({ q: "", reviewStatus: "", riskLevel: "", site: "", category: "" });
  }

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      manualTextClue,
    }: {
      id: string;
      status?: string;
      manualTextClue?: string;
    }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(status ? { reviewStatus: status } : {}),
          ...(manualTextClue !== undefined ? { manualTextClue } : {}),
        }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, "更新审核状态失败。"));
      return response.json();
    },
    onSuccess: async (_, variables) => {
      if (variables.status && variables.manualTextClue !== undefined) {
        toast.success(`记录 ${variables.id.slice(0, 8)}... 已保存文字线索并更新状态。`);
      } else if (variables.status) {
        toast.success(`记录 ${variables.id.slice(0, 8)}... 已更新为 ${variables.status}。`);
      } else {
        toast.success(`记录 ${variables.id.slice(0, 8)}... 的文字线索已保存。`);
      }
      await queryClient.invalidateQueries({ queryKey: ["trash-identities"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteIdentityMutation = useMutation({
    mutationFn: async (identityId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities/${identityId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "删除垃圾身份证失败。"));
      }
      return identityId;
    },
    onSuccess: async (identityId) => {
      toast.success(`记录 ${identityId.slice(0, 8)}... 已删除。`);
      setSelectedId(null);
      setManualTextClueRecordId(null);
      setManualTextClueDraft("");
      await queryClient.invalidateQueries({ queryKey: ["trash-identities"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const migrateMediaMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/media/migrate-storage`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "历史图片回迁失败。"));
      }
      return response.json() as Promise<{
        status: string;
        migratedOriginal: number;
        migratedEnhanced: number;
        updatedJobs: number;
      }>;
    },
    onSuccess: async (result) => {
      toast.success(
        `回迁完成：原图 ${result.migratedOriginal}，增强图 ${result.migratedEnhanced}，任务记录 ${result.updatedJobs}。`,
      );
      await queryClient.invalidateQueries({ queryKey: ["trash-identities"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleDeleteSelected() {
    if (!selected) return;
    const confirmed = window.confirm(
      `确认删除记录 ${selected.identityId} 吗？此操作会删除入库记录，但不会删除原图和增强图文件。`,
    );
    if (!confirmed) return;
    deleteIdentityMutation.mutate(selected.identityId);
  }

  function handleSaveManualTextClue() {
    if (!selected) return;
    updateStatusMutation.mutate({
      id: selected.identityId,
      manualTextClue: manualTextClueDraft,
    });
  }

  function handleSaveTextClueAndReopen() {
    if (!selected) return;
    updateStatusMutation.mutate({
      id: selected.identityId,
      status: "待复核",
      manualTextClue: manualTextClueDraft,
    });
  }

  const displayedManualTextClue =
    selected && manualTextClueRecordId === selected.identityId
      ? manualTextClueDraft
      : (selected?.manualTextClue ?? "");

  return (
    <div className="flex flex-col gap-6 max-w-[1500px] mx-auto relative pb-10">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none -z-10" />

      <div className="flex flex-col gap-2 shrink-0 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-primary/80 flex items-center gap-2">
              <Database className="w-4 h-4" /> Review Workspace
            </p>
            <h1 className="text-4xl font-black tracking-tight text-foreground">垃圾身份证后台核对</h1>
            <p className="text-muted-foreground text-lg">这一页围绕“记录列表 + 单条详情”组织，适合实际业务复核。</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="bg-white/50 border-white/60"
            disabled={migrateMediaMutation.isPending}
            onClick={() => migrateMediaMutation.mutate()}
          >
            {migrateMediaMutation.isPending ? (
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            ) : (
              <Archive className="mr-2 w-4 h-4" />
            )}
            回迁历史图片到对象存储
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0 relative z-10">
        {[
          { label: "待复核", value: data?.counts?.pendingReview ?? 0, note: "需要人工确认的记录", color: "text-amber-500", bg: "bg-amber-500/10", icon: Sparkles },
          { label: "待补文字线索", value: data?.counts?.needsOcr ?? 0, note: "文字线索不足的记录", color: "text-blue-500", bg: "bg-blue-500/10", icon: Search },
          { label: "已确认", value: data?.counts?.confirmed ?? 0, note: "已完成业务闭环确认", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -5, scale: 1.02 }}
            className={cn("bg-white/40 backdrop-blur-md p-5 rounded-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.05)] flex flex-col gap-2 relative overflow-hidden group")}
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-muted-foreground">{stat.label}</span>
              <div className={cn("p-2 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </div>
            <strong className="text-4xl font-black text-foreground tracking-tighter">{stat.value}</strong>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">{stat.note}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] gap-3 shrink-0 relative z-10 rounded-2xl border border-white/60 bg-white/25 p-4 backdrop-blur-xl shadow-sm">
        <Input
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="搜索 ID、潜点、类别、备注..."
          className="h-10 bg-white/50 border-white/60"
        />
        <Input
          value={filters.site}
          onChange={(event) => updateFilter("site", event.target.value)}
          placeholder="潜点"
          className="h-10 bg-white/50 border-white/60"
        />
        <Input
          value={filters.category}
          onChange={(event) => updateFilter("category", event.target.value)}
          placeholder="类别"
          className="h-10 bg-white/50 border-white/60"
        />
        <select
          value={filters.reviewStatus}
          onChange={(event) => updateFilter("reviewStatus", event.target.value)}
          className="h-10 rounded-lg border border-white/60 bg-white/50 px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">全部状态</option>
          {reviewStatusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select
          value={filters.riskLevel}
          onChange={(event) => updateFilter("riskLevel", event.target.value)}
          className="h-10 rounded-lg border border-white/60 bg-white/50 px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">全部风险</option>
          {riskLevelOptions.map((risk) => (
            <option key={risk.value} value={risk.value}>{risk.label}</option>
          ))}
        </select>
        <Button type="button" variant="outline" className="h-10 bg-white/50 border-white/60" onClick={resetFilters}>
          重置
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start relative z-10">
        {/* Left Column: Queue */}
        <Card className="flex flex-col bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden xl:sticky xl:top-24">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <CardHeader className="px-5 py-5 border-b border-white/40 shrink-0 relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Identity Queue</p>
                <CardTitle className="text-xl font-bold">记录队列</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">优先处理待复核和高风险样本。</p>
              </div>
              <Badge variant="outline" className="bg-white/60 border-white/70 text-foreground">
                {data?.items?.length ?? 0} 条
              </Badge>
            </div>
          </CardHeader>
          <div className="p-3 flex flex-col gap-3 bg-white/10 backdrop-blur-sm">
            {isLoading && (
              <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm font-medium">正在加载记录...</span>
              </div>
            )}
            {error && (
              <div className="p-4 text-center text-sm text-destructive bg-destructive/10 rounded-xl">
                {(error as Error).message}
              </div>
            )}
            {data?.items?.length === 0 && !isLoading && (
              <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Archive className="w-8 h-8 text-slate-300" />
                <span className="text-sm font-medium">还没有可复核的记录</span>
              </div>
            )}
            <AnimatePresence>
              {data?.items?.map((item, i) => {
                const isActive = (selected?.identityId === item.identityId);
                const riskMeta = getRiskMeta(item.volunteerRiskLevel);
                const statusMeta = getReviewStatusMeta(item.reviewStatus);
                return (
                  <motion.button
                    key={item.identityId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedId(item.identityId)}
                    className={cn(
                      "flex flex-col gap-3 p-4 rounded-xl border text-left transition-all duration-300 relative overflow-hidden group backdrop-blur-md",
                      isActive
                        ? "bg-white/60 border-primary shadow-md shadow-primary/10 scale-[1.02]"
                        : "bg-white/40 border-white/60 hover:bg-white/50 hover:border-primary/30"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-queue-item"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-primary"
                      />
                    )}
                    <div className="flex items-start justify-between gap-3 w-full pl-1">
                      <div className="min-w-0 flex-1">
                        <strong className={cn("font-bold text-sm truncate block", isActive ? "text-primary" : "text-foreground")}>
                          {item.recognizedCategory}
                        </strong>
                        <p className="mt-1 text-[11px] text-muted-foreground truncate">
                          专业类别：{item.professionalCategory}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground truncate flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {item.siteName}
                        </p>
                      </div>
                      <Badge className={cn("text-[10px] shadow-sm", riskMeta.badgeClassName)}>
                        {riskMeta.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pl-1">
                      <div className="rounded-lg border border-white/60 bg-white/45 px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">身份证</p>
                        <p className="mt-1 font-mono text-foreground">{item.identityId.slice(0, 8)}</p>
                      </div>
                      <div className="rounded-lg border border-white/60 bg-white/45 px-2.5 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">置信度</p>
                        <p className="mt-1 font-semibold text-foreground">{item.topConfidence.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full pl-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3" />
                        {formatDisplayTime(item.createdAt)}
                      </span>
                      <Badge className={cn("text-[10px] shadow-sm", statusMeta.badgeClassName)}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>

        {/* Right Column: Detail */}
        <Card className="min-w-0 bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

          <CardHeader className="px-8 py-6 border-b border-white/40 shrink-0 relative z-10 bg-white/30 backdrop-blur-md">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Identity Detail</p>
                <CardTitle className="text-3xl font-mono tracking-tight">
                  {selected?.identityId ?? "暂无记录"}
                </CardTitle>
                {selected ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/55 px-3 py-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {selected.siteName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/55 px-3 py-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDisplayTime(selected.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/55 px-3 py-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      置信度 {selected.topConfidence.toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>
              {selected ? (
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <Badge className={cn("px-3 py-1.5 text-sm shadow-sm", getRiskMeta(selected.volunteerRiskLevel).badgeClassName)}>
                    {getRiskMeta(selected.volunteerRiskLevel).label}
                  </Badge>
                  <Badge className={cn("px-3 py-1.5 text-sm shadow-sm", getReviewStatusMeta(selected.reviewStatus).badgeClassName)}>
                    {getReviewStatusMeta(selected.reviewStatus).label}
                  </Badge>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="p-8 relative z-10">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.identityId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-6"
                >
                  {(() => {
                    const normalizedReviewStatus = getReviewStatusMeta(selected.reviewStatus).label;
                    const isNeedsText = normalizedReviewStatus === "待补文字线索";
                    const isConfirmed = normalizedReviewStatus === "已确认";
                    const isPendingReview = normalizedReviewStatus === "待复核";
                    const hasManualTextClue = displayedManualTextClue.trim().length > 0;

                    return (
                      <>
                  <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_340px] gap-5 items-start">
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-3 rounded-3xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-bold text-foreground flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                            原始图片
                          </strong>
                          <span className="text-xs text-muted-foreground">采集现场</span>
                        </div>
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/60 bg-white/20 shadow-inner group">
                          <Image src={resolveMediaUrl(selected.originalUrl)} alt="Original" fill className="object-contain transition-transform duration-500 group-hover:scale-105" unoptimized />
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-md">
                        <strong className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                          <MessageSquareText className="w-4 h-4" />
                          语义分析摘要
                        </strong>
                        <p className="mt-4 text-sm leading-7 bg-primary/5 p-4 rounded-2xl border border-primary/10 font-medium text-foreground">
                          {selected.volunteerSummary || selected.volunteerNote || "暂无摘要"}
                        </p>

                        <div className="mt-5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">志愿者备注</p>
                          <p className="mt-2 text-sm leading-6 text-foreground/85">
                            {selected.volunteerNote || "暂无备注"}
                          </p>
                        </div>

                        <div className="mt-5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">人工补充文字线索</p>
                          <p className="mt-2 text-sm leading-6 text-foreground/85">
                            {selected.manualTextClue || "尚未补充"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-3 rounded-3xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-bold text-foreground flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            增强与检测结果
                          </strong>
                          <span className="text-xs text-muted-foreground">模型输出</span>
                        </div>
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-primary/20 bg-primary/5 shadow-inner group">
                          <Image src={resolveMediaUrl(selected.enhancedUrl)} alt="Enhanced" fill className="object-contain transition-transform duration-500 group-hover:scale-105" unoptimized />
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-md">
                        <strong className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                          <ScanText className="w-4 h-4" />
                          OCR 与标签线索
                        </strong>

                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OCR 文本</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selected.ocrTexts.length ? selected.ocrTexts.map((text) => (
                              <span key={text} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                                {text}
                              </span>
                            )) : (
                              <span className="text-sm text-muted-foreground">未检测到明显文字</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">反馈标签</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selected.volunteerTags.length ? selected.volunteerTags.map((tag) => (
                              <span key={tag} className="rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs font-medium text-foreground/80">
                                {tag}
                              </span>
                            )) : (
                              <span className="text-sm text-muted-foreground">暂无标签</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">候选类别</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selected.categories.length ? selected.categories.map((category) => (
                              <span key={category} className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-medium text-primary/90">
                                {category}
                              </span>
                            )) : (
                              <span className="text-sm text-muted-foreground">暂无类别线索</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-5">
                      <div className="rounded-3xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-md">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Audit Summary</p>
                        <h2 className="mt-2 text-xl font-bold text-foreground">复核结论卡</h2>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          {[
                          { label: "具体垃圾名称", value: selected.recognizedCategory },
                          { label: "专业类别", value: selected.professionalCategory },
                          { label: "材质线索", value: selected.materialHint || "待补充" },
                          { label: "来源提示", value: selected.sourceHint || "待补充" },
                          { label: "最高置信度", value: selected.topConfidence.toFixed(2) },
                          ].map((stat) => (
                            <div key={stat.label} className="rounded-2xl border border-white/65 bg-white/60 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                              <p className="mt-1 text-sm font-semibold leading-6 text-foreground">{stat.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-md">
                        <strong className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                          <Tags className="w-4 h-4" />
                          复核建议
                        </strong>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          这部分不是识别结果本身，而是给审核人看的下一步动作提示，帮助判断这条记录该怎么继续处理。
                        </p>
                        <ul className="mt-4 flex flex-col gap-3">
                          {selected.actionSuggestions.length ? selected.actionSuggestions.map((suggestion, index) => (
                            <li key={`${suggestion}-${index}`} className="rounded-2xl border border-primary/10 bg-primary/5 p-3">
                              <div className="flex items-start gap-3 text-sm font-medium text-foreground">
                                <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{suggestion}</span>
                              </div>
                              <p className="mt-2 pl-7 text-xs leading-5 text-muted-foreground">
                                {explainActionSuggestion(suggestion)}
                              </p>
                            </li>
                          )) : (
                            <li className="text-sm text-muted-foreground">暂无复核建议</li>
                          )}
                        </ul>
                      </div>

                      <div className="rounded-3xl border border-white/60 bg-white/35 p-5 shadow-sm backdrop-blur-md">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Review Actions</p>
                        <h3 className="mt-2 text-lg font-bold text-foreground">更新记录状态</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {isNeedsText
                            ? "当前记录已标记为缺少文字证据。补充线索后，可恢复到待复核或直接确认。"
                            : isConfirmed
                              ? "当前记录已经确认入库。如需调整，请先删除后重新生成。"
                              : "请核对图片、具体垃圾名称、OCR 和来源提示，判断这条记录是否可以确认入库。"}
                        </p>
                        {isPendingReview ? (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-950">
                            <p className="font-semibold">待复核时建议这样操作：</p>
                            <p className="mt-2">1. 先看原始图片和增强图，确认垃圾主体是否识别正确。</p>
                            <p>2. 再核对具体垃圾名称、专业类别、OCR 文本和来源提示是否合理。</p>
                            <p>3. 如果证据足够，直接确认入库；如果文字证据不足，再标记为待补文字线索。</p>
                          </div>
                        ) : null}
                        {isNeedsText ? (
                          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm leading-6 text-blue-900">
                            <p className="font-semibold">待补文字线索之后建议这样处理：</p>
                            <p className="mt-2">1. 先核对原图和增强图，确认是否真的缺少可读文字。</p>
                            <p>2. 如果现场还有补充信息，更新备注或重新上传更清晰样本。</p>
                            <p>3. 线索补齐后，将状态恢复为待复核，或直接确认入库结果。</p>
                          </div>
                        ) : null}
                        <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">人工补充文字线索</p>
                          <Textarea
                            value={displayedManualTextClue}
                            onChange={(event) => {
                              if (!selected) return;
                              setManualTextClueRecordId(selected.identityId);
                              setManualTextClueDraft(event.target.value);
                            }}
                            placeholder="例如：包装袋上可见品牌字样、瓶身印有 PET、标签文字可辨认为饮料包装"
                            className="mt-3 min-h-[120px] resize-y border-white/70 bg-white/70"
                          />
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            这里填写的是人工核对后补录的文字证据，不会覆盖原始志愿者备注。
                          </p>
                        </div>
                        <div className="mt-5 flex flex-col gap-3">
                        <Button
                          variant="outline"
                          disabled={deleteIdentityMutation.isPending || updateStatusMutation.isPending}
                          onClick={handleDeleteSelected}
                          className="h-12 rounded-2xl border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                        >
                          {deleteIdentityMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          删除当前记录
                        </Button>
                        <Button
                          variant="outline"
                          disabled={updateStatusMutation.isPending || deleteIdentityMutation.isPending}
                          onClick={handleSaveManualTextClue}
                          className="h-12 rounded-2xl border-white/70 bg-white/55 text-base hover:bg-white/80"
                        >
                          <FileEdit className="w-4 h-4 mr-2" />
                          仅保存文字线索
                        </Button>
                        {isNeedsText ? (
                          <>
                            {hasManualTextClue ? (
                              <Button
                                variant="outline"
                                disabled={updateStatusMutation.isPending || deleteIdentityMutation.isPending}
                                onClick={handleSaveTextClueAndReopen}
                                className="h-12 rounded-2xl border-white/70 bg-white/55 text-base hover:bg-white/80"
                              >
                                <FileEdit className="w-4 h-4 mr-2" />
                                保存并恢复待复核
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            disabled={updateStatusMutation.isPending || deleteIdentityMutation.isPending}
                            onClick={() => updateStatusMutation.mutate({ id: selected.identityId, status: "待补文字线索" })}
                            className="h-12 rounded-2xl border-white/70 bg-white/55 text-base hover:bg-white/80"
                          >
                            <FileEdit className="w-4 h-4 mr-2" />
                            标记为待补文字线索
                          </Button>
                        )}
                        <Button
                          variant="default"
                          className="h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-bold rounded-2xl shadow-md shadow-emerald-500/20"
                          disabled={isConfirmed || updateStatusMutation.isPending || deleteIdentityMutation.isPending}
                          onClick={() => updateStatusMutation.mutate({ id: selected.identityId, status: "已确认" })}
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          {isConfirmed ? "当前已确认入库" : "确认入库结果"}
                        </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-white/40 rounded-2xl bg-white/30 gap-4"
                >
                  <Search className="w-12 h-12 text-slate-300" />
                  <span className="text-base font-medium">请在左侧选择一条记录进行复核</span>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
