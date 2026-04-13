"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

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

export default function CollectPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [siteName, setSiteName] = useState("深圳湾东潜点");
  const [volunteerNote, setVolunteerNote] = useState("能见度差，发现塑料包装和疑似废弃渔具。");
  const [statusMessage, setStatusMessage] = useState("等待提交采集任务。");
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const topDetection = useMemo(() => {
    if (!result?.detections.length) {
      return null;
    }
    return [...result.detections].sort((a, b) => b.confidence - a.confidence)[0];
  }, [result]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setStatusMessage("请先选择一张水下图片。 ");
      return;
    }

    setSubmitting(true);
    setStatusMessage("正在上传图片并执行 AI 流水线...");
    setResult(null);

    try {
      const uploadForm = new FormData();
      uploadForm.append("file", selectedFile);

      const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/media/upload`, {
        method: "POST",
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        throw new Error("图片上传失败，请确认后端服务已启动。");
      }

      const uploadData = (await uploadResponse.json()) as { publicUrl: string; storedPath: string };

      const pipelineResponse = await fetch(`${API_BASE_URL}/api/v1/ai/pipeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaPath: uploadData.storedPath,
          mediaUrl: uploadData.publicUrl,
          siteName,
          volunteerNote,
        }),
      });

      if (!pipelineResponse.ok) {
        throw new Error("AI 流水线执行失败，请检查后端日志。");
      }

      const pipelineData = (await pipelineResponse.json()) as PipelineResponse;
      setResult(pipelineData);
      setStatusMessage(`任务完成，垃圾身份证 ${pipelineData.identityId} 已写入数据库。`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "发生未知错误。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="shell page-stack">
        <header className="page-header page-header-tight">
          <p className="eyebrow">Collection Workspace</p>
          <h1>现场采集工作台</h1>
          <p>这个页面面向真实操作流程，左侧录入采集任务，右侧展示运行说明，提交后下方直接展示结构化结果而不是原始 JSON。</p>
        </header>

        <section className="workspace-layout">
          <form className="card workspace-card" onSubmit={handleSubmit}>
            <div className="card-head">
              <div>
                <p className="eyebrow">Task Input</p>
                <h2>提交采集任务</h2>
              </div>
              <span className="inline-badge info">会自动写入垃圾身份证</span>
            </div>

            <div className="form-grid">
              <label className="form-label">
                <span>水下图片</span>
                <input
                  className="file-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <small className="field-note">{selectedFile ? `已选择：${selectedFile.name}` : "建议上传现场原图，系统会自动生成增强图。"}</small>
              </label>

              <div className="dual-grid">
                <label className="form-label">
                  <span>潜点名称</span>
                  <input className="field" value={siteName} onChange={(event) => setSiteName(event.target.value)} />
                </label>
                <div className="mini-card">
                  <strong>当前执行链路</strong>
                  <p>上传后自动执行增强、检测、OCR、语义分析和入库。</p>
                </div>
              </div>

              <label className="form-label">
                <span>志愿者反馈</span>
                <textarea className="textarea" value={volunteerNote} onChange={(event) => setVolunteerNote(event.target.value)} />
              </label>
            </div>

            <div className="action-row">
              <button className="button" disabled={submitting} type="submit">
                {submitting ? "正在处理..." : "执行 AI 流水线"}
              </button>
              <span className="helper-text">{statusMessage}</span>
            </div>
          </form>

          <aside className="card side-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Pipeline</p>
                <h2>本次任务会触发</h2>
              </div>
            </div>
            <ul className="bullet-list compact">
              {pipelineModules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="sub-card">
              <strong>结果去向</strong>
              <p>增强、检测、OCR 和语义分析都会一起写入垃圾身份证，后台页可直接查看。</p>
            </div>
          </aside>
        </section>

        <section className="result-grid">
          <article className="card result-card wide-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Identity Output</p>
                <h2>垃圾身份证概览</h2>
              </div>
              {result ? <span className="inline-badge success">{result.identityId}</span> : null}
            </div>

            {result ? (
              <div className="identity-grid">
                <div className="key-metric">
                  <span>主类别</span>
                  <strong>{topDetection?.label ?? result.categories[0] ?? "待补充"}</strong>
                </div>
                <div className="key-metric">
                  <span>最高置信度</span>
                  <strong>{topDetection ? topDetection.confidence.toFixed(2) : "0.00"}</strong>
                </div>
                <div className="key-metric">
                  <span>来源提示</span>
                  <strong>{result.sourceHint}</strong>
                </div>
                <div className="key-metric">
                  <span>风险等级</span>
                  <strong>{result.volunteerRiskLevel}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-state">提交任务后，这里会显示垃圾身份证的核心字段。</div>
            )}
          </article>

          <article className="card result-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Image Compare</p>
                <h2>图像比对</h2>
              </div>
            </div>
            {result ? (
              <div className="preview-grid">
                <div className="preview-frame">
                  <span>原图</span>
                  <Image alt="原图" className="preview-image" height={900} src={result.originalUrl} unoptimized width={1200} />
                </div>
                <div className="preview-frame">
                  <span>增强图</span>
                  <Image alt="增强图" className="preview-image" height={900} src={result.enhancedUrl} unoptimized width={1200} />
                </div>
              </div>
            ) : (
              <div className="empty-state">执行后会在这里显示原图和增强图。</div>
            )}
          </article>

          <article className="card result-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Detection</p>
                <h2>检测结果</h2>
              </div>
            </div>
            {result?.detections.length ? (
              <div className="stack-cards compact-stack">
                {result.detections.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="sub-card list-item-card">
                    <div className="list-item-head">
                      <strong>{item.label}</strong>
                      <span className="inline-badge info">{item.confidence.toFixed(2)}</span>
                    </div>
                    <span>
                      bbox: [{item.bbox.join(", ")}]
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">暂无检测结果。</div>
            )}
          </article>

          <article className="card result-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">OCR</p>
                <h2>文字线索</h2>
              </div>
            </div>
            {result ? (
              <>
                <div className="tag-row">
                  {result.ocrTexts.length ? result.ocrTexts.map((item) => <span key={item} className="tag">{item}</span>) : <span className="tag muted-tag">未识别到文本</span>}
                </div>
                <div className="tag-row top-gap">
                  {result.ocrKeywords.map((item) => (
                    <span key={item} className="tag subtle-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">这里会显示 OCR 文本和关键词。</div>
            )}
          </article>

          <article className="card result-card wide-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Semantic Output</p>
                <h2>志愿者反馈语义分析</h2>
              </div>
            </div>
            {result ? (
              <div className="semantic-layout">
                <div>
                  <p className="semantic-summary">{result.volunteerSummary}</p>
                  <div className="tag-row">
                    {result.volunteerTags.map((item) => (
                      <span key={item} className="tag">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="sub-card">
                  <strong>行动建议</strong>
                  <ul className="bullet-list compact">
                    {result.actionSuggestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="empty-state">这里会显示语义标签、摘要和治理建议。</div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
