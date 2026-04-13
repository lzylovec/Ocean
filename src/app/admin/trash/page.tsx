"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

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
  const [data, setData] = useState<TrashIdentityResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("正在加载数据库中的垃圾身份证...");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("垃圾身份证列表加载失败。");
        }

        const payload = (await response.json()) as TrashIdentityResponse;
        setData(payload);
        setSelectedId(payload.items[0]?.identityId ?? null);
        setMessage(payload.items.length ? "已加载真实数据库记录。" : "数据库中还没有记录，请先到采集页执行一次流水线。")
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "发生未知错误。");
      }
    }

    void load();
  }, []);

  async function reload() {
    const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("垃圾身份证列表加载失败。");
    }

    const payload = (await response.json()) as TrashIdentityResponse;
    setData(payload);
    setSelectedId((current) => current ?? payload.items[0]?.identityId ?? null);
  }

  async function updateStatus(nextStatus: "待复核" | "已确认" | "待补OCR") {
    if (!selected) {
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/trash-identities/${selected.identityId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reviewStatus: nextStatus }),
      });
      if (!response.ok) {
        throw new Error("更新审核状态失败。");
      }

      await reload();
      setMessage(`记录 ${selected.identityId} 已更新为 ${nextStatus}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发生未知错误。");
    } finally {
      setUpdating(false);
    }
  }

  const selected = useMemo(
    () => data?.items.find((item) => item.identityId === selectedId) ?? data?.items[0] ?? null,
    [data, selectedId],
  );

  return (
    <main className="page">
      <div className="shell page-stack">
        <header className="page-header page-header-tight">
          <p className="eyebrow">Review Workspace</p>
          <h1>垃圾身份证后台核对</h1>
          <p>这一页围绕“记录列表 + 单条详情”组织，适合实际业务复核，而不是只看一张表。</p>
        </header>

        <section className="metric-strip compact-strip">
          <article className="metric-tile compact-tile">
            <span>待复核</span>
            <strong>{data?.counts.pendingReview ?? 0}</strong>
            <p>需要人工确认的记录</p>
          </article>
          <article className="metric-tile compact-tile">
            <span>待补 OCR</span>
            <strong>{data?.counts.needsOcr ?? 0}</strong>
            <p>文字线索不足的记录</p>
          </article>
          <article className="metric-tile compact-tile">
            <span>已确认</span>
            <strong>{data?.counts.confirmed ?? 0}</strong>
            <p>已完成业务闭环确认</p>
          </article>
        </section>

        <p className="caption">{message}</p>

        <section className="review-layout">
          <article className="card list-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Identity Queue</p>
                <h2>记录队列</h2>
              </div>
            </div>
            <div className="record-list">
              {data?.items.length ? (
                data.items.map((item) => (
                  <button
                    key={item.identityId}
                    className={`record-item ${selected?.identityId === item.identityId ? "active" : ""}`}
                    onClick={() => setSelectedId(item.identityId)}
                    type="button"
                  >
                    <div className="record-item-head">
                      <strong>{item.primaryCategory}</strong>
                      <span className={`inline-badge ${item.volunteerRiskLevel === "high" ? "danger" : "info"}`}>
                        {item.volunteerRiskLevel}
                      </span>
                    </div>
                    <p>{item.siteName}</p>
                    <span>{item.identityId}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state">还没有可复核的记录。</div>
              )}
            </div>
          </article>

          <article className="card detail-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Identity Detail</p>
                <h2>{selected?.identityId ?? "暂无记录"}</h2>
              </div>
              {selected ? <span className="inline-badge success">{selected.reviewStatus}</span> : null}
            </div>

            {selected ? (
              <div className="detail-stack">
                <div className="key-grid">
                  <div className="key-metric small-metric">
                    <span>主类别</span>
                    <strong>{selected.primaryCategory}</strong>
                  </div>
                  <div className="key-metric small-metric">
                    <span>材质线索</span>
                    <strong>{selected.materialHint}</strong>
                  </div>
                  <div className="key-metric small-metric">
                    <span>来源提示</span>
                    <strong>{selected.sourceHint}</strong>
                  </div>
                  <div className="key-metric small-metric">
                    <span>最高置信度</span>
                    <strong>{selected.topConfidence.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="preview-grid">
                  <div className="preview-frame">
                    <span>原图</span>
                    <Image alt="原图" className="preview-image" height={900} src={selected.originalUrl} unoptimized width={1200} />
                  </div>
                  <div className="preview-frame">
                    <span>增强图</span>
                    <Image alt="增强图" className="preview-image" height={900} src={selected.enhancedUrl} unoptimized width={1200} />
                  </div>
                </div>

                <div className="detail-split">
                  <div className="sub-card">
                    <strong>语义摘要</strong>
                    <p>{selected.volunteerSummary}</p>
                    <div className="tag-row top-gap">
                      {selected.volunteerTags.map((item) => (
                        <span key={item} className="tag">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="sub-card">
                    <strong>OCR 线索</strong>
                    <div className="tag-row top-gap">
                      {selected.ocrTexts.length ? selected.ocrTexts.map((item) => <span key={item} className="tag">{item}</span>) : <span className="tag muted-tag">无文本</span>}
                    </div>
                    <div className="tag-row top-gap">
                      {selected.ocrKeywords.map((item) => (
                        <span key={item} className="tag subtle-tag">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sub-card">
                  <strong>审核动作</strong>
                  <div className="action-row top-gap">
                    <button className="button" disabled={updating} onClick={() => updateStatus("已确认")} type="button">
                      标记已确认
                    </button>
                    <button className="button-secondary" disabled={updating} onClick={() => updateStatus("待复核")} type="button">
                      退回待复核
                    </button>
                    <button className="button-secondary" disabled={updating} onClick={() => updateStatus("待补OCR")} type="button">
                      标记待补 OCR
                    </button>
                  </div>
                </div>

                <div className="sub-card">
                  <strong>行动建议</strong>
                  <ul className="bullet-list compact">
                    {selected.actionSuggestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="empty-state">先到采集页生成一条记录，这里会展示真实详情。</div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
