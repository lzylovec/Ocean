"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, ImagePlus, FileText, Bot, Camera, Sparkles } from "lucide-react";
import { readApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { SystemStatusAlert, WorkerStatusIndicator, useHealthStatus } from "@/components/worker-status-indicator";

type PipelineResponse = {
  identityId: string;
  originalUrl: string;
  enhancedUrl: string;
  enhancementModel: string;
  enhancementMode: string;
  detectionModel: string;
  detectionMode: string;
  ocrModel: string;
  ocrMode: string;
  ocrTexts: string[];
  semanticModel: string;
  semanticMode: string;
  categories: string[];
  recognizedCategory: string;
  professionalCategory: string;
  sourceHint: string;
  materialHint: string;
  ocrKeywords: string[];
  detections: Array<{
    label: string;
    confidence: number;
    bbox: [number, number, number, number];
  }>;
  volunteerTags: string[];
  volunteerSummary: string;
  volunteerRiskLevel: string;
  actionSuggestions: string[];
};

type PipelineJobEnqueueResponse = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  stage: string;
  progress: number;
  message: string;
  retryCount: number;
  cacheHit: boolean;
  dedupeReason: "new" | "inflight" | "completed";
};

type PipelineJobStatusResponse = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  stage: string;
  progress: number;
  message: string;
  retryCount: number;
  identityId: string | null;
  errorDetail: string | null;
  result: PipelineResponse | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const COLLECT_ACTIVE_JOB_STORAGE_KEY = "ocean.collect.activeJobId";
const COLLECT_LAST_RESULT_STORAGE_KEY = "ocean.collect.lastResult";

function resolveMediaUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}

function readSessionValue(key: string) {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
}

function writeSessionValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, value);
}

function removeSessionValue(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}

function readStoredCollectResult(): PipelineResponse | null {
  const raw = readSessionValue(COLLECT_LAST_RESULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PipelineResponse;
  } catch {
    return null;
  }
}

function explainActionSuggestion(suggestion: string) {
  if (suggestion.includes("后台复核")) {
    return "说明当前结果更适合先进入人工确认环节，再决定是否直接入库。";
  }
  if (suggestion.includes("岸线来源")) {
    return "说明这类垃圾更可能与岸线消费、游客活动或近岸输入有关。";
  }
  if (suggestion.includes("OCR")) {
    return "说明可以继续利用品牌、材质或包装文字，帮助判断来源和类别。";
  }
  if (suggestion.includes("渔业")) {
    return "说明该垃圾更可能与渔业活动有关，适合结合作业区和渔具特征继续核对。";
  }
  return "作为后续复核或治理动作的提示，帮助判断这条结果下一步该怎么处理。";
}

const pipelineModules = [
  "图像增强：NAFNet",
  "目标检测：DAMO-YOLO",
  "OCR：检测 + 识别",
  "语义分析：Qwen 云端推理",
];

const formSchema = z.object({
  siteName: z.string().min(2, "潜点名称至少需要2个字符"),
  volunteerNote: z.string().min(5, "反馈信息至少需要5个字符"),
});

export default function CollectPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(() =>
    readSessionValue(COLLECT_ACTIVE_JOB_STORAGE_KEY)
  );
  const lastTerminalJobIdRef = useRef<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siteName: "",
      volunteerNote: "",
    },
  });
  const { data: health } = useHealthStatus();

  const uploadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!selectedFile) throw new Error("请先选择一张水下图片。");

      setActiveJobId(null);
      setProgress(20);
      const uploadForm = new FormData();
      uploadForm.append("file", selectedFile);

      const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/media/upload`, {
        method: "POST",
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        throw new Error(await readApiErrorMessage(uploadResponse, "图片上传失败，请确认后端服务已启动。"));
      }
      const uploadData = (await uploadResponse.json()) as { publicUrl: string; storedPath: string };

      setProgress(60);

      const pipelineResponse = await fetch(`${API_BASE_URL}/api/v1/ai/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaPath: uploadData.storedPath,
          mediaUrl: uploadData.publicUrl,
          siteName: data.siteName,
          volunteerNote: data.volunteerNote,
        }),
      });

      if (!pipelineResponse.ok) {
        throw new Error(await readApiErrorMessage(pipelineResponse, "AI 流水线执行失败，请检查后端日志。"));
      }
      return (await pipelineResponse.json()) as PipelineJobEnqueueResponse;
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      setProgress(data.progress);
      if (data.dedupeReason === "completed" && data.cacheHit) {
        toast.success(`命中缓存，已直接复用任务 ${data.jobId} 的结果。`);
        return;
      }
      if (data.dedupeReason === "inflight") {
        toast.success(`检测到重复提交，已复用进行中的任务 ${data.jobId}。`);
        return;
      }
      toast.success(`任务 ${data.jobId} 已创建，正在后台处理。`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setProgress(0);
    },
  });

  const jobQuery = useQuery<PipelineJobStatusResponse>({
    queryKey: ["pipeline-job", activeJobId],
    enabled: Boolean(activeJobId),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/pipeline/${activeJobId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, "任务状态加载失败。"));
      return response.json();
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "succeeded" || status === "failed" || status === "canceled" ? false : 1200;
    },
  });

  useEffect(() => {
    if (activeJobId) {
      writeSessionValue(COLLECT_ACTIVE_JOB_STORAGE_KEY, activeJobId);
      return;
    }
    removeSessionValue(COLLECT_ACTIVE_JOB_STORAGE_KEY);
  }, [activeJobId]);

  useEffect(() => {
    const job = jobQuery.data;
    if (!job) return;

    if (job.status === "succeeded" && job.result) {
      writeSessionValue(
        COLLECT_LAST_RESULT_STORAGE_KEY,
        JSON.stringify(job.result),
      );
      if (lastTerminalJobIdRef.current !== job.jobId) {
        toast.success(`任务完成，垃圾身份证 ${job.result.identityId} 已写入数据库。`);
        lastTerminalJobIdRef.current = job.jobId;
      }
      return;
    }

    if (job.status === "failed" && lastTerminalJobIdRef.current !== job.jobId) {
      toast.error(job.errorDetail ?? "任务执行失败。");
      lastTerminalJobIdRef.current = job.jobId;
    }

    if (job.status === "canceled" && lastTerminalJobIdRef.current !== job.jobId) {
      toast.error("任务已取消。");
      lastTerminalJobIdRef.current = job.jobId;
    }
  }, [jobQuery.data]);

  const activeJob = jobQuery.data;
  const storedResult = readStoredCollectResult();
  const result =
    activeJob?.status === "succeeded" && activeJob.result
      ? activeJob.result
      : storedResult;
  const displayedProgress = activeJob?.progress ?? progress;
  const isProcessing =
    uploadMutation.isPending ||
    activeJob?.status === "queued" ||
    activeJob?.status === "running";
  const workerStatus = health?.worker;
  const shouldWarnWorkerOffline =
    !isProcessing &&
    workerStatus != null &&
    workerStatus.onlineWorkers === 0 &&
    workerStatus.status === "offline";
  const topDetection = useMemo(() => {
    if (!result?.detections.length) return null;
    return [...result.detections].sort((a, b) => b.confidence - a.confidence)[0];
  }, [result]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedFile) {
      toast.error("请先选择一张水下图片。");
      return;
    }
    uploadMutation.mutate(values);
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none -z-10" />

      <div className="flex flex-col gap-2 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-primary/80 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Collection Workspace
            </p>
            <h1 className="text-4xl font-black tracking-tight text-foreground">现场采集工作台</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">录入采集任务，系统将自动触发增强、检测、OCR、语义分析并生成垃圾身份证。</p>
          </div>
          <WorkerStatusIndicator showMessage className="self-start md:self-auto" />
        </div>
        <SystemStatusAlert className="mt-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        <div className="lg:col-span-2">
          <Card className="bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden">
            <CardHeader className="border-b border-white/40 pb-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-1">Task Input</p>
                  <CardTitle className="text-2xl font-bold">提交采集任务</CardTitle>
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">自动写入垃圾身份证</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="space-y-4">
                    <FormLabel className="text-base font-semibold text-foreground">水下图片</FormLabel>
                    <div
                      className={cn(
                        "relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all",
                        selectedFile ? "border-primary bg-primary/5" : "border-white/60 bg-white/40 hover:bg-white/60 hover:border-primary/50 backdrop-blur-md"
                      )}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
	                        onChange={(e) => {
	                          const file = e.target.files?.[0];
	                          if (!file) return;
	                          if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
	                            toast.error("仅支持 JPG、PNG 和 WebP 图片。");
	                            e.target.value = "";
	                            setSelectedFile(null);
	                            return;
	                          }
	                          if (file.size > MAX_UPLOAD_BYTES) {
	                            toast.error("图片不能超过 10 MB。");
	                            e.target.value = "";
	                            setSelectedFile(null);
	                            return;
	                          }
	                          setSelectedFile(file);
	                        }}
	                      />
                      <div className="flex flex-col items-center justify-center p-12 text-center pointer-events-none">
                        {selectedFile ? (
                          <>
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                              <ImagePlus className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-lg font-medium text-foreground mb-1">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • 点击可重新选择</p>
                          </>
                        ) : (
                          <>
                            <div className="w-16 h-16 rounded-full bg-white/60 flex items-center justify-center mb-4 shadow-sm">
                              <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <p className="text-lg font-medium text-foreground mb-1">
                              <span className="text-primary font-bold">点击上传</span> 或拖拽文件到此处
                            </p>
	                            <p className="text-sm text-muted-foreground">支持 JPG / PNG / WebP，单张不超过 10 MB</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="siteName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold text-foreground">潜点名称</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="例如：深圳湾东潜点、外伶仃北坡、三亚礁盘区"
                              className="h-12 bg-white/50 border-white/60 focus-visible:ring-primary/30 backdrop-blur-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="volunteerNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold text-foreground">志愿者反馈</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="请填写现场情况，例如：能见度、垃圾外观、数量、是否疑似渔具/包装、周边环境线索"
                            className="min-h-[120px] resize-y bg-white/50 border-white/60 focus-visible:ring-primary/30 backdrop-blur-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
	                    <Button
	                      type="submit"
	                      size="lg"
	                      disabled={isProcessing}
	                      className="w-[200px] h-12 text-base font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                    >
                      {isProcessing ? (
	                        <>
	                          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在处理...
	                        </>
                      ) : (
                        <>
                          <Bot className="mr-2 h-5 w-5" /> 执行 AI 流水线
	                        </>
	                      )}
	                    </Button>
                    {shouldWarnWorkerOffline && (
                      <div className="max-w-md rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        当前 worker 离线。现在提交的任务会先进入队列，但不会继续执行；请手动启动 `run_pipeline_worker.py`。
                      </div>
                    )}
                  </div>
	                  {(isProcessing || progress > 0) && (
	                    <div className="max-w-md space-y-2">
	                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
	                        <span>
                            {activeJob?.message
                              ?? (progress === 100 ? "流水线完成" : "流水线处理中")}
                          </span>
	                        <span className="flex items-center gap-1">
	                          {activeJob?.status === "succeeded" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
	                          {displayedProgress}%
	                        </span>
	                      </div>
	                      <Progress value={displayedProgress} />
                        {activeJobId && (
                          <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                            <span>任务编号：{activeJobId}</span>
                            <Link href="/jobs" className="text-primary underline-offset-4 hover:underline">
                              查看任务历史
                            </Link>
                          </div>
                        )}
	                    </div>
	                  )}
	                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full bg-white/20 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgb(0,130,255,0.08)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-secondary/10 to-transparent pointer-events-none" />
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary/80 mb-1">Pipeline</p>
              <CardTitle className="text-2xl font-bold">本次任务会触发</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-8">
              <ul className="space-y-5">
                {pipelineModules.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-4 text-sm"
                  >
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm shrink-0 border border-slate-100 z-10">
                      <span className="text-xs font-bold text-secondary">{i + 1}</span>
                      {i < pipelineModules.length - 1 && (
                        <div className="absolute top-8 left-1/2 w-0.5 h-6 bg-slate-200 -translate-x-1/2 -z-10" />
                      )}
                    </div>
                    <span className="text-foreground font-semibold">{item}</span>
                  </motion.li>
                ))}
              </ul>
              <div className="bg-white/60 p-5 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-secondary/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                <strong className="text-sm font-bold flex items-center gap-2 mb-2 text-foreground">
                  <AlertCircle className="w-4 h-4 text-secondary" /> 结果去向
                </strong>
                <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">
                  增强、检测、OCR 和语义分析结果都会聚合写入垃圾身份证。完成后可直接在下方查看，或在后台管理页进行核对。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Card className="bg-emerald-50/40 backdrop-blur-2xl border border-emerald-200/60 shadow-[0_8px_32px_rgb(16,185,129,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

              <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-emerald-100/50 mb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Identity Output
                  </p>
                  <CardTitle className="text-3xl font-black text-foreground">垃圾身份证概览</CardTitle>
                </div>
                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-sm px-4 py-1.5 shadow-sm font-mono">
                  {result.identityId}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mb-8">
                  {[
                    { label: "具体垃圾名称", value: result.recognizedCategory ?? topDetection?.label ?? result.categories[0] ?? "待补充" },
                    { label: "专业类别", value: result.professionalCategory ?? "待补充" },
                    { label: "风险等级", value: result.volunteerRiskLevel, className: "capitalize" },
                    { label: "可能材质", value: result.materialHint || "未知" },
                    { label: "可能来源", value: result.sourceHint || "未知" },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * i }}
                      className="flex flex-col gap-2 p-5 bg-white/60 rounded-2xl border border-emerald-100/50 shadow-sm"
                    >
                      <span className="text-xs font-semibold text-emerald-700/70 uppercase tracking-wider">{stat.label}</span>
                      <strong className={cn("text-2xl font-black text-foreground", stat.className)}>{stat.value}</strong>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="flex flex-col gap-3">
                    <strong className="text-sm font-bold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-300" /> 原始图片
                    </strong>
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
                      <Image src={resolveMediaUrl(result.originalUrl)} alt="Original" fill className="object-contain" unoptimized />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <strong className="text-sm font-bold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" /> 增强与检测结果
                    </strong>
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-emerald-200 bg-emerald-50/50 shadow-inner">
                      <Image src={resolveMediaUrl(result.enhancedUrl)} alt="Enhanced" fill className="object-contain" unoptimized />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-white/60 rounded-2xl border border-emerald-100/50 shadow-sm flex flex-col gap-3">
                    <strong className="text-sm font-bold text-emerald-800 uppercase tracking-wider">OCR 线索</strong>
                    <p className="text-base text-foreground font-medium bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                      {result.ocrTexts.length ? result.ocrTexts.join(" | ") : "未检测到明显文字"}
                    </p>
                  </div>
                  <div className="p-6 bg-white/60 rounded-2xl border border-emerald-100/50 shadow-sm flex flex-col gap-3">
                    <strong className="text-sm font-bold text-emerald-800 uppercase tracking-wider">复核建议</strong>
                    <p className="text-sm leading-6 text-muted-foreground">
                      这部分不是识别结果本身，而是给审核人和治理方的下一步动作提示。
                    </p>
                    <ul className="flex flex-col gap-2">
                      {result.actionSuggestions.map((s, i) => (
                        <li key={i} className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                          <div className="flex items-start gap-3 text-sm text-foreground font-medium">
                            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{s}</span>
                          </div>
                          <p className="mt-2 pl-7 text-xs leading-5 text-muted-foreground">
                            {explainActionSuggestion(s)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
