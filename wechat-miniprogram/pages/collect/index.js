const { resolveMediaUrl } = require("../../utils/config");
const { request, uploadImage } = require("../../utils/request");
const { createImageAsset, preloadImage } = require("../../utils/image");
const {
  ACTIVE_JOB_ID_KEY,
  LAST_RESULT_KEY,
  readStorage,
  removeStorage,
  writeStorage,
} = require("../../utils/storage");
const {
  clampPercent,
  formatDateTime,
  shortId,
  toActionSuggestionHint,
  toJobStageLabel,
  toJobStatusMeta,
  toRiskMeta,
  toWorkerMeta,
} = require("../../utils/format");

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSION_PATTERN = /\.(jpg|jpeg|png|webp)$/i;
const pipelineModules = [
  "图像增强：NAFNet",
  "目标检测：DAMO-YOLO",
  "OCR：检测 + 识别",
  "语义分析：Qwen",
];

function decoratePipelineResult(result) {
  if (!result) {
    return null;
  }

  const actionSuggestions = Array.isArray(result.actionSuggestions)
    ? result.actionSuggestions.map((item) => ({
        text: item,
        hint: toActionSuggestionHint(item),
      }))
    : [];

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
    ocrKeywordsText: Array.isArray(result.ocrKeywords) && result.ocrKeywords.length
      ? result.ocrKeywords.join(" / ")
      : "暂无关键词",
    volunteerTagsText: Array.isArray(result.volunteerTags) && result.volunteerTags.length
      ? result.volunteerTags.join(" / ")
      : "暂无标签",
    volunteerSummary: result.volunteerSummary || "暂无摘要",
    riskMeta: toRiskMeta(result.volunteerRiskLevel),
    actionSuggestions,
  };
}

function decorateJob(job) {
  if (!job) {
    return null;
  }

  return {
    jobId: job.jobId,
    shortJobId: shortId(job.jobId, 8),
    status: job.status,
    stage: job.stage,
    statusMeta: toJobStatusMeta(job.status),
    stageLabel: toJobStageLabel(job.stage),
    progress: clampPercent(job.progress),
    message: job.message || "任务处理中",
    retryCount: job.retryCount || 0,
    errorDetail: job.errorDetail || "",
    finishedAtText: formatDateTime(job.finishedAt || ""),
    createdAtText: formatDateTime(job.createdAt || ""),
    result: decoratePipelineResult(job.result),
  };
}

Page({
  data: {
    siteName: "",
    volunteerNote: "",
    cameraVisible: false,
    cameraPosition: "back",
    takingPhoto: false,
    selectedFilePath: "",
    selectedFileName: "",
    selectedFileSizeText: "",
    selectedFileSourceLabel: "",
    submitting: false,
    progress: 0,
    activeJobId: "",
    activeJob: null,
    currentResult: null,
    lastResult: null,
    pipelineModules,
    workerMeta: toWorkerMeta(null),
    workerStatus: "offline",
    errorMessage: "",
  },

  onLoad() {
    this.restoreLocalState();
  },

  onShow() {
    this.restoreLocalState();
    this.loadHealth();
    this.startHealthPolling();
    if (this.data.activeJobId) {
      this.pollJob(this.data.activeJobId);
    }
  },

  onHide() {
    this.closeCameraCapture();
    this.clearHealthPolling();
    this.clearJobPolling();
  },

  onUnload() {
    this.closeCameraCapture();
    this.clearHealthPolling();
    this.clearJobPolling();
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadHealth(),
      this.data.activeJobId ? this.fetchJob(this.data.activeJobId) : Promise.resolve(),
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  restoreLocalState() {
    const storedJobId = readStorage(ACTIVE_JOB_ID_KEY, "");
    const storedResult = readStorage(LAST_RESULT_KEY, null);

    this.setData({
      activeJobId: storedJobId || "",
      lastResult: storedResult ? decoratePipelineResult(storedResult) : null,
    });
    if (this.data.lastResult) {
      this.hydrateResultImages(this.data.lastResult).then(() => {
        this.setData({
          lastResult: this.data.lastResult,
        });
      });
    }
  },

  startHealthPolling() {
    this.clearHealthPolling();
    this.healthTimer = setInterval(() => {
      this.loadHealth();
    }, 3000);
  },

  clearHealthPolling() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  },

  async loadHealth() {
    try {
      const health = await request({
        url: "/api/v1/health",
        fallbackErrorMessage: "健康状态加载失败。",
      });
      this.setData({
        workerMeta: toWorkerMeta(health ? health.worker : null),
        workerStatus: health && health.worker ? health.worker.status : "offline",
      });
    } catch (_error) {
      this.setData({
        workerMeta: toWorkerMeta(null),
        workerStatus: "offline",
      });
    }
  },

  onSiteInput(event) {
    this.setData({
      siteName: event.detail.value,
    });
  },

  onNoteInput(event) {
    this.setData({
      volunteerNote: event.detail.value,
    });
  },

  getCameraContext() {
    if (!this.cameraContext) {
      this.cameraContext = wx.createCameraContext();
    }
    return this.cameraContext;
  },

  getFileSize(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath,
        success: (response) => resolve(response.size || 0),
        fail: reject,
      });
    });
  },

  async applySelectedImage(filePath, fileSize, sourceLabel) {
    if (!filePath) {
      return false;
    }

    const resolvedFileSize = fileSize || await this.getFileSize(filePath);
    if (resolvedFileSize > MAX_UPLOAD_BYTES) {
      this.setData({
        takingPhoto: false,
      });
      wx.showToast({
        title: "图片不能超过 10 MB",
        icon: "none",
      });
      return false;
    }

    if (ALLOWED_IMAGE_EXTENSION_PATTERN.test(filePath) === false && /\.[^/]+$/.test(filePath)) {
      this.setData({
        takingPhoto: false,
      });
      wx.showToast({
        title: "仅支持 JPG/PNG/WebP",
        icon: "none",
      });
      return false;
    }

    const fallbackExtension = sourceLabel === "现场拍照" ? "jpg" : "image";
    const fileName = filePath.split("/").pop() || `selected-${Date.now()}.${fallbackExtension}`;
    const sizeMb = (resolvedFileSize / 1024 / 1024).toFixed(2);

    this.setData({
      cameraVisible: false,
      takingPhoto: false,
      selectedFilePath: filePath,
      selectedFileName: fileName,
      selectedFileSizeText: `${sizeMb} MB`,
      selectedFileSourceLabel: sourceLabel,
    });
    return true;
  },

  ensureCameraPermission() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: ({ authSetting }) => {
          const cameraPermission = authSetting["scope.camera"];

          if (cameraPermission === true) {
            resolve(true);
            return;
          }

          if (cameraPermission === false) {
            wx.showModal({
              title: "需要相机权限",
              content: "请开启相机权限后再进行现场拍照采集。",
              confirmText: "去设置",
              success: ({ confirm }) => {
                if (!confirm) {
                  resolve(false);
                  return;
                }
                wx.openSetting({
                  success: (settingResponse) => {
                    resolve(Boolean(settingResponse.authSetting["scope.camera"]));
                  },
                  fail: () => resolve(false),
                });
              },
              fail: () => resolve(false),
            });
            return;
          }

          wx.authorize({
            scope: "scope.camera",
            success: () => resolve(true),
            fail: () => resolve(false),
          });
        },
        fail: () => resolve(false),
      });
    });
  },

  async openCameraCapture() {
    const permissionGranted = await this.ensureCameraPermission();
    if (!permissionGranted) {
      wx.showToast({
        title: "未获得相机权限",
        icon: "none",
      });
      return;
    }

    this.setData({
      cameraVisible: true,
      takingPhoto: false,
      errorMessage: "",
    });
  },

  closeCameraCapture() {
    this.setData({
      cameraVisible: false,
      takingPhoto: false,
    });
  },

  switchCameraPosition() {
    this.setData({
      cameraPosition: this.data.cameraPosition === "back" ? "front" : "back",
    });
  },

  async takePhoto() {
    if (this.data.takingPhoto) {
      return;
    }

    this.setData({
      takingPhoto: true,
    });

    try {
      const response = await new Promise((resolve, reject) => {
        this.getCameraContext().takePhoto({
          quality: "high",
          success: resolve,
          fail: reject,
        });
      });

      const accepted = await this.applySelectedImage(
        response.tempImagePath,
        0,
        "现场拍照",
      );

      if (accepted) {
        wx.showToast({
          title: "拍照采集成功",
          icon: "success",
        });
      }
    } catch (error) {
      wx.showToast({
        title: error.errMsg || "拍照失败，请重试",
        icon: "none",
      });
      this.setData({
        takingPhoto: false,
      });
    }
  },

  onCameraError(event) {
    wx.showToast({
      title: event.detail && event.detail.errMsg ? event.detail.errMsg : "相机打开失败",
      icon: "none",
    });
    this.setData({
      cameraVisible: false,
      takingPhoto: false,
    });
  },

  chooseFromAlbum() {
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album"],
      success: async (response) => {
        const file = response.tempFiles && response.tempFiles[0];
        const filePath = response.tempFilePaths && response.tempFilePaths[0];

        if (!file || !filePath) {
          return;
        }
        await this.applySelectedImage(filePath, file.size, "相册导入");
      },
    });
  },

  chooseImage() {
    this.chooseFromAlbum();
  },

  previewSelectedImage() {
    if (!this.data.selectedFilePath) {
      return;
    }
    wx.previewImage({
      urls: [this.data.selectedFilePath],
      current: this.data.selectedFilePath,
    });
  },

  previewResultImage(event) {
    const currentUrl = event.currentTarget.dataset.url;
    if (!currentUrl) {
      return;
    }
    wx.previewImage({
      current: currentUrl,
      urls: [currentUrl],
    });
  },

  validateForm() {
    const siteName = (this.data.siteName || "").trim();
    const volunteerNote = (this.data.volunteerNote || "").trim();

    if (!this.data.selectedFilePath) {
      wx.showToast({
        title: "请先拍照或选择图片",
        icon: "none",
      });
      return null;
    }
    if (siteName.length < 2) {
      wx.showToast({
        title: "潜点名称至少 2 个字符",
        icon: "none",
      });
      return null;
    }
    if (volunteerNote.length < 5) {
      wx.showToast({
        title: "备注至少 5 个字符",
        icon: "none",
      });
      return null;
    }

    return {
      siteName,
      volunteerNote,
    };
  },

  async submitTask() {
    const form = this.validateForm();
    if (!form || this.data.submitting) {
      return;
    }

    this.setData({
      submitting: true,
      progress: 16,
      currentResult: null,
      errorMessage: "",
    });

    try {
      const uploadData = await uploadImage(this.data.selectedFilePath);
      this.setData({
        progress: 56,
      });

      const enqueueResponse = await request({
        url: "/api/v1/ai/pipeline",
        method: "POST",
        data: {
          mediaPath: uploadData.storedPath,
          mediaUrl: uploadData.publicUrl,
          siteName: form.siteName,
          volunteerNote: form.volunteerNote,
        },
        fallbackErrorMessage: "AI 流水线任务创建失败。",
      });

      writeStorage(ACTIVE_JOB_ID_KEY, enqueueResponse.jobId);
      this.setData({
        activeJobId: enqueueResponse.jobId,
        activeJob: decorateJob(enqueueResponse),
        progress: clampPercent(enqueueResponse.progress || 60),
      });
      this.showEnqueueToast(enqueueResponse);
      this.pollJob(enqueueResponse.jobId);
    } catch (error) {
      this.setData({
        progress: 0,
        errorMessage: error.message || "任务提交失败。",
      });
      wx.showToast({
        title: error.message || "任务提交失败",
        icon: "none",
      });
    } finally {
      this.setData({
        submitting: false,
      });
    }
  },

  showEnqueueToast(enqueueResponse) {
    let title = `任务 ${shortId(enqueueResponse.jobId, 6)} 已创建`;
    if (enqueueResponse.dedupeReason === "completed" && enqueueResponse.cacheHit) {
      title = "命中结果缓存";
    } else if (enqueueResponse.dedupeReason === "inflight") {
      title = "复用进行中任务";
    }
    wx.showToast({
      title,
      icon: "none",
    });
  },

  clearJobPolling() {
    if (this.jobPollTimer) {
      clearTimeout(this.jobPollTimer);
      this.jobPollTimer = null;
    }
  },

  pollJob(jobId) {
    this.clearJobPolling();
    this.fetchJob(jobId).then((job) => {
      if (!job) {
        return;
      }
      if (job.status === "queued" || job.status === "running") {
        this.jobPollTimer = setTimeout(() => {
          this.pollJob(jobId);
        }, 1200);
      }
    });
  },

  async fetchJob(jobId) {
    try {
      const job = await request({
        url: `/api/v1/ai/pipeline/${jobId}`,
        fallbackErrorMessage: "任务状态加载失败。",
      });
      const decoratedJob = decorateJob(job);

      this.setData({
        activeJobId: jobId,
        activeJob: decoratedJob,
        progress: decoratedJob ? decoratedJob.progress : this.data.progress,
      });

      if (job.status === "succeeded" && job.result) {
        writeStorage(LAST_RESULT_KEY, job.result);
        const hydratedResult = decoratePipelineResult(job.result);
        await this.hydrateResultImages(hydratedResult);
        removeStorage(ACTIVE_JOB_ID_KEY);
        this.setData({
          currentResult: hydratedResult,
          lastResult: hydratedResult,
        });
        if (this.lastTerminalNoticeKey !== `${jobId}:succeeded`) {
          wx.showToast({
            title: "任务处理完成",
            icon: "success",
          });
          this.lastTerminalNoticeKey = `${jobId}:succeeded`;
        }
      } else if (job.status === "failed" || job.status === "canceled") {
        removeStorage(ACTIVE_JOB_ID_KEY);
        if (this.lastTerminalNoticeKey !== `${jobId}:${job.status}`) {
          wx.showToast({
            title: job.status === "failed" ? "任务执行失败" : "任务已取消",
            icon: "none",
          });
          this.lastTerminalNoticeKey = `${jobId}:${job.status}`;
        }
      }

      return job;
    } catch (error) {
      this.setData({
        errorMessage: error.message || "任务状态查询失败。",
      });
      return null;
    }
  },

  async hydrateResultImages(result) {
    if (!result) {
      return;
    }

    const [originalImage, enhancedImage] = await Promise.all([
      preloadImage(result.originalUrl),
      preloadImage(result.enhancedUrl),
    ]);

    result.originalImage = originalImage;
    result.enhancedImage = enhancedImage;
  },

  async cancelActiveJob() {
    if (!this.data.activeJobId) {
      return;
    }
    try {
      await request({
        url: `/api/v1/ai/pipeline/${this.data.activeJobId}/cancel`,
        method: "POST",
        fallbackErrorMessage: "任务取消失败。",
      });
      wx.showToast({
        title: "取消请求已发送",
        icon: "success",
      });
      this.fetchJob(this.data.activeJobId);
    } catch (error) {
      wx.showToast({
        title: error.message || "任务取消失败",
        icon: "none",
      });
    }
  },

  openJobDetail() {
    if (!this.data.activeJobId) {
      return;
    }
    wx.navigateTo({
      url: `/pages/job-detail/index?id=${this.data.activeJobId}`,
    });
  },

  openResultIdentity(event) {
    const identityId = event.currentTarget.dataset.id;
    if (!identityId) {
      return;
    }
    wx.navigateTo({
      url: `/pages/identity-detail/index?id=${identityId}`,
    });
  },
});
