const { request } = require("../../utils/request");
const { shortId, toReviewMeta, toRiskMeta } = require("../../utils/format");

const modelStatus = [
  "增强：NAFNet 本地推理",
  "检测：DAMO-YOLO ONNX 本地执行",
  "OCR：检测 + 识别双阶段",
  "语义：Qwen 云端推理",
];

function buildMetricCards(overviewMetrics, counts, items) {
  const highRiskCount = Array.isArray(items)
    ? items.filter((item) => item.volunteerRiskLevel === "high").length
    : 0;

  if (Array.isArray(overviewMetrics) && overviewMetrics.length) {
    return overviewMetrics.slice(0, 4);
  }

  return [
    {
      label: "待复核记录",
      value: String(counts.pendingReview || 0),
      note: "等待人工确认的真实入库结果",
    },
    {
      label: "高风险样本",
      value: String(highRiskCount),
      note: "优先移动端核对和线下复查",
    },
    {
      label: "待补文字线索",
      value: String(counts.needsOcr || 0),
      note: "说明 OCR 或人工文本证据仍然不足",
    },
    {
      label: "已确认",
      value: String(counts.confirmed || 0),
      note: "已经完成业务确认的记录",
    },
  ];
}

function buildCountBars(counts) {
  const list = [
    { label: "待复核", value: counts.pendingReview || 0, className: "bar-fill bar-fill-primary" },
    { label: "待补文字线索", value: counts.needsOcr || 0, className: "bar-fill bar-fill-warning" },
    { label: "已确认", value: counts.confirmed || 0, className: "bar-fill bar-fill-success" },
  ];
  const total = list.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;

  return list.map((item) => ({
    label: item.label,
    value: item.value,
    percent: Math.max(8, Math.round((item.value / total) * 100)),
    className: item.className,
  }));
}

function decorateIdentityItem(item) {
  return {
    identityId: item.identityId,
    shortIdentityId: shortId(item.identityId, 6),
    siteName: item.siteName,
    recognizedCategory: item.recognizedCategory,
    professionalCategory: item.professionalCategory,
    volunteerSummary: item.volunteerSummary,
    reviewMeta: toReviewMeta(item.reviewStatus),
    riskMeta: toRiskMeta(item.volunteerRiskLevel),
  };
}

Page({
  data: {
    loading: true,
    errorMessage: "",
    metrics: [],
    countBars: [],
    topSites: [],
    recentIdentities: [],
    modelStatus,
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData(true);
  },

  async loadData(fromPullDown = false) {
    this.setData({
      loading: true,
      errorMessage: "",
    });

    try {
      const [overview, identities] = await Promise.all([
        request({
          url: "/api/v1/dashboard/overview",
          fallbackErrorMessage: "治理看板概览加载失败。",
        }),
        request({
          url: "/api/v1/trash-identities?limit=6",
          fallbackErrorMessage: "入库记录加载失败。",
        }),
      ]);

      const counts = identities && identities.counts ? identities.counts : {};
      const items = identities && Array.isArray(identities.items) ? identities.items : [];

      this.setData({
        loading: false,
        metrics: buildMetricCards(overview ? overview.metrics : [], counts, items),
        countBars: buildCountBars(counts),
        topSites: overview && Array.isArray(overview.topSites) ? overview.topSites.slice(0, 5) : [],
        recentIdentities: items.map(decorateIdentityItem),
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || "治理看板加载失败。",
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },
});
