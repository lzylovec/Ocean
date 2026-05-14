const { resolveMediaUrl } = require("../../utils/config");
const { request } = require("../../utils/request");
const { CURRENT_IDENTITY_KEY, writeStorage } = require("../../utils/storage");
const { formatDateTime, shortId, toReviewMeta, toRiskMeta } = require("../../utils/format");

const reviewOptions = [
  { value: "", label: "全部" },
  { value: "待复核", label: "待复核" },
  { value: "待补文字线索", label: "待补文字线索" },
  { value: "已确认", label: "已确认" },
];

function decorateIdentity(item) {
  return {
    identityId: item.identityId,
    shortIdentityId: shortId(item.identityId, 8),
    siteName: item.siteName,
    volunteerNote: item.volunteerNote || "",
    manualTextClue: item.manualTextClue || "",
    originalUrl: resolveMediaUrl(item.originalUrl),
    enhancedUrl: resolveMediaUrl(item.enhancedUrl),
    recognizedCategory: item.recognizedCategory || "待补充",
    professionalCategory: item.professionalCategory || "待补充",
    primaryCategory: item.primaryCategory || "待补充",
    materialHint: item.materialHint || "待补充",
    sourceHint: item.sourceHint || "待补充",
    reviewMeta: toReviewMeta(item.reviewStatus),
    riskMeta: toRiskMeta(item.volunteerRiskLevel),
    volunteerSummary: item.volunteerSummary || "暂无摘要",
    volunteerTagsText: Array.isArray(item.volunteerTags) && item.volunteerTags.length
      ? item.volunteerTags.join(" / ")
      : "暂无标签",
    ocrTextsText: Array.isArray(item.ocrTexts) && item.ocrTexts.length
      ? item.ocrTexts.join("；")
      : "未识别到稳定文字",
    createdAtText: formatDateTime(item.createdAt || ""),
  };
}

Page({
  data: {
    q: "",
    reviewStatus: "",
    reviewOptions,
    loading: true,
    errorMessage: "",
    items: [],
    counts: {
      pendingReview: 0,
      needsOcr: 0,
      confirmed: 0,
    },
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData(true);
  },

  buildQuery() {
    const params = ["limit=60"];
    const q = (this.data.q || "").trim();
    if (q) {
      params.push(`q=${encodeURIComponent(q)}`);
    }
    if (this.data.reviewStatus) {
      params.push(`reviewStatus=${encodeURIComponent(this.data.reviewStatus)}`);
    }
    return params.join("&");
  },

  async loadData(fromPullDown = false) {
    this.setData({
      loading: true,
      errorMessage: "",
    });

    try {
      const response = await request({
        url: `/api/v1/trash-identities?${this.buildQuery()}`,
        fallbackErrorMessage: "垃圾身份证列表加载失败。",
      });

      this.setData({
        loading: false,
        items: Array.isArray(response.items) ? response.items.map(decorateIdentityItem) : [],
        counts: response.counts || this.data.counts,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || "垃圾身份证列表加载失败。",
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  onSearchInput(event) {
    this.setData({
      q: event.detail.value,
    });
  },

  applyFilters() {
    this.loadData();
  },

  selectReviewStatus(event) {
    const reviewStatus = event.currentTarget.dataset.status;
    this.setData({
      reviewStatus,
    });
    this.loadData();
  },

  openDetail(event) {
    const identityId = event.currentTarget.dataset.id;
    const matched = this.data.items.find((item) => item.identityId === identityId);
    if (matched) {
      writeStorage(CURRENT_IDENTITY_KEY, matched);
    }
    wx.navigateTo({
      url: `/pages/identity-detail/index?id=${identityId}`,
    });
  },
});
