"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readApiErrorMessage } from "@/lib/api-error";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Clock3,
  History,
  Loader2,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

type PipelineJobListItem = {
  jobId: string;
  status: JobStatus;
  stage: string;
  progress: number;
  message: string;
  retryCount: number;
  cacheHitCount: number;
  inflightReuseCount: number;
  lastReuseReason: "new" | "inflight" | "completed" | null;
  identityId: string | null;
  siteName: string;
  recognizedCategory: string | null;
  professionalCategory: string | null;
  primaryCategory: string | null;
  errorDetail?: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  lastReusedAt: string | null;
};

type PipelineJobListResponse = {
  items: PipelineJobListItem[];
  counts: {
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
    canceled: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  monitoring: {
    status: "healthy" | "busy" | "offline" | "degraded";
    message: string;
    queuedJobs: number;
    runningJobs: number;
    onlineWorkers: number;
    busyWorkers: number;
    registeredWorkers: number;
    staleWorkers: number;
    lastHeartbeatAt: string | null;
    staleAfterSeconds: number;
    workers: Array<{
      workerId: string;
      status: string;
      currentJobId: string | null;
      lastClaimedJobId: string | null;
      lastCompletedJobId: string | null;
      heartbeatAt: string;
      startedAt: string;
      isOnline: boolean;
    }>;
  };
};

type FilterState = {
  q: string;
  status: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const statusMeta: Record<
  JobStatus,
  { label: string; icon: typeof Clock3; badgeClass: string; cardClass: string }
> = {
  queued: {
    label: "排队中",
    icon: Clock3,
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
    cardClass: "text-slate-600 bg-slate-500/10",
  },
  running: {
    label: "执行中",
    icon: Loader2,
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
    cardClass: "text-blue-600 bg-blue-500/10",
  },
  succeeded: {
    label: "已完成",
    icon: CheckCircle2,
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cardClass: "text-emerald-600 bg-emerald-500/10",
  },
  failed: {
    label: "失败",
    icon: XCircle,
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    cardClass: "text-destructive bg-destructive/10",
  },
  canceled: {
    label: "已取消",
    icon: XCircle,
    badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
    cardClass: "text-orange-600 bg-orange-500/10",
  },
};

function formatTime(value: string | null) {
  if (!value) return "未完成";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getReuseLabel(reason: PipelineJobListItem["lastReuseReason"]) {
  if (reason === "completed") return "结果缓存命中";
  if (reason === "inflight") return "进行中复用";
  return "首次执行";
}

function getMonitoringMeta(status: PipelineJobListResponse["monitoring"]["status"]) {
  if (status === "healthy") {
    return {
      label: "在线空闲",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      cardClass: "text-emerald-600 bg-emerald-500/10",
      icon: CheckCircle2,
    };
  }
  if (status === "busy") {
    return {
      label: "在线忙碌",
      badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
      cardClass: "text-blue-600 bg-blue-500/10",
      icon: Loader2,
    };
  }
  if (status === "degraded") {
    return {
      label: "状态异常",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      cardClass: "text-amber-600 bg-amber-500/10",
      icon: AlertCircle,
    };
  }
  return {
    label: "离线",
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    cardClass: "text-destructive bg-destructive/10",
    icon: XCircle,
  };
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>({ q: "", status: "" });
  const [page, setPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const pageSize = 12;

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const q = filters.q.trim();
    if (q) params.set("q", q);
    if (filters.status) params.set("status", filters.status);
    return params.toString();
  }, [filters, page]);

  const { data, isLoading, error, refetch, isFetching } = useQuery<PipelineJobListResponse>({
    queryKey: ["pipeline-jobs", filters, page],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/pipeline-jobs?${queryString}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, "任务历史加载失败。"));
      return response.json();
    },
    refetchInterval: (query) => {
      const counts = query.state.data?.counts;
      const monitoring = query.state.data?.monitoring;
      if (counts && (counts.queued > 0 || counts.running > 0)) return 2000;
      if (monitoring && monitoring.registeredWorkers > 0) return 3000;
      return false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/pipeline/${jobId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "任务重试失败。"));
      }
      return response.json() as Promise<{ jobId: string }>;
    },
    onSuccess: async (data) => {
      toast.success(`任务 ${data.jobId} 已重新入队。`);
      setSelectedJobId(data.jobId);
      await queryClient.invalidateQueries({ queryKey: ["pipeline-jobs"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/pipeline/${jobId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "任务取消失败。"));
      }
      return response.json() as Promise<{ jobId: string }>;
    },
    onSuccess: async () => {
      toast.success("任务已取消。");
      await queryClient.invalidateQueries({ queryKey: ["pipeline-jobs"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const selectedJob = useMemo(() => {
    if (!data?.items?.length) return null;
    if (selectedJobId) {
      return data.items.find((item) => item.jobId === selectedJobId) ?? data.items[0];
    }
    return data.items[0];
  }, [data, selectedJobId]);
  const monitoring = data?.monitoring;
  const monitoringMeta = monitoring ? getMonitoringMeta(monitoring.status) : null;
  const MonitoringIcon = monitoringMeta?.icon;
  const workerCommand = ".venv/bin/python services/api/scripts/run_pipeline_worker.py";

  function updateFilter(key: keyof FilterState, value: string) {
    setSelectedJobId(null);
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setSelectedJobId(null);
    setPage(1);
    setFilters({ q: "", status: "" });
  }

  async function copyWorkerCommand() {
    try {
      await navigator.clipboard.writeText(workerCommand);
      toast.success("已复制 worker 启动命令。");
    } catch {
      toast.error("复制失败，请手动复制命令。");
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto relative">
      <div className="absolute top-0 right-0 h-[380px] w-[380px] rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 h-[320px] w-[320px] rounded-full bg-secondary/5 blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none -z-10" />

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-primary/80 flex items-center gap-2">
            <History className="w-4 h-4" /> Job History
          </p>
          <h1 className="text-4xl font-black tracking-tight text-foreground">任务历史</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            查看流水线任务队列、执行进度、完成结果和失败原因。
          </p>
        </div>
        <Button type="button" variant="outline" className="bg-white/50 border-white/60" onClick={() => refetch()}>
          {isFetching ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Activity className="mr-2 w-4 h-4" />}
          刷新列表
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {([
          ["queued", data?.counts.queued ?? 0, "等待后台处理"],
          ["running", data?.counts.running ?? 0, "正在执行中的任务"],
          ["succeeded", data?.counts.succeeded ?? 0, "已完成并可追溯结果"],
          ["failed", data?.counts.failed ?? 0, "需要查看失败原因"],
          ["canceled", data?.counts.canceled ?? 0, "已人工取消的任务"],
        ] as const).map(([status, value, note]) => {
          const meta = statusMeta[status];
          const Icon = meta.icon;
          return (
            <motion.div
              key={status}
              whileHover={{ y: -4, scale: 1.01 }}
              className="bg-white/40 backdrop-blur-md p-5 rounded-2xl border border-white/60 shadow-sm flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">{meta.label}</span>
                <div className={cn("p-2 rounded-xl", meta.cardClass)}>
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      status === "running" && value > 0 && "animate-spin"
                    )}
                  />
                </div>
              </div>
              <strong className="text-4xl font-black text-foreground tracking-tighter">{value}</strong>
              <p className="text-xs text-muted-foreground/80">{note}</p>
            </motion.div>
          );
        })}
      </div>

      {monitoring && monitoringMeta && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
          <Card className="bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)]">
            <CardHeader className="border-b border-white/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary/80">Worker Monitor</p>
                  <CardTitle className="text-2xl font-bold">Worker 状态</CardTitle>
                </div>
                {MonitoringIcon ? (
                  <Badge variant="outline" className={monitoringMeta.badgeClass}>
                    <MonitoringIcon className={cn("mr-1 w-3.5 h-3.5", monitoring.status === "busy" && "animate-spin")} />
                    {monitoringMeta.label}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-6 flex flex-col gap-4">
              <div className={cn("rounded-2xl p-4 border border-white/60", monitoringMeta.cardClass)}>
                <p className="text-sm font-semibold">{monitoring.message}</p>
                <p className="text-xs mt-2 opacity-80">
                  最近心跳：{formatTime(monitoring.lastHeartbeatAt)}，超过 {monitoring.staleAfterSeconds} 秒未更新即判定为离线。
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/35 p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">启动命令</p>
                <code className="rounded-xl bg-white/60 border border-white/60 px-3 py-2 text-xs font-mono text-foreground break-all">
                  {workerCommand}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit bg-white/60 border-white/60"
                  onClick={copyWorkerCommand}
                >
                  <Copy className="mr-2 w-4 h-4" />
                  复制命令
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "在线 worker", value: String(monitoring.onlineWorkers) },
                  { label: "忙碌 worker", value: String(monitoring.busyWorkers) },
                  { label: "已注册 worker", value: String(monitoring.registeredWorkers) },
                  { label: "心跳过期", value: String(monitoring.staleWorkers) },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/60 bg-white/35 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)]">
            <CardHeader className="border-b border-white/40">
              <CardTitle className="text-2xl font-bold">队列监控</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "排队任务", value: String(monitoring.queuedJobs) },
                  { label: "运行任务", value: String(monitoring.runningJobs) },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/60 bg-white/35 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/35 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">最近 worker</p>
                {monitoring.workers.length ? (
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <span className="font-mono text-foreground break-all">{monitoring.workers[0].workerId}</span>
                    <span className="text-muted-foreground">
                      状态：<span className="font-semibold text-foreground">{monitoring.workers[0].status}</span>
                    </span>
                    <span className="text-muted-foreground">
                      当前任务：<span className="font-mono text-foreground">{monitoring.workers[0].currentJobId ?? "--"}</span>
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">还没有任何 worker 注册心跳。</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_220px_auto] gap-3 rounded-2xl border border-white/60 bg-white/25 p-4 backdrop-blur-xl shadow-sm">
        <Input
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="搜索任务 ID、潜点、身份证 ID、备注..."
          className="h-10 bg-white/50 border-white/60"
        />
        <select
          value={filters.status}
          onChange={(event) => updateFilter("status", event.target.value)}
          className="h-10 rounded-lg border border-white/60 bg-white/50 px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">全部状态</option>
          <option value="queued">排队中</option>
          <option value="running">执行中</option>
          <option value="succeeded">已完成</option>
          <option value="failed">失败</option>
          <option value="canceled">已取消</option>
        </select>
        <Button type="button" variant="outline" className="h-10 bg-white/50 border-white/60" onClick={resetFilters}>
          重置筛选
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-6 min-h-0">
        <Card className="bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] overflow-hidden">
          <CardHeader className="border-b border-white/40">
            <CardTitle className="text-2xl font-bold">任务列表</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 flex items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                正在加载任务历史...
              </div>
            ) : error ? (
              <div className="p-10 flex items-center justify-center text-destructive gap-3">
                <AlertCircle className="w-5 h-5" />
                {(error as Error).message}
              </div>
            ) : (
              <div>
                <Table className="min-w-[860px]">
                  <TableHeader className="bg-white/35">
                    <TableRow className="border-white/40 hover:bg-transparent">
                      <TableHead className="px-4">任务</TableHead>
                      <TableHead>审计</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>阶段</TableHead>
                      <TableHead>进度</TableHead>
                      <TableHead>潜点</TableHead>
                      <TableHead>具体垃圾名称</TableHead>
                      <TableHead>身份证</TableHead>
                      <TableHead>更新时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.length ? (
                      data.items.map((item) => {
                        const meta = statusMeta[item.status];
                        const Icon = meta.icon;
                        const isSelected = selectedJob?.jobId === item.jobId;
                        return (
                          <TableRow
                            key={item.jobId}
                            className={cn(
                              "cursor-pointer border-white/40 bg-white/10",
                              isSelected && "bg-white/45"
                            )}
                            onClick={() => setSelectedJobId(item.jobId)}
                          >
                            <TableCell className="px-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-xs text-muted-foreground">{item.jobId}</span>
                                <span className="text-sm font-semibold text-foreground">{item.message}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="w-fit border-white/60 bg-white/60 text-foreground">
                                  {getReuseLabel(item.lastReuseReason)}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  缓存 {item.cacheHitCount} 次 / 复用 {item.inflightReuseCount} 次
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={meta.badgeClass}>
                                <Icon className={cn("mr-1 w-3.5 h-3.5", item.status === "running" && "animate-spin")} />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.stage}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${item.progress}%` }} />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">{item.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">{item.siteName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.recognizedCategory ?? item.primaryCategory ?? "处理中"}
                              {item.professionalCategory ? (
                                <span className="ml-2 text-[11px] text-muted-foreground">（{item.professionalCategory}）</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {item.identityId ?? "--"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatTime(item.updatedAt)}</TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow className="border-white/40">
                        <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                          没有符合条件的任务记录
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between gap-4 border-t border-white/40 bg-white/20 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    第 {data?.pagination.page ?? 1} / {data?.pagination.totalPages ?? 1} 页，共 {data?.pagination.totalItems ?? 0} 条
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white/50 border-white/60"
                      disabled={!data?.pagination.hasPrev}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      上一页
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white/50 border-white/60"
                      disabled={!data?.pagination.hasNext}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)]">
          <CardHeader className="border-b border-white/40">
            <CardTitle className="text-2xl font-bold">任务详情</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {selectedJob ? (
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">{selectedJob.jobId}</p>
                    <h2 className="text-xl font-black text-foreground mt-1">{selectedJob.siteName}</h2>
                  </div>
                  <Badge variant="outline" className={statusMeta[selectedJob.status].badgeClass}>
                    {statusMeta[selectedJob.status].label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "当前阶段", value: selectedJob.stage },
                      { label: "进度", value: `${selectedJob.progress}%` },
                      { label: "创建时间", value: formatTime(selectedJob.createdAt) },
                      { label: "结束时间", value: formatTime(selectedJob.finishedAt) },
                      { label: "重试次数", value: String(selectedJob.retryCount ?? 0) },
                      { label: "缓存命中", value: String(selectedJob.cacheHitCount ?? 0) },
                      { label: "进行中复用", value: String(selectedJob.inflightReuseCount ?? 0) },
                    ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/60 bg-white/35 p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/35 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">处理消息</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{selectedJob.message}</p>
                </div>

                {monitoring && selectedJob.status === "queued" && monitoring.onlineWorkers === 0 && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wider">队列告警</p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      任务仍在排队，但当前没有在线 worker。请先启动 `run_pipeline_worker.py`，任务才会继续推进。
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-white/60 bg-white/35 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">缓存审计</p>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <span className="text-muted-foreground">最近复用类型：<span className="font-semibold text-foreground">{getReuseLabel(selectedJob.lastReuseReason)}</span></span>
                    <span className="text-muted-foreground">最近复用时间：<span className="font-semibold text-foreground">{formatTime(selectedJob.lastReusedAt)}</span></span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/35 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">结果定位</p>
                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <span className="text-muted-foreground">具体垃圾名称：<span className="font-semibold text-foreground">{selectedJob.recognizedCategory ?? selectedJob.primaryCategory ?? "处理中"}</span></span>
                    <span className="text-muted-foreground">专业类别：<span className="font-semibold text-foreground">{selectedJob.professionalCategory ?? "处理中"}</span></span>
                    <span className="text-muted-foreground">垃圾身份证：<span className="font-mono text-foreground">{selectedJob.identityId ?? "--"}</span></span>
                  </div>
                </div>

                {selectedJob.status === "failed" && selectedJob.errorDetail && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wider">失败原因</p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{selectedJob.errorDetail}</p>
                  </div>
                )}

                {(selectedJob.status === "queued" || selectedJob.status === "running") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white/50 border-white/60"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(selectedJob.jobId)}
                  >
                    {cancelMutation.isPending ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <XCircle className="mr-2 w-4 h-4" />}
                    取消任务
                  </Button>
                )}

                {(selectedJob.status === "failed" || selectedJob.status === "canceled") && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white/50 border-white/60"
                    disabled={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(selectedJob.jobId)}
                  >
                    {retryMutation.isPending ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <RotateCcw className="mr-2 w-4 h-4" />}
                    重试任务
                  </Button>
                )}

                {selectedJob.identityId && (
                  <Button asChild className="w-full">
                    <Link href={`/admin/trash?selected=${selectedJob.identityId}`}>
                      去后台核对查看结果 <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground border-2 border-dashed border-white/40 rounded-2xl bg-white/25">
                <Search className="w-8 h-8 text-slate-300" />
                <span>请选择一条任务记录</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
