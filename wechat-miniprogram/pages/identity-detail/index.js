const { resolveMediaUrl } = require("../../utils/config");
const { request } = require("../../utils/request");
const { createImageAsset, preloadImage } = require("../../utils/image");
const { CURRENT_IDENTITY_KEY, readStorage, writeStorage } = require("../../utils/storage");
const {
  formatDateTime,
  shortId,
  toActionSuggestionHint,
  toReviewMeta,
  toRiskMeta,
} = require("../../utils/format");

function decorateIdentity(item) {
  if (!item) {
    return null;
  }

  return {
    identityId: item.identityId,
    shortIdentityId: shortId(item.identityId, 8),
    siteName: item.siteName,
    volunteerNote: item.volunteerNote || "",
    manualTextClue: item.manualTextClue || "",
    originalUrl: resolveMediaUrl(item.originalUrl),
    enhancedUrl: resolveMediaUrl(item.enhancedUrl),
    originalImage: createImageAsset(resolveMediaUrl(item.originalUrl)),
    enhancedImage: createImageAsset(resolveMediaUrl(item.enhancedUrl)),
    recognizedCategory: item.recognizedCategory || "待补充",
    professionalCategory: item.professionalCategory || "待补充",
    primaryCategory: item.primaryCategory || "待补充",
    materialHint: item.materialHint || "待补充",
    sourceHint: item.sourceHint || "待补充",
    reviewMeta: toReviewMeta(item.reviewStatus),
    riskMeta: toRiskMeta(item.volunteerRiskLevel),
    categoriesText: Array.isArray(item.categories) && item.categories.length
      ? item.categories.join(" / ")
      : "暂无分类信息",
    volunteerTagsText: Array.isArray(item.volunteerTags) && item.volunteerTags.length
      ? item.volunteerTags.join(" / ")
      : "暂无标签",
    ocrTextsText: Array.isArray(item.ocrTexts) && item.ocrTexts.length
      ? item.ocrTexts.join("；")
      : "未识别到稳定文字",
    ocrKeywordsText: Array.isArray(item.ocrKeywords) && item.ocrKeywords.length
      ? item.ocrKeywords.join(" / ")
      : "暂无 OCR 关键词",
    actionSuggestions: Array.isArray(item.actionSuggestions)
      ? item.actionSuggestions.map((entry) => ({
          text: entry,
          hint: toActionSuggestionHint(entry),
        }))
      : [],
    volunteerSummary: item.volunteerSummary || "暂无摘要",
    createdAtText: formatDateTime(item.createdAt || ""),
  };
}

Page({
  data: {
    identityId: "",
    loading: true,
    errorMessage: "",
    identity: null,
    manualTextClueDraft: "",
  },

  onLoad(options) {
    const identityId = options.id || "";
    const storedIdentity = readStorage(CURRENT_IDENTITY_KEY, null);
    const decoratedStoredIdentity =
      storedIdentity && storedIdentity.identityId === identityId
        ? decorateIdentity(storedIdentity)
        : null;

    this.setData({
      identityId,
      identity: decoratedStoredIdentity,
      manualTextClueDraft: decoratedStoredIdentity ? decoratedStoredIdentity.manualTextClue : "",
    });
  },

  onShow() {
    if (this.data.identityId) {
      this.loadIdentity();
    }
  },

  onPullDownRefresh() {
    this.loadIdentity(true);
  },

  async loadIdentity(fromPullDown = false) {
    this.setData({
      loading: true,
      errorMessage: "",
    });

    try {
      const response = await request({
        url: `/api/v1/trash-identities?limit=20&q=${encodeURIComponent(this.data.identityId)}`,
        fallbackErrorMessage: "垃圾身份证详情加载失败。",
      });
      const match = Array.isArray(response.items)
        ? response.items.find((item) => item.identityId === this.data.identityId)
        : null;
      if (!match) {
        throw new Error("未找到对应的垃圾身份证记录。");
      }

      const identity = decorateIdentity(match);
      await this.hydrateIdentityImages(identity);
      writeStorage(CURRENT_IDENTITY_KEY, identity);
      this.setData({
        loading: false,
        identity,
        manualTextClueDraft: identity.manualTextClue || "",
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || "垃圾身份证详情加载失败。",
      });
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async hydrateIdentityImages(identity) {
    if (!identity) {
      return;
    }

    const [originalImage, enhancedImage] = await Promise.all([
      preloadImage(identity.originalUrl),
      preloadImage(identity.enhancedUrl),
    ]);

    identity.originalImage = originalImage;
    identity.enhancedImage = enhancedImage;
  },

  previewImage(event) {
    const currentUrl = event.currentTarget.dataset.url;
    if (!currentUrl) {
      return;
    }
    wx.previewImage({
      current: currentUrl,
      urls: [currentUrl],
    });
  },

  onManualTextInput(event) {
    this.setData({
      manualTextClueDraft: event.detail.value,
    });
  },

  async saveManualText() {
    await this.updateReviewPayload();
  },

  async updateReviewStatus(event) {
    const status = event.currentTarget.dataset.status;
    await this.updateReviewPayload(status);
  },

  async updateReviewPayload(status) {
    try {
      const payload = {};
      const manualTextClue = (this.data.manualTextClueDraft || "").trim();

      if (status) {
        payload.reviewStatus = status;
      }
      payload.manualTextClue = manualTextClue;

      await request({
        url: `/api/v1/trash-identities/${this.data.identityId}`,
        method: "PATCH",
        data: payload,
        fallbackErrorMessage: "审核状态更新失败。",
      });

      wx.showToast({
        title: status ? "审核状态已更新" : "文字线索已保存",
        icon: "success",
      });
      this.loadIdentity();
    } catch (error) {
      wx.showToast({
        title: error.message || "更新失败",
        icon: "none",
      });
    }
  },
});
