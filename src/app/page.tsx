"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ArrowRight } from "lucide-react";

type OverviewResponse = {
  metrics: Array<{ label: string; value: string; note: string }>;
  topSites: Array<{ name: string; risk: string; topCategory: string }>;
};

type IdentityItem = {
  identityId: string;
  siteName: string;
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
  { href: "/collect", title: "新建采集任务", description: "上传图片并触发整条 AI 流水线" },
  { href: "/admin/trash", title: "进入后台核对", description: "查看入库记录并处理待复核样本" },
  { href: "/dashboard", title: "查看治理看板", description: "追踪重点潜点与风险变化" },
];

const stackItems = [
  "增强：NAFNet 本地推理",
  "检测：DAMO-YOLO ONNX 本地执行",
  "OCR：检测 + 识别双阶段",
  "语义：Qwen ModelScope 推理",
];

export default function Home() {
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
    const pending = identities?.counts?.pendingReview ?? 0;
    const needsOcr = identities?.counts?.needsOcr ?? 0;
    const confirmed = identities?.counts?.confirmed ?? 0;

    return [
      { label: "待复核", value: String(pending), note: "等待人工确认的垃圾身份证" },
      { label: "待补 OCR", value: String(needsOcr), note: "需要补充文字线索的记录" },
      { label: "已确认", value: String(confirmed), note: "已经完成业务确认的记录" },
    ];
  }, [identities]);

  const hasError = overviewError || identitiesError;
  const isLoading = isLoadingOverview || isLoadingIdentities;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-none shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Command Center</p>
              <CardTitle className="text-3xl font-extrabold">Ocean 项目工作台</CardTitle>
            </div>
            <Badge variant="default" className="bg-emerald-500 text-white hover:bg-emerald-600">AI 流水线可用</Badge>
          </div>
          <CardDescription className="text-base mt-2 max-w-3xl">
            当前系统已经具备图片上传、增强、检测、OCR、语义分析、垃圾身份证入库与后台核对能力。这个首页默认展示项目运行状态和待办工作。
          </CardDescription>
          {isLoading && <p className="text-sm text-muted-foreground mt-2">正在加载项目工作台数据...</p>}
          {hasError && <p className="text-sm text-destructive mt-2">数据加载失败，请检查后端服务是否正常启动。</p>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {[...(overview?.metrics ?? []), ...liveMetrics].slice(0, 4).map((item) => (
              <div key={`${item.label}-${item.value}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                <strong className="text-2xl font-bold text-foreground">{item.value}</strong>
                <p className="text-xs text-muted-foreground mt-1">{item.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Quick Actions</p>
            <CardTitle className="text-xl">直接进入业务操作</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="group flex items-center justify-between p-4 rounded-xl border hover:border-primary hover:shadow-sm transition-all bg-slate-50/50 hover:bg-white">
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Model Stack</p>
            <CardTitle className="text-xl">当前运行栈</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {stackItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                  <span className="text-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Review Queue</p>
              <CardTitle className="text-xl">待处理记录</CardTitle>
            </div>
            <Link href="/admin/trash" className="text-sm text-primary flex items-center gap-1 hover:underline">
              查看全部 <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {identities?.items?.length ? (
                identities.items.map((item) => (
                  <div key={item.identityId} className="flex flex-col gap-2 p-4 rounded-xl border bg-slate-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="font-semibold">{item.primaryCategory}</strong>
                      <Badge variant={item.volunteerRiskLevel === "high" ? "destructive" : "secondary"} className="capitalize">
                        {item.volunteerRiskLevel}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">{item.siteName}</p>
                    <div className="text-xs text-muted-foreground mt-2 flex flex-col gap-1">
                      <span>ID: {item.identityId.slice(0, 8)}...</span>
                      <span>状态: {item.reviewStatus}</span>
                      <span className="line-clamp-2 mt-1 italic">"{item.volunteerSummary}"</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
                  {isLoadingIdentities ? "正在加载记录..." : "当前还没有入库记录，请先从采集页生成第一条垃圾身份证。"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
