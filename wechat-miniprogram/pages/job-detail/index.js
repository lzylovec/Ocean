const { resolveMediaUrl } = require("../../utils/config");
const { request } = require("../../utils/request");
const { createImageAsset, preloadImage } = require("../../utils/image");
const {
  clampPercent,
  formatDateTime,
  shortId,
  toActionSuggestionHint,
  toJobStageLabel,
  toJobStatusMeta,
  toRiskMeta,
} = require("../../utils/format");

function decorateResult(result) {
  if (!result) {
    return null;
  }
  return {
    identityId: result.identityId,
    shortIdentityId: shortId(result.identityId, 8),
    originalUrl: resolveMediaUrl(result.originalUrl),
    enhancedUrl: resolveMediaUrl(result.enhancedUrl),
    originalImage: createImageAsset(resolveMediaUrl(result.originalUrl)),
    enhancedImage: createImageAsset(resolveMediaUrl(result.enhancedUrl)),
    recognizedCategory: result.recognizedCategory || "待补充",
    professionalCategory: result.professionalCategory || "待补充",
    sourceHint: result.sourceHint || "待补充",
    categoriesText: Array.isArray(result.categories) && result.categories.length
      ? result.categories.join(" / ")
      : "未识别到稳定类别",
    ocrTextsText: Array.isArray(result.ocrTexts) && result.ocrTexts.length
      ? result.ocrTexts.join("；")
      : "未识别到稳定文字",
    volunteerSummary: result.volunteerSummary || "暂无摘要",
    riskMeta: toRiskMeta(result.volunteerRiskLevel),
    actionSuggestions: Array.isArray(result.actionSuggestions)
      ? result.actionSuggestions.map((item) => ({
          text: item,
          hint: toActionSuggestionHint(item),
        }))
      : [],
  };
}

function decorateJob(job) {
  return {
    jobId: job.jobId,
    shortJobId: shortId(job.jobId, 8),
    status: job.status,
    statusMeta: toJobStatusMeta(job.status),
    stageLabel: toJobStageLabel(job.stage),
    progress: clampPercent(job.progress),
    message: job.message || "任务处理中",
    retryCount: job.retryCount || 0,
    cacheHitCount: job.cacheHitCount || 0,
    inflightReuseCount: job.inflightReuseCount || 0,
    errorDetail: job.errorDetail || "",
    identityId: job.identityId || "",
    createdAtText: formatDateTime(job.createdAt || ""),
    updatedAtText: formatDateTime(job.updatedAt || ""),
    startedAtText: formatDateTime(job.startedAt || ""),
    finishedAtText: formatDateTime(job.finishedAt || ""),
    result: decorateResult(job.result),
  };
}

Page({
  data: {
    jobId: "",
    loading: true,
    errorMessage: "",
    job: null,
  },

  onLoad(options) {
    this.setData({
      jobId: options.id || options.jobId || "",
    });
  },

  onShow() {
    if (this.data.jobId) {
      this.loadJob();
    }
  },

  onHide() {
    this.clearPolling();
  },

  onUnload() {
    this.clearPolling();
  },

  onPullDownRefresh() {
    this.loadJob(true);
  },

  clearPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  },

  schedulePolling(status) {
    this.clearPolling();
    if (status !== "queued" && status !== "running") {
      return;
    }
    this.pollTimer = setTimeout(() => {
      this.loadJob(false, true);
    }, 1200);
  },

  async loadJob(fromPullDown = false, silent = false) {
    if (!silent) {
      this.setData({
        loading: true,
        errorMessage: "",
      });
    }

    try {
      const response = await request({
        url: `/api/v1/ai/pipeline/${this.data.jobId}`,
        fallbackErrorMessage: "任务详情加载失败。",
      });

      const job = decorateJob(response);
      await this.hydrateJobImages(job);
      this.setData({
        loading: false,
        job,
      });
      this.schedulePolling(job.status);
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || "任务详情加载失败。",
      });
      this.schedulePolling("");
    } finally {
      if (fromPullDown) {
        wx.stopPullDownRefresh();
      }
    }
  },

  async hydrateJobImages(job) {
    if (!job || !job.result) {
      return;
    }

    const [originalImage, enhancedImage] = await Promise.all([
      preloadImage(job.result.originalUrl),
      preloadImage(job.result.enhancedUrl),
    ]);

    job.result.originalImage = originalImage;
    job.result.enhancedImage = enhancedImage;
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

  openIdentityDetail() {
    const identityId = this.data.job && this.data.job.identityId;
    if (!identityId) {
      return;
    }
    wx.navigateTo({
      url: `/pages/identity-detail/index?id=${identityId}`,
    });
  },

  async retryJob() {
    try {
      await request({
        url: `/api/v1/ai/pipeline/${this.data.jobId}/retry`,
        method: "POST",
        fallbackErrorMessage: "任务重试失败。",
      });
      wx.showToast({
        title: "任务已重新入队",
        icon: "success",
      });
      this.loadJob();
    } catch (error) {
      wx.showToast({
        title: error.message || "任务重试失败",
        icon: "none",
      });
    }
  },

  async cancelJob() {
    try {
      await request({
        url: `/api/v1/ai/pipeline/${this.data.jobId}/cancel`,
        method: "POST",
        fallbackErrorMessage: "任务取消失败。",
      });
      wx.showToast({
        title: "任务已取消",
        icon: "success",
      });
      this.loadJob();
    } catch (error) {
      wx.showToast({
        title: error.message || "任务取消失败",
        icon: "none",
      });
    }
  },
});
