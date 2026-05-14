"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, ShieldAlert, Sparkles, MapPin, Search, type LucideIcon } from "lucide-react";
import { readApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { SystemStatusAlert } from "@/components/worker-status-indicator";

type OverviewResponse = {
  status: "live" | "empty";
  metrics: Array<{ label: string; value: string; note: string }>;
  topSites: Array<{ name: string; risk: string; topCategory: string; recordCount: number }>;
};

type MetricCard = {
  label: string;
  value: string;
  note: string;
  icon?: LucideIcon;
  color?: string;
  bg?: string;
};

type IdentityItem = {
  identityId: string;
  siteName: string;
  recognizedCategory: string;
  professionalCategory: string;
  primaryCategory: string;
  volunteerRiskLevel: string;
  volunteerTags: string[];
  volunteerSummary: string;
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

const modelStatus = [
  "增强：NAFNet 本地推理",
  "检测：DAMO-YOLO ONNX 本地执行",
  "OCR：检测 + 识别双阶段",
  "语义：Qwen 云端推理",
];

export default function DashboardPage() {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      setChartReady(Boolean(rect && rect.width > 0 && rect.height > 0));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
    const queue = identities?.counts?.pendingReview ?? 0;
    const needsOcr = identities?.counts?.needsOcr ?? 0;
    const highRisk = identities?.items?.filter((item) => item.volunteerRiskLevel === "high").length ?? 0;

    return [
      { label: "待复核记录", value: String(queue), note: "来自真实垃圾身份证入库结果", icon: Activity, color: "text-primary", bg: "bg-primary/10" },
      { label: "高风险样本", value: String(highRisk), note: "优先人工核对与复查", icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10" },
      { label: "待补文字线索", value: String(needsOcr), note: "文字线索不足的记录数量", icon: Search, color: "text-amber-500", bg: "bg-amber-500/10" },
    ];
  }, [identities]);

  const metricCards = useMemo<MetricCard[]>(() => {
    const icons = [MapPin, Activity, ShieldAlert, Sparkles, Search];
    const colors = ["text-primary", "text-primary", "text-destructive", "text-amber-500", "text-secondary"];
    const backgrounds = ["bg-primary/10", "bg-primary/10", "bg-destructive/10", "bg-amber-500/10", "bg-secondary/10"];
    const overviewCards = overview?.metrics.map((metric, index) => ({
      ...metric,
      icon: icons[index] ?? Activity,
      color: colors[index] ?? "text-primary",
      bg: backgrounds[index] ?? "bg-primary/10",
    })) ?? [];

    return overviewCards.length ? overviewCards : liveMetrics;
  }, [liveMetrics, overview]);

  const chartData = useMemo(() => {
    if (!identities?.counts) return [];
    return [
      { name: "待复核", count: identities.counts.pendingReview, color: "#0f6ccf" },
      { name: "待补文字线索", count: identities.counts.needsOcr, color: "#f59e0b" },
      { name: "已确认", count: identities.counts.confirmed, color: "#169678" },
    ];
  }, [identities]);

  const hasError = overviewError || identitiesError;
  const isLoading = isLoadingOverview || isLoadingIdentities;

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none -z-10" />

      <div className="flex flex-col gap-2 relative z-10">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/80 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Dashboard
        </p>
        <h1 className="text-4xl font-black tracking-tight text-foreground">治理看板</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">看板同时展示静态治理指标和实时入库记录，方便从“模型结果”回到“业务动作”。</p>
        <SystemStatusAlert className="mt-2 max-w-2xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        <div className="lg:col-span-2">
          <Card className="h-full bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/40 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Live Metrics</p>
                <CardTitle className="text-2xl font-bold">当前治理状态</CardTitle>
              </div>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">实时读取后端接口</Badge>
            </CardHeader>
            <CardContent>
              {hasError && (
                <p className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-xl">
                  {(overviewError as Error | null)?.message ?? (identitiesError as Error | null)?.message ?? "数据加载失败，请检查服务连接。"}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-2">
                {metricCards.slice(0, 3).map((item) => {
                  const Icon = item.icon ?? Activity;
                  const iconColor = item.color ?? "text-primary";
                  const iconBg = item.bg ?? "bg-primary/10";

                  return (
                    <motion.div
                      key={`${item.label}-${item.value}`}
                      whileHover={{ y: -5, scale: 1.02 }}
                      className="bg-white/40 backdrop-blur-md p-5 rounded-2xl border border-white/60 shadow-sm flex flex-col gap-3 group relative overflow-hidden"
                    >
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-muted-foreground">{item.label}</span>
                        <div className={cn("p-2 rounded-xl", iconBg)}>
                          <Icon className={cn("w-4 h-4", iconColor)} />
                        </div>
                      </div>
                      <strong className="text-4xl font-black text-foreground tracking-tighter">{item.value}</strong>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">{item.note}</p>
                    </motion.div>
                  );
                })}
              </div>
              <div ref={chartContainerRef} className="mt-8 h-[280px] min-h-[280px] w-full min-w-0 p-4 bg-white/30 rounded-2xl border border-white/60 backdrop-blur-md">
                {chartReady && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.4)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                      <Tooltip
                        cursor={{ fill: 'rgba(15, 108, 207, 0.05)' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50} animationDuration={1500}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-white/60 rounded-xl text-muted-foreground text-sm gap-2">
                    <Activity className="w-8 h-8 text-slate-300" />
                    {isLoading ? "正在加载图表数据..." : chartReady ? "暂无图表数据" : "正在初始化图表容器..."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none" />
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Model Status</p>
              <CardTitle className="text-2xl font-bold">运行中的 AI 组件</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {modelStatus.map((item, i) => (
                  <motion.li
                    key={item}
                    custom={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center gap-4 text-sm p-4 rounded-xl bg-white/40 border border-white/60 hover:bg-white/60 transition-colors shadow-sm backdrop-blur-md"
                  >
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                    <span className="text-foreground font-semibold">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        <div>
          <Card className="h-full bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Recent Identities</p>
              <CardTitle className="text-2xl font-bold">最近入库记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {identities?.items?.length ? (
                  identities.items.map((item, i) => (
                    <motion.div
                      key={item.identityId}
                      custom={i}
                      whileHover={{ x: 5 }}
                      className="flex flex-col gap-3 p-5 rounded-2xl border border-white/60 bg-white/40 hover:bg-white/60 shadow-sm transition-all relative overflow-hidden group backdrop-blur-md"
                    >
                      <div className={cn(
                        "absolute top-0 left-0 w-1 h-full transition-all duration-300 group-hover:w-2",
                        item.volunteerRiskLevel === "high" ? "bg-destructive" : "bg-primary"
                      )} />
                      <div className="flex items-start justify-between gap-2 pl-2">
                        <div className="flex flex-col min-w-0">
                          <strong className="font-bold text-lg text-foreground truncate">{item.recognizedCategory}</strong>
                          <span className="text-[11px] text-muted-foreground truncate">{item.professionalCategory}</span>
                        </div>
                        <Badge variant={item.volunteerRiskLevel === "high" ? "destructive" : "secondary"} className="capitalize shadow-sm">
                          {item.volunteerRiskLevel}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium text-muted-foreground flex justify-between pl-2">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.siteName}</span>
                      </div>
                      <div className="mt-2 p-3 bg-white/50 rounded-xl border border-white/40 ml-2">
                        <p className="text-xs text-muted-foreground/90 line-clamp-2 italic leading-relaxed">&quot;{item.volunteerSummary}&quot;</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground border-2 border-dashed border-white/40 rounded-2xl bg-white/20 backdrop-blur-sm">
                    <Sparkles className="w-8 h-8 text-slate-300" />
                    <span className="text-sm font-medium">
                      {isLoadingIdentities ? "正在加载记录..." : "还没有入库记录，请先到采集页执行一次流水线。"}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary/80 mb-1">Hotspot Overview</p>
              <CardTitle className="text-2xl font-bold">重点潜点</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-white/40 border-b border-white/40">
                    <tr>
                      <th className="px-5 py-4 font-bold">潜点</th>
                      <th className="px-5 py-4 font-bold">专业类别</th>
                      <th className="px-5 py-4 font-bold">风险</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.topSites ?? []).map((site, i) => (
                      <motion.tr
                        key={site.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="border-b border-white/40 last:border-0 hover:bg-white/50 transition-colors group"
                      >
                        <td className="px-5 py-4 font-semibold text-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          {site.name}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground font-medium">{site.topCategory}</td>
                        <td className="px-5 py-4">
                          <Badge variant={site.risk === "高" || site.risk === "High" ? "destructive" : "outline"} className={site.risk === "高" || site.risk === "High" ? "shadow-sm" : "bg-white"}>
                            {site.risk} · {site.recordCount}条
                          </Badge>
                        </td>
                      </motion.tr>
                    ))}
                    {(!overview?.topSites || overview.topSites.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-5 py-12 text-center text-muted-foreground bg-slate-50/50">
                          <div className="flex flex-col items-center gap-2">
                            <MapPin className="w-6 h-6 text-slate-300" />
                            {isLoadingOverview ? "加载中..." : "暂无潜点数据"}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
