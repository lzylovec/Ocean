"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siteName: "深圳湾东潜点",
      volunteerNote: "能见度差，发现塑料包装和疑似废弃渔具。",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!selectedFile) throw new Error("请先选择一张水下图片。");

      setProgress(20);
      const uploadForm = new FormData();
      uploadForm.append("file", selectedFile);

      const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/media/upload`, {
        method: "POST",
        body: uploadForm,
      });

      if (!uploadResponse.ok) throw new Error("图片上传失败，请确认后端服务已启动。");
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

      if (!pipelineResponse.ok) throw new Error("AI 流水线执行失败，请检查后端日志。");
      setProgress(100);
      return (await pipelineResponse.json()) as PipelineResponse;
    },
    onSuccess: (data) => {
      toast.success(`任务完成，垃圾身份证 ${data.identityId} 已写入数据库。`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setProgress(0);
    },
  });

  const result = uploadMutation.data;
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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collection Workspace</p>
        <h1 className="text-3xl font-extrabold tracking-tight">现场采集工作台</h1>
        <p className="text-muted-foreground">录入采集任务，系统将自动触发增强、检测、OCR、语义分析并生成垃圾身份证。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Task Input</p>
                <CardTitle className="text-xl">提交采集任务</CardTitle>
              </div>
              <Badge variant="secondary">自动写入垃圾身份证</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <FormLabel>水下图片</FormLabel>
                    <div className="flex items-center justify-center w-full">
                      <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors border-slate-200">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="mb-1 text-sm text-muted-foreground">
                            <span className="font-semibold text-primary">点击上传</span> 或拖拽文件到此处
                          </p>
                          <p className="text-xs text-muted-foreground">建议上传现场原图，系统会自动生成增强图</p>
                        </div>
                        <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                    {selectedFile && (
                      <p className="text-sm text-emerald-600 flex items-center gap-1 mt-2 font-medium">
                        <CheckCircle2 className="w-4 h-4" /> 已选择: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>潜点名称</FormLabel>
                        <FormControl>
                          <Input placeholder="输入潜点名称" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="volunteerNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>志愿者反馈</FormLabel>
                        <FormControl>
                          <Textarea placeholder="描述现场情况、发现的垃圾特征等" className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {uploadMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>正在执行 AI 流水线...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <Button type="submit" disabled={uploadMutation.isPending} className="w-full sm:w-auto">
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在处理
                    </>
                  ) : (
                    "执行 AI 流水线"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Pipeline</p>
            <CardTitle className="text-xl">本次任务会触发</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ul className="space-y-3">
              {pipelineModules.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <strong className="text-sm font-semibold flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-secondary" /> 结果去向
              </strong>
              <p className="text-xs text-muted-foreground leading-relaxed">
                增强、检测、OCR 和语义分析结果都会聚合写入垃圾身份证。完成后可直接在下方查看，或在后台管理页进行核对。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Identity Output</p>
              <CardTitle className="text-xl">垃圾身份证概览</CardTitle>
            </div>
            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">{result.identityId}</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="flex flex-col gap-1 p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-xs text-muted-foreground">主类别</span>
                <strong className="text-lg font-bold text-foreground">{topDetection?.label ?? result.categories[0] ?? "待补充"}</strong>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-xs text-muted-foreground">风险等级</span>
                <strong className="text-lg font-bold text-foreground capitalize">{result.volunteerRiskLevel}</strong>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-xs text-muted-foreground">可能材质</span>
                <strong className="text-lg font-bold text-foreground">{result.materialHint || "未知"}</strong>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-white rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-xs text-muted-foreground">可能来源</span>
                <strong className="text-lg font-bold text-foreground">{result.sourceHint || "未知"}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <strong className="text-sm">原始图片</strong>
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-black/5">
                  <Image src={`${API_BASE_URL}${result.originalUrl}`} alt="Original" fill className="object-contain" unoptimized />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <strong className="text-sm">增强与检测结果</strong>
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border bg-black/5">
                  <Image src={`${API_BASE_URL}${result.enhancedUrl}`} alt="Enhanced" fill className="object-contain" unoptimized />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-4 bg-white rounded-xl border">
                <strong className="text-sm block mb-2">OCR 线索</strong>
                <p className="text-sm text-muted-foreground">{result.ocrTexts.length ? result.ocrTexts.join(" | ") : "未检测到明显文字"}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border">
                <strong className="text-sm block mb-2">语义建议</strong>
                <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                  {result.actionSuggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
