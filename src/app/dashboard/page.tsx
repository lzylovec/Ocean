"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [identities, setIdentities] = useState<IdentityResponse | null>(null);
  const [message, setMessage] = useState("正在加载治理看板...");

  useEffect(() => {
    async function load() {
      try {
        const [overviewResp, identitiesResp] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/dashboard/overview`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/api/v1/trash-identities?limit=6`, { cache: "no-store" }),
        ]);

        if (!overviewResp.ok || !identitiesResp.ok) {
          throw new Error("看板数据加载失败。");
        }

        const overviewData = (await overviewResp.json()) as OverviewResponse;
        const identityData = (await identitiesResp.json()) as IdentityResponse;
        setOverview(overviewData);
        setIdentities(identityData);
        setMessage("已加载当前治理概览。数据库更新后刷新页面即可看到最新数据。");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "发生未知错误。");
      }
    }

    void load();
  }, []);

  const liveMetrics = useMemo(() => {
    const queue = identities?.counts.pendingReview ?? 0;
    const needsOcr = identities?.counts.needsOcr ?? 0;
    const highRisk = identities?.items.filter((item) => item.volunteerRiskLevel === "high").length ?? 0;

    return [
      { label: "待复核记录", value: String(queue), note: "来自真实垃圾身份证入库结果" },
      { label: "高风险样本", value: String(highRisk), note: "优先人工核对与复查" },
      { label: "待补 OCR", value: String(needsOcr), note: "文字线索不足的记录数量" },
    ];
  }, [identities]);

  return (
    <main className="page">
      <div className="shell page-stack">
        <header className="page-header page-header-tight">
          <p className="eyebrow">Dashboard</p>
          <h1>治理看板</h1>
          <p>看板同时展示静态治理指标和实时入库记录，方便从“模型结果”回到“业务动作”。</p>
        </header>

        <section className="dashboard-hero">
          <article className="card dashboard-highlight">
            <div className="card-head">
              <div>
                <p className="eyebrow">Live Metrics</p>
                <h2>当前治理状态</h2>
              </div>
              <span className="inline-badge info">实时读取后端接口</span>
            </div>
            <div className="metric-strip compact-strip">
              {[...(overview?.metrics ?? []), ...liveMetrics].slice(0, 4).map((item) => (
                <article key={`${item.label}-${item.value}`} className="metric-tile compact-tile">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
            <p className="caption">{message}</p>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Model Status</p>
                <h2>运行中的 AI 组件</h2>
              </div>
            </div>
            <ul className="bullet-list compact">
              {modelStatus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="two-up section-block">
          <article className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Recent Identities</p>
                <h2>最近入库记录</h2>
              </div>
            </div>
            <div className="stack-cards">
              {identities?.items.length ? (
                identities.items.map((item) => (
                  <div key={item.identityId} className="sub-card list-item-card">
                    <div className="list-item-head">
                      <strong>{item.primaryCategory}</strong>
                      <span className={`inline-badge ${item.volunteerRiskLevel === "high" ? "danger" : "info"}`}>
                        {item.volunteerRiskLevel}
                      </span>
                    </div>
                    <p>{item.siteName}</p>
                    <span>{item.volunteerSummary}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">还没有入库记录，请先到采集页执行一次流水线。</div>
              )}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Hotspot Overview</p>
                <h2>重点潜点</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>潜点</th>
                    <th>主垃圾类型</th>
                    <th>风险</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.topSites ?? []).map((site) => (
                    <tr key={site.name}>
                      <td>{site.name}</td>
                      <td>{site.topCategory}</td>
                      <td>{site.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
