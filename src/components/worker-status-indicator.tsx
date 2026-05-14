"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkerMonitoring = {
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
};

export type HealthResponse = {
  status: "ok" | "degraded";
  api: "ok";
  database: "ok" | "error";
  databaseMessage: string | null;
  worker: WorkerMonitoring;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function getWorkerMeta(status: WorkerMonitoring["status"]) {
  if (status === "healthy") {
    return {
      label: "Worker 在线",
      detail: "队列空闲",
      className: "bg-emerald-50/80 border-emerald-200 text-emerald-700",
      icon: CheckCircle2,
    };
  }
  if (status === "busy") {
    return {
      label: "Worker 忙碌",
      detail: "正在消费队列",
      className: "bg-blue-50/80 border-blue-200 text-blue-700",
      icon: Loader2,
    };
  }
  if (status === "degraded") {
    return {
      label: "Worker 异常",
      detail: "在线但状态异常",
      className: "bg-amber-50/80 border-amber-200 text-amber-700",
      icon: AlertCircle,
    };
  }
  return {
    label: "Worker 离线",
    detail: "未检测到在线心跳",
    className: "bg-red-50/80 border-red-200 text-red-700",
    icon: XCircle,
  };
}

function getSystemMeta(data: HealthResponse | undefined, isError: boolean) {
  if (isError) {
    return {
      label: "后端异常",
      detail: "无法获取健康状态，请检查 API 服务。",
      className: "bg-red-50/80 border-red-200 text-red-700",
      icon: XCircle,
    };
  }
  if (data?.database === "error") {
    return {
      label: "数据库异常",
      detail: data.databaseMessage ?? "数据库当前不可用。",
      className: "bg-red-50/80 border-red-200 text-red-700",
      icon: AlertCircle,
    };
  }
  return null;
}

type WorkerStatusIndicatorProps = {
  className?: string;
  showMessage?: boolean;
};

export function WorkerStatusIndicator({
  className,
  showMessage = false,
}: WorkerStatusIndicatorProps) {
  const { data, isError } = useHealthStatus();

  const systemMeta = getSystemMeta(data, isError);
  const worker = data?.worker;
  const meta = systemMeta ?? getWorkerMeta(worker?.status ?? "offline");
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md border shadow-sm",
        meta.className,
        className,
      )}
    >
      <Icon
        className={cn(
          "w-4 h-4 shrink-0",
          worker?.status === "busy" && "animate-spin",
        )}
      />
      <div className="flex flex-col">
        <span className="text-xs font-mono tracking-wide font-semibold">
          {meta.label}
        </span>
        {showMessage ? (
          <span className="text-[10px] opacity-80">
            {systemMeta ? meta.detail : (worker?.message ?? meta.detail)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type SystemStatusAlertProps = {
  className?: string;
};

export function SystemStatusAlert({ className }: SystemStatusAlertProps) {
  const { data, isError } = useHealthStatus();
  const meta = getSystemMeta(data, isError);
  if (!meta) return null;

  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm backdrop-blur-md shadow-sm",
        meta.className,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{meta.label}</span>
          <span className="opacity-90">{meta.detail}</span>
        </div>
      </div>
    </div>
  );
}

export function useHealthStatus() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("健康状态加载失败");
      }
      return response.json();
    },
    refetchInterval: 3000,
  });
}
