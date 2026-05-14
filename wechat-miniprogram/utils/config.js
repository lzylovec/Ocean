const {
  DEVTOOLS_API_BASE_URL,
  DEVICE_DEBUG_API_BASE_URL,
  PREVIEW_API_BASE_URL,
} = require("./runtime-config");

const LEGACY_SHARED_STORAGE_KEY = "ocean.api.baseUrl";
const API_BASE_URL_STORAGE_KEY_PREFIX = "ocean.api.baseUrl.v2";
const LOCAL_BASE_URLS = new Set([
  "http://127.0.0.1:8000",
  "http://localhost:8000",
]);

function getRuntimePlatform() {
  try {
    const systemInfo = wx.getSystemInfoSync();
    return systemInfo.platform === "devtools" ? "devtools" : "device";
  } catch (_error) {
    return "device";
  }
}

function getRuntimeEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion || "develop";
  } catch (_error) {
    return "develop";
  }
}

function getRuntimeTarget() {
  const platform = getRuntimePlatform();
  if (platform === "devtools") {
    return "devtools";
  }
  return getRuntimeEnvVersion() === "develop" ? "device-debug" : "preview";
}

function getDefaultApiBaseUrl() {
  const target = getRuntimeTarget();
  if (target === "devtools") {
    return DEVTOOLS_API_BASE_URL;
  }
  if (target === "device-debug") {
    return DEVICE_DEBUG_API_BASE_URL;
  }
  return PREVIEW_API_BASE_URL;
}

function getStorageKey() {
  return `${API_BASE_URL_STORAGE_KEY_PREFIX}.${getRuntimeTarget()}`;
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\/+$/, "");
}

function isLocalBaseUrl(value) {
  return LOCAL_BASE_URLS.has(value);
}

function migrateLegacyBaseUrl() {
  const fallback = getDefaultApiBaseUrl();
  const runtimeTarget = getRuntimeTarget();

  try {
    const legacyValue = normalizeBaseUrl(wx.getStorageSync(LEGACY_SHARED_STORAGE_KEY));
    if (!legacyValue) {
      return fallback;
    }

    const shouldUseLegacyValue =
      (runtimeTarget === "devtools" && isLocalBaseUrl(legacyValue)) ||
      (runtimeTarget === "device-debug" && !isLocalBaseUrl(legacyValue)) ||
      (runtimeTarget === "preview" && /^https:\/\//.test(legacyValue));

    wx.removeStorageSync(LEGACY_SHARED_STORAGE_KEY);

    if (shouldUseLegacyValue) {
      wx.setStorageSync(getStorageKey(), legacyValue);
      return legacyValue;
    }

    return fallback;
  } catch (_error) {
    return fallback;
  }
}

function getApiBaseUrl() {
  const fallback = getDefaultApiBaseUrl();

  try {
    const normalized = normalizeBaseUrl(wx.getStorageSync(getStorageKey()));
    return normalized || migrateLegacyBaseUrl();
  } catch (_error) {
    return fallback;
  }
}

function setApiBaseUrl(value) {
  const fallback = getDefaultApiBaseUrl();
  const normalized = normalizeBaseUrl(value) || fallback;
  wx.setStorageSync(getStorageKey(), normalized);
  return normalized;
}

function buildApiUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function resolveMediaUrl(path) {
  if (!path) {
    return "";
  }
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return buildApiUrl(path);
}

module.exports = {
  API_BASE_URL_STORAGE_KEY_PREFIX,
  DEVTOOLS_API_BASE_URL,
  DEVICE_DEBUG_API_BASE_URL,
  PREVIEW_API_BASE_URL,
  getRuntimePlatform,
  getRuntimeEnvVersion,
  getRuntimeTarget,
  getDefaultApiBaseUrl,
  getApiBaseUrl,
  setApiBaseUrl,
  buildApiUrl,
  resolveMediaUrl,
};
