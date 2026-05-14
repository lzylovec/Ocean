function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(value) {
  if (!value) {
    return "未完成";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function clampPercent(value) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function shortId(value, length = 8) {
  if (!value) {
    return "--";
  }
  return value.slice(0, length);
}

function toWorkerMeta(worker) {
  if (!worker) {
    return {
      label: "Worker 离线",
      detail: "未获取到在线心跳。",
      className: "status-pill status-danger",
    };
  }
  if (worker.status === "healthy") {
    return {
      label: "Worker 在线",
      detail: worker.message || "队列空闲。",
      className: "status-pill status-success",
    };
  }
  if (worker.status === "busy") {
    return {
      label: "Worker 忙碌",
      detail: worker.message || "正在消费队列。",
      className: "status-pill status-busy",
    };
  }
  if (worker.status === "degraded") {
    return {
      label: "Worker 异常",
      detail: worker.message || "在线但状态异常。",
      className: "status-pill status-warning",
    };
  }
  return {
    label: "Worker 离线",
    detail: worker.message || "当前没有在线 worker。",
    className: "status-pill status-danger",
  };
}

function toJobStatusMeta(status) {
  if (status === "queued") {
    return { label: "排队中", className: "badge badge-neutral" };
  }
  if (status === "running") {
    return { label: "执行中", className: "badge badge-primary" };
  }
  if (status === "succeeded") {
    return { label: "已完成", className: "badge badge-success" };
  }
  if (status === "failed") {
    return { label: "失败", className: "badge badge-danger" };
  }
  if (status === "canceled") {
    return { label: "已取消", className: "badge badge-warning" };
  }
  return { label: status || "未知", className: "badge badge-neutral" };
}

function toJobStageLabel(stage) {
  const mapping = {
    queued: "等待执行",
    enhancing: "图像增强",
    detecting: "目标检测",
    recognizing: "OCR 识别",
    analyzing: "语义分析",
    persisting: "写入身份证",
    completed: "处理完成",
    failed: "处理失败",
    canceled: "任务取消",
  };
  return mapping[stage] || stage || "未知阶段";
}

function toReviewMeta(status) {
  if (status === "已确认") {
    return { label: status, className: "badge badge-success" };
  }
  if (status === "待补文字线索" || status === "待补OCR") {
    return { label: "待补文字线索", className: "badge badge-primary" };
  }
  if (status === "待复核") {
    return { label: status, className: "badge badge-warning" };
  }
  return { label: status || "未知状态", className: "badge badge-neutral" };
}

function toRiskMeta(level) {
  if (level === "high") {
    return { label: "高风险", className: "badge badge-danger" };
  }
  if (level === "low") {
    return { label: "低风险", className: "badge badge-success" };
  }
  return { label: "中风险", className: "badge badge-primary" };
}

function toReuseLabel(reason) {
  if (reason === "completed") {
    return "结果缓存命中";
  }
  if (reason === "inflight") {
    return "进行中复用";
  }
  return "首次执行";
}

function toActionSuggestionHint(suggestion) {
  if (!suggestion) {
    return "作为后续治理动作的提示。";
  }
  if (suggestion.indexOf("后台复核") >= 0) {
    return "说明当前证据更适合先进入人工确认环节。";
  }
  if (suggestion.indexOf("岸线来源") >= 0) {
    return "说明垃圾更可能与岸线消费或近岸输入有关。";
  }
  if (suggestion.indexOf("OCR") >= 0) {
    return "说明可以继续利用品牌或包装文字做溯源。";
  }
  if (suggestion.indexOf("渔业") >= 0) {
    return "说明该垃圾更接近渔业活动相关来源。";
  }
  return "作为后续治理动作的提示。";
}

module.exports = {
  clampPercent,
  formatDateTime,
  shortId,
  toActionSuggestionHint,
  toJobStageLabel,
  toJobStatusMeta,
  toReuseLabel,
  toReviewMeta,
  toRiskMeta,
  toWorkerMeta,
};
