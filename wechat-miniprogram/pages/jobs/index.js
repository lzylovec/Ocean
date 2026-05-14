const { request } = require("../../utils/request");
const {
  clampPercent,
  formatDateTime,
  shortId,
  toJobStageLabel,
  toJobStatusMeta,
  toReuseLabel,
  toWorkerMeta,
} = require("../../utils/format");

const statusOptions = [
  { value: "", label: "全部" },
  { value: "queued", label: "排队中" },
  { value: "running", label: "执行中" },
  { value: "succeeded", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "canceled", label: "已取消" },
];

function decorateJobItem(item) {
  return {
    jobId: item.jobId,
    shortJobId: shortId(item.jobId, 8),
    status: item.status,
    statusMeta: toJobStatusMeta(item.status),
    stageLabel: toJobStageLabel(item.stage),
    progress: clampPercent(item.progress),
    message: item.message || "任务处理中",
    retryCount: item.retryCount || 0,
    reuseLabel: toReuseLabel(item.lastReuseReason),
    siteName: item.siteName || "未填写潜点",
    recognizedCategory: item.recognizedCategory || "待补充",
    professionalCategory: item.professionalCategory || "待补充",
    updatedAtText: formatDateTime(item.updatedAt || ""),
    finishedAtText: formatDateTime(item.finishedAt || ""),
    errorDetail: item.errorDetail || "",
  };
}

Page({
  data: {
    q: "",
    status: "",
    statusOptions,
    page: 1,
    pageSize: 10,
    loading: true,
    errorMessage: "",
    items: [],
    counts: {
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      canceled: 0,
    },
    pagination: {
      page: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
    monitoring: null,
    workerMeta: toWorkerMeta(null),
  },

  onShow() {
    this.loadJobs({ resetPage: true });
  },

  onHide() {
    this.clearPolling();
  },

  onUnload() {
    this.clearPolling();
  },

  onPullDownRefresh() {
    this.loadJobs({ resetPage: true, fromPullDown: true });
  },

  buildQuery(page) {
    const params = [`page=${page}`, `pageSize=${this.data.pageSize}`];
    const q = (this.data.q || "").trim();
    if (q) {
      params.push(`q=${encodeURIComponent(q)}`);
    }
    if (this.data.status) {
      params.push(`status=${encodeURIComponent(this.data.status)}`);
    }
    return params.join("&");
  },

  schedulePolling(shouldPoll) {
    this.clearPolling();
    if (!shouldPoll) {
      return;
    }
    this.pollTimer = setTimeout(() => {
      this.loadJobs({ silent: true });
    }, 2500);
  },

  clearPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  },

  async loadJobs(options = {}) {
    const {
      resetPage = false,
      pageOverride,
      silent = false,
      fromPullDown = false,
    } = options;

    const targetPage = pageOverride || (resetPage ? 1 : this.data.page);
    if (!silent) {
      this.setData({
        loading: true,
        errorMessage: "",
      });
    }

    try {
      const response = await request({
        url: `/api/v1/ai/pipeline-jobs?${this.buildQuery(targetPage)}`,
        fallbackErrorMessage: "任务历史加载失败。",
      });

      const nextItems = Array.isArray(response.items) ? response.items.map(decorateJobItem) : [];
      const counts = response.counts || this.data.counts;
      const monitoring = response.monitoring || null;
      const shouldPoll = Boolean(
        counts && ((counts.queued || 0) > 0 || (counts.running || 0) > 0)
      );

      this.setData({
        loading: false,
        page: targetPage,
        items: nextItems,
        counts,
        pagination: response.pagination || this.data.pagination,
        monitoring,
        workerMeta: toWorkerMeta(monitoring),
      });

      this.schedulePolling(shouldPoll);
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || "任务历史加载失败。",
      });
      this.schedulePolling(false);
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
    this.loadJobs({ resetPage: true });
  },

  refreshList() {
    this.loadJobs({ resetPage: true });
  },

  selectStatus(event) {
    const status = event.currentTarget.dataset.status;
    this.setData({
      status,
    });
    this.loadJobs({ resetPage: true });
  },

  loadMore() {
    if (this.data.loading || !this.data.pagination.hasNext) {
      return;
    }
    this.loadJobs({
      pageOverride: this.data.page + 1,
    });
  },

  loadPrev() {
    if (this.data.loading || !this.data.pagination.hasPrev || this.data.page <= 1) {
      return;
    }
    this.loadJobs({
      pageOverride: this.data.page - 1,
    });
  },

  openDetail(event) {
    const jobId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/job-detail/index?id=${jobId}`,
    });
  },

  async retryJob(event) {
    const jobId = event.currentTarget.dataset.id;
    try {
      await request({
        url: `/api/v1/ai/pipeline/${jobId}/retry`,
        method: "POST",
        fallbackErrorMessage: "任务重试失败。",
      });
      wx.showToast({
        title: "任务已重新入队",
        icon: "success",
      });
      this.loadJobs({ resetPage: true });
    } catch (error) {
      wx.showToast({
        title: error.message || "任务重试失败",
        icon: "none",
      });
    }
  },

  async cancelJob(event) {
    const jobId = event.currentTarget.dataset.id;
    try {
      await request({
        url: `/api/v1/ai/pipeline/${jobId}/cancel`,
        method: "POST",
        fallbackErrorMessage: "任务取消失败。",
      });
      wx.showToast({
        title: "任务已取消",
        icon: "success",
      });
      this.loadJobs({ resetPage: true });
    } catch (error) {
      wx.showToast({
        title: error.message || "任务取消失败",
        icon: "none",
      });
    }
  },
});
