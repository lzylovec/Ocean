const { request } = require("../../utils/request");
const { CURRENT_IDENTITY_KEY, writeStorage } = require("../../utils/storage");
const { shortId, toReviewMeta, toRiskMeta, toWorkerMeta } = require("../../utils/format");

const quickActions = [
  {
    title: "新建采集任务",
    description: "上传图片并触发完整 AI 流水线",
    pagePath: "/pages/collect/index",
  },
  {
    title: "查看任务历史",
    description: "追踪队列、进度、取消和重试",
    pagePath: "/pages/jobs/index",
  },
  {
    title: "打开治理看板",
    description: "查看指标、潜点风险和最近入库记录",
    pagePath: "/pages/dashboard/index",
  },
  {
    title: "进入移动复核",
    description: "查看垃圾身份证并更新审核状态",
    pagePath: "/pages/identities/index",
  },
];

const stackItems = [
  "增强：NAFNet 本地推理",
  "检测：DAMO-YOLO ONNX 本地执行",
  "OCR：检测 + 识别双阶段",
  "语义：Qwen 云端推理",
];

function buildMetricCards(overviewMetrics, counts) {
  const fallbackMetrics = [
    {
      label: "待复核",
      value: String(counts.pendingReview || 0),
      note: "等待人工确认的真实记录",
    },
    {
      label: "待补文字线索",
      value: String(counts.needsOcr || 0),
      note: "仍需补充 OCR 或人工文字线索",
    },
    {
      label: "已确认",
      value: String(counts.confirmed || 0),
      note: "已经完成业务复核的记录",
    },
    {
      label: "移动端链路",
      value: "已接通",
      note: "上传、轮询、看板、复核都可在小程序操作",
    },
  ];

  if (!Array.isArray(overviewMetrics) || overviewMetrics.length === 0) {
    return fallbackMetrics;
  }

  return overviewMetrics.slice(0, 4).map((item) => ({
    label: item.label,
    value: item.value,
    note: item.note,
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
    quickActions,
    stackItems,
    workerMeta: toWorkerMeta(null),
    systemAlert: "",
    metrics: [],
    topSites: [],
    recentIdentities: [],
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
      const [health, overview, identities] = await Promise.all([
        request({
          url: "/api/v1/health",
          fallbackErrorMessage: "健康状态加载失败。",
        }),
        request({
          url: "/api/v1/dashboard/overview",
          fallbackErrorMessage: "治理看板概览加载失败。",
        }),
        request({
          url: "/api/v1/trash-identities?limit=4",
          fallbackErrorMessage: "最近入库记录加载失败。",
        }),
      ]);

      const counts = identities && identities.counts ? identities.counts : {};
      const systemAlert =
        health && health.database === "error"
          ? health.databaseMessage || "数据库状态异常，请检查后端。"
          : "";

      this.setData({
        loading: false,
        workerMeta: toWorkerMeta(health ? health.worker : null),
        systemAlert,
        metrics: buildMetricCards(overview ? overview.metrics : [], counts),
        topSites: (overview && Array.isArray(overview.topSites) ? overview.topSites : []).slice(0, 4),
        recentIdentities: (identities && Array.isArray(identities.items) ? identities.items : []).map(decorateIdentityItem),
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || "首页数据加载失败。",
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  openTab(event) {
    const pagePath = event.currentTarget.dataset.path;
    wx.switchTab({ url: pagePath });
  },

  openIdentityDetail(event) {
    const identityId = event.currentTarget.dataset.id;
    const matchedItem = this.data.recentIdentities.find((item) => item.identityId === identityId);
    if (matchedItem) {
      writeStorage(CURRENT_IDENTITY_KEY, matchedItem);
    }
    wx.navigateTo({
      url: `/pages/identity-detail/index?id=${identityId}`,
    });
  },
});
