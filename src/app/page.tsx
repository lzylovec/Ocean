"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ChevronRight, ArrowRight, Sparkles, Activity, ShieldAlert, Database, Cpu, Network, ScanSearch, MapPin, History } from "lucide-react";
import { readApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { OceanHero } from "@/components/ocean/ocean-hero";
import { SystemStatusAlert, WorkerStatusIndicator } from "@/components/worker-status-indicator";

type OverviewResponse = {
  metrics: Array<{ label: string; value: string; note: string }>;
  topSites: Array<{ name: string; risk: string; topCategory: string }>;
};

type IdentityItem = {
  identityId: string;
  siteName: string;
  recognizedCategory: string;
  professionalCategory: string;
  primaryCategory: string;
  materialHint: string;
  sourceHint: string;
  reviewStatus: string;
  volunteerSummary: string;
  volunteerRiskLevel: string;
  volunteerTags: string[];
  createdAt: string;
};

type IdentityResponse = {
  items: IdentityItem[];
  counts: {
    pendingReview: number;
    needsOcr: number;
    confirmed: number;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const quickLinks = [
  { href: "/collect", title: "新建采集任务", description: "上传图片并触发整条 AI 流水线", icon: ScanSearch },
  { href: "/jobs", title: "查看任务历史", description: "追踪队列、进度与失败原因", icon: History },
  { href: "/admin/trash", title: "进入后台核对", description: "查看入库记录并处理待复核样本", icon: Network },
  { href: "/dashboard", title: "查看治理看板", description: "追踪重点潜点与风险变化", icon: MapPin },
];

const stackItems = [
  { label: "增强", desc: "NAFNet 本地推理", status: "Active" },
  { label: "检测", desc: "DAMO-YOLO ONNX 本地执行", status: "Active" },
  { label: "OCR", desc: "检测 + 识别双阶段", status: "Active" },
  { label: "语义", desc: "Qwen ModelScope 推理", status: "Active" },
];

export default function Home() {
  const { data: overview, isLoading: isLoadingOverview, error: overviewError } = useQuery<OverviewResponse>({
    queryKey: ["overview"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/overview`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "加载概览数据失败"));
      return res.json();
    },
  });

  const { data: identities, isLoading: isLoadingIdentities, error: identitiesError } = useQuery<IdentityResponse>({
    queryKey: ["identities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/trash-identities?limit=6`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "加载入库记录失败"));
      return res.json();
    },
  });

  const liveMetrics = useMemo(() => {
    const pending = identities?.counts?.pendingReview ?? 0;
    const needsOcr = identities?.counts?.needsOcr ?? 0;
    const confirmed = identities?.counts?.confirmed ?? 0;

    return [
      { label: "待复核", value: String(pending), note: "等待人工确认的记录", icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
      { label: "待补文字线索", value: String(needsOcr), note: "需要补充文字线索", icon: Activity, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
      { label: "已确认", value: String(confirmed), note: "已经完成业务确认", icon: Sparkles, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
    ];
  }, [identities]);

  const hasError = overviewError || identitiesError;
  const isLoading = isLoadingOverview || isLoadingIdentities;

  return (
    <div
      className="flex flex-col gap-8 max-w-[1400px] mx-auto animate-in fade-in duration-500"
    >
      {/* Pure Visual Theme Banner */}
      <div>
        <OceanHero />
      </div>

      {/* Page Header block - restored below the banner */}
      <div className="relative z-10 px-2 animate-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-4 shadow-sm backdrop-blur-md">
              <Cpu className="w-4 h-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest font-semibold">CMD_CENTER_</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3">
              Ocean 控制台
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed font-medium">
              当前系统已具备图片上传、增强、检测、OCR、语义分析、垃圾身份证入库与后台核对能力。
            </p>
          </div>
          <div className="shrink-0 mb-2 md:mb-0">
            <WorkerStatusIndicator />
          </div>
        </div>
        <SystemStatusAlert className="mt-2" />
      </div>

      {/* Metrics Cards */}
      <div className="relative z-10 animate-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
        {isLoading && <p className="text-sm text-primary flex items-center gap-2 animate-pulse mb-4"><Sparkles className="w-4 h-4" /> 初始化数据...</p>}
        {hasError && (
          <p className="text-sm text-destructive flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4" />
            {(overviewError as Error | null)?.message ?? (identitiesError as Error | null)?.message ?? "数据加载失败"}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...(overview?.metrics ?? []), ...liveMetrics].slice(0, 4).map((item) => {
            // @ts-expect-error item might not have icon defined
            const Icon = item.icon || Activity;

            return (
              <div
                key={`${item.label}-${item.value}`}
                className="bg-white/40 backdrop-blur-xl p-6 rounded-xl border border-white/60 flex flex-col gap-4 group transition-all hover:bg-white/60 hover:shadow-[0_8px_32px_rgb(0,130,255,0.08)] shadow-[0_4px_24px_rgb(0,130,255,0.04)]"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{item.label}</span>
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <strong className="text-3xl md:text-4xl font-light text-foreground tracking-tight">{item.value}</strong>
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed mt-auto">{item.note}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
        <div className="lg:col-span-1">
          <div className="h-full bg-white/20 backdrop-blur-2xl rounded-xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.1)] p-6 flex flex-col">
            <div className="mb-6">
              <h2 className="text-sm font-mono uppercase text-muted-foreground mb-1">Quick Actions</h2>
              <h3 className="text-lg font-medium text-foreground">业务入口</h3>
            </div>

            <div className="flex flex-col gap-2 flex-1">
              {quickLinks.map((item) => (
                <div key={item.href}>
                  <Link href={item.href} className="group flex items-center gap-4 p-4 rounded-lg border border-white/60 bg-white/40 hover:bg-white/70 hover:border-white/80 hover:shadow-md transition-all duration-200">
                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm truncate">{item.title}</h4>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="h-full bg-white/20 backdrop-blur-2xl rounded-xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.1)] p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/40">
              <div>
                <h2 className="text-sm font-mono uppercase text-muted-foreground mb-1">Review Queue</h2>
                <h3 className="text-lg font-medium text-foreground">待处理记录</h3>
              </div>
              <Link href="/admin/trash" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                全部 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {identities?.items?.length ? (
                identities.items.map((item) => (
                  <div
                    key={item.identityId}
                    className="flex flex-col p-4 rounded-lg border border-white/60 bg-white/40 hover:bg-white/80 hover:shadow-lg transition-all relative group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", item.volunteerRiskLevel === "high" ? "bg-destructive" : "bg-primary")} />
                        <div className="flex flex-col min-w-0">
                          <strong className="font-medium text-sm text-foreground truncate">{item.recognizedCategory}</strong>
                          <span className="text-[11px] text-muted-foreground truncate">{item.professionalCategory}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">ID: {item.identityId.slice(0, 6)}</span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      {item.siteName}
                    </p>

                    <div className="mt-auto p-3 rounded bg-white/40 border border-white/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-muted-foreground/80 uppercase">Status</span>
                        <span className={cn(
                          "text-[10px] font-medium",
                          item.reviewStatus === '已确认' ? 'text-emerald-600' : 'text-amber-600'
                        )}>
                          {item.reviewStatus}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-1">{item.volunteerSummary}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground border border-dashed border-white/60 rounded-lg bg-white/40">
                  <Database className="w-6 h-6 text-muted-foreground/50" />
                  <span className="text-xs font-mono uppercase tracking-wider">
                    {isLoadingIdentities ? "LOADING..." : "NO_RECORDS_FOUND"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="animate-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
        <div className="bg-white/40 backdrop-blur-2xl rounded-xl border border-white/60 shadow-[0_8px_32px_rgb(0,100,255,0.06)] p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 shrink-0">
            <Network className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-medium text-foreground">模型运行栈</h2>
              <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Stack_Status</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end w-full">
            {stackItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-background">
                <div className="w-1 h-1 rounded-full bg-primary" />
                <span className="text-[11px] font-medium text-foreground">{item.label}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline-block border-l border-border pl-2">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div >
  );
}
