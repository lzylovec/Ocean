"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [identities, setIdentities] = useState<IdentityResponse | null>(null);
  const [message, setMessage] = useState("正在加载项目工作台...");

  useEffect(() => {
    async function load() {
      try {
        const [overviewResp, identityResp] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/dashboard/overview`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/api/v1/trash-identities?limit=6`, { cache: "no-store" }),
        ]);

        if (!overviewResp.ok || !identityResp.ok) {
          throw new Error("项目数据加载失败。");
        }

        setOverview((await overviewResp.json()) as OverviewResponse);
        setIdentities((await identityResp.json()) as IdentityResponse);
        setMessage("工作台已同步后端状态。可直接从这里进入采集、核对和看板模块。");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "发生未知错误。");
      }
    }

    void load();
  }, []);

  const liveMetrics = useMemo(() => {
    const pending = identities?.counts.pendingReview ?? 0;
    const needsOcr = identities?.counts.needsOcr ?? 0;
    const confirmed = identities?.counts.confirmed ?? 0;

    return [
      { label: "待复核", value: String(pending), note: "等待人工确认的垃圾身份证" },
      { label: "待补 OCR", value: String(needsOcr), note: "需要补充文字线索的记录" },
      { label: "已确认", value: String(confirmed), note: "已经完成业务确认的记录" },
    ];
  }, [identities]);

  return (
    <main className="page">
      <div className="shell page-stack">
        <section className="workspace-hero card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Command Center</p>
              <h1>Ocean 项目工作台</h1>
            </div>
            <span className="inline-badge success">AI 流水线可用</span>
          </div>
          <p className="lead">
            当前系统已经具备图片上传、增强、检测、OCR、语义分析、垃圾身份证入库与后台核对能力。这个首页默认展示项目运行状态和待办工作，而不是路演介绍页。
          </p>
          <p className="caption">{message}</p>
          <div className="metric-strip compact-strip">
            {[...(overview?.metrics ?? []), ...liveMetrics].slice(0, 4).map((item) => (
              <article key={`${item.label}-${item.value}`} className="metric-tile compact-tile">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="two-up section-block">
          <article className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Quick Actions</p>
                <h2>直接进入业务操作</h2>
              </div>
            </div>
            <div className="entry-grid single-column-grid">
              {quickLinks.map((item) => (
                <Link key={item.href} className="entry-card compact-entry card-link-lite" href={item.href}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <span>打开模块</span>
                </Link>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Model Stack</p>
                <h2>当前运行栈</h2>
              </div>
            </div>
            <ul className="bullet-list compact">
              {stackItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="two-up section-block">
          <article className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Review Queue</p>
                <h2>待处理记录</h2>
              </div>
            </div>
            <div className="stack-cards compact-stack">
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
                    <span>{item.identityId} · {item.reviewStatus}</span>
                    <span>{item.volunteerSummary}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">当前还没有入库记录，请先从采集页生成第一条垃圾身份证。</div>
              )}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Priority Sites</p>
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
