"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

type OverviewResponse = {
  metrics: Array<{ label: string; value: string; note: string }>;
  topSites: Array<{ name: string; risk: string; topCategory: string }>;
};

type IdentityItem = {
  identityId: string;
  siteName: string;
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
  const { data: overview, isLoading: isLoadingOverview, error: overviewError } = useQuery<OverviewResponse>({
    queryKey: ["overview"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/overview`);
      if (!res.ok) throw new Error("加载概览数据失败");
      return res.json();
    },
  });

  const { data: identities, isLoading: isLoadingIdentities, error: identitiesError } = useQuery<IdentityResponse>({
    queryKey: ["identities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/v1/trash-identities?limit=6`);
      if (!res.ok) throw new Error("加载入库记录失败");
      return res.json();
    },
  });

  const liveMetrics = useMemo(() => {
    const queue = identities?.counts?.pendingReview ?? 0;
    const needsOcr = identities?.counts?.needsOcr ?? 0;
    const highRisk = identities?.items?.filter((item) => item.volunteerRiskLevel === "high").length ?? 0;

    return [
      { label: "待复核记录", value: String(queue), note: "来自真实垃圾身份证入库结果" },
      { label: "高风险样本", value: String(highRisk), note: "优先人工核对与复查" },
      { label: "待补 OCR", value: String(needsOcr), note: "文字线索不足的记录数量" },
    ];
  }, [identities]);

  const chartData = useMemo(() => {
    if (!identities?.counts) return [];
    return [
      { name: "待复核", count: identities.counts.pendingReview, color: "#169678" },
      { name: "待补OCR", count: identities.counts.needsOcr, color: "#eab308" },
      { name: "已确认", count: identities.counts.confirmed, color: "#0f6ccf" },
    ];
  }, [identities]);

  const hasError = overviewError || identitiesError;
  const isLoading = isLoadingOverview || isLoadingIdentities;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dashboard</p>
        <h1 className="text-3xl font-extrabold tracking-tight">治理看板</h1>
        <p className="text-muted-foreground">看板同时展示静态治理指标和实时入库记录，方便从“模型结果”回到“业务动作”。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Live Metrics</p>
              <CardTitle className="text-xl">当前治理状态</CardTitle>
            </div>
            <Badge variant="secondary">实时读取后端接口</Badge>
          </CardHeader>
          <CardContent>
            {hasError && <p className="text-sm text-destructive mb-4">数据加载失败。</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              {[...(overview?.metrics ?? []), ...liveMetrics].slice(0, 3).map((item) => (
                <div key={`${item.label}-${item.value}`} className="bg-slate-50 p-4 rounded-xl border flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                  <strong className="text-3xl font-bold text-foreground">{item.value}</strong>
                  <p className="text-xs text-muted-foreground mt-1">{item.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 h-[250px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center border border-dashed rounded-xl text-muted-foreground text-sm">
                  {isLoading ? "正在加载图表数据..." : "暂无图表数据"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Model Status</p>
            <CardTitle className="text-xl">运行中的 AI 组件</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {modelStatus.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Recent Identities</p>
            <CardTitle className="text-xl">最近入库记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {identities?.items?.length ? (
                identities.items.map((item) => (
                  <div key={item.identityId} className="flex flex-col gap-2 p-4 rounded-xl border hover:border-primary/50 transition-colors bg-slate-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="font-semibold text-foreground">{item.primaryCategory}</strong>
                      <Badge variant={item.volunteerRiskLevel === "high" ? "destructive" : "secondary"}>
                        {item.volunteerRiskLevel}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground flex justify-between">
                      <span>{item.siteName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">"{item.volunteerSummary}"</p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
                  {isLoadingIdentities ? "正在加载记录..." : "还没有入库记录，请先到采集页执行一次流水线。"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Hotspot Overview</p>
            <CardTitle className="text-xl">重点潜点</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-tl-xl rounded-bl-xl">潜点</th>
                    <th className="px-4 py-3 font-semibold">主垃圾类型</th>
                    <th className="px-4 py-3 font-semibold rounded-tr-xl rounded-br-xl">风险</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.topSites ?? []).map((site) => (
                    <tr key={site.name} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{site.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{site.topCategory}</td>
                      <td className="px-4 py-3">
                        <Badge variant={site.risk === "High" ? "destructive" : "outline"}>{site.risk}</Badge>
                      </td>
                    </tr>
                  ))}
                  {(!overview?.topSites || overview.topSites.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground border border-dashed rounded-xl">
                        {isLoadingOverview ? "加载中..." : "暂无潜点数据"}
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
  );
}
