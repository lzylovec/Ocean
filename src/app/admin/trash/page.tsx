"use client";

import Image from "next/image";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileEdit, Archive, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type TrashIdentityItem = {
  identityId: string;
  siteName: string;
  volunteerNote: string;
  originalUrl: string;
  enhancedUrl: string;
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

export default function TrashAdminPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<TrashIdentityResponse>({
    queryKey: ["trash-identities"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities`, { cache: "no-store" });
      if (!response.ok) throw new Error("垃圾身份证列表加载失败。");
      return response.json();
    },
  });

  const selected = useMemo(() => {
    if (!data?.items) return null;
    if (selectedId) return data.items.find((item) => item.identityId === selectedId) || null;
    return data.items[0] || null;
  }, [data, selectedId]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status }),
      });
      if (!response.ok) throw new Error("更新审核状态失败。");
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast.success(`记录 ${variables.id.slice(0, 8)}... 已更新为 ${variables.status}。`);
      queryClient.invalidateQueries({ queryKey: ["trash-identities"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-2 shrink-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Review Workspace</p>
        <h1 className="text-3xl font-extrabold tracking-tight">垃圾身份证后台核对</h1>
        <p className="text-muted-foreground">这一页围绕“记录列表 + 单条详情”组织，适合实际业务复核。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">待复核</span>
            <strong className="text-2xl font-bold text-foreground">{data?.counts?.pendingReview ?? 0}</strong>
            <p className="text-xs text-muted-foreground mt-1">需要人工确认的记录</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">待补 OCR</span>
            <strong className="text-2xl font-bold text-foreground">{data?.counts?.needsOcr ?? 0}</strong>
            <p className="text-xs text-muted-foreground mt-1">文字线索不足的记录</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">已确认</span>
            <strong className="text-2xl font-bold text-foreground">{data?.counts?.confirmed ?? 0}</strong>
            <p className="text-xs text-muted-foreground mt-1">已完成业务闭环确认</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Column: Queue */}
        <Card className="w-[320px] flex flex-col shrink-0">
          <CardHeader className="px-4 py-4 border-b shrink-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Identity Queue</p>
            <CardTitle className="text-lg">记录队列</CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
            {isLoading && <div className="p-4 text-center text-sm text-muted-foreground">正在加载记录...</div>}
            {error && <div className="p-4 text-center text-sm text-destructive">加载失败</div>}
            {data?.items?.length === 0 && !isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                还没有可复核的记录。
              </div>
            )}
            {data?.items?.map((item) => {
              const isActive = (selected?.identityId === item.identityId);
              return (
                <button
                  key={item.identityId}
                  onClick={() => setSelectedId(item.identityId)}
                  className={cn(
                    "flex flex-col gap-2 p-3 rounded-lg border text-left transition-all",
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "bg-white hover:border-primary/30 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <strong className="font-semibold text-sm truncate">{item.primaryCategory}</strong>
                    <Badge variant={item.volunteerRiskLevel === "high" ? "destructive" : "secondary"} className="capitalize text-[10px] px-1.5 py-0">
                      {item.volunteerRiskLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate w-full">{item.siteName}</p>
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className="text-[10px] font-mono text-muted-foreground bg-slate-100 px-1.5 rounded">{item.identityId.slice(0, 8)}</span>
                    <span className={cn("text-[10px] font-medium", item.reviewStatus === '已确认' ? 'text-emerald-600' : 'text-amber-600')}>
                      {item.reviewStatus}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right Column: Detail */}
        <Card className="flex-1 flex flex-col min-w-0">
          <CardHeader className="px-6 py-4 border-b flex flex-row items-center justify-between shrink-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Identity Detail</p>
              <CardTitle className="text-lg font-mono">{selected?.identityId ?? "暂无记录"}</CardTitle>
            </div>
            {selected && (
              <Badge variant="outline" className={cn(
                "px-3 py-1",
                selected.reviewStatus === '已确认' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
              )}>
                {selected.reviewStatus}
              </Badge>
            )}
          </CardHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-muted-foreground">主类别</span>
                    <strong className="text-base font-semibold text-foreground">{selected.primaryCategory}</strong>
                  </div>
                  <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-muted-foreground">材质线索</span>
                    <strong className="text-base font-semibold text-foreground">{selected.materialHint}</strong>
                  </div>
                  <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-muted-foreground">来源提示</span>
                    <strong className="text-base font-semibold text-foreground">{selected.sourceHint}</strong>
                  </div>
                  <div className="flex flex-col gap-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-muted-foreground">最高置信度</span>
                    <strong className="text-base font-semibold text-foreground">{selected.topConfidence.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <strong className="text-sm font-semibold">原始图片</strong>
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-black/5">
                      <Image src={`${API_BASE_URL}${selected.originalUrl}`} alt="Original" fill className="object-contain" unoptimized />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <strong className="text-sm font-semibold">增强与检测结果</strong>
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-black/5">
                      <Image src={`${API_BASE_URL}${selected.enhancedUrl}`} alt="Enhanced" fill className="object-contain" unoptimized />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 bg-white rounded-xl border border-slate-200">
                    <strong className="text-sm font-semibold block mb-3 text-primary">语义分析摘要</strong>
                    <p className="text-sm leading-relaxed">{selected.volunteerSummary}</p>

                    <strong className="text-sm font-semibold block mt-4 mb-2 text-primary">OCR 提取文本</strong>
                    <p className="text-sm text-muted-foreground">
                      {selected.ocrTexts.length ? selected.ocrTexts.join(" | ") : "未检测到明显文字"}
                    </p>
                  </div>
                  <div className="p-5 bg-white rounded-xl border border-slate-200">
                    <strong className="text-sm font-semibold block mb-3 text-primary">处理建议</strong>
                    <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-2">
                      {selected.actionSuggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-xl">
                请在左侧选择一条记录进行复核
              </div>
            )}
          </div>

          {selected && (
            <CardFooter className="px-6 py-4 border-t bg-slate-50 shrink-0 flex items-center justify-end gap-3">
              <span className="text-sm text-muted-foreground mr-auto">更新记录状态：</span>
              <Button
                variant="outline"
                disabled={updateStatusMutation.isPending}
                onClick={() => updateStatusMutation.mutate({ id: selected.identityId, status: "待补OCR" })}
              >
                <FileEdit className="w-4 h-4 mr-2" /> 待补 OCR
              </Button>
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={updateStatusMutation.isPending}
                onClick={() => updateStatusMutation.mutate({ id: selected.identityId, status: "已确认" })}
              >
                {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                已确认
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
