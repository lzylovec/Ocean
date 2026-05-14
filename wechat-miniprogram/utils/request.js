const {
  buildApiUrl,
  getRuntimePlatform,
  getRuntimeTarget,
} = require("./config");

function isLocalHttpUrl(url) {
  return /^http:\/\/(127\.0\.0\.1|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url);
}

function ensurePreviewUrlIsValid(url) {
  if (getRuntimeTarget() !== "preview") {
    return null;
  }
  if (!url) {
    return new Error("当前是手机预览包，但还没有配置可公网访问的 HTTPS 后端域名。");
  }
  if (!/^https:\/\//.test(url) || isLocalHttpUrl(url)) {
    return new Error(`当前是手机预览包，不能请求本地或 HTTP 地址：${url}。请改成微信后台已配置的 HTTPS 合法域名。`);
  }
  return null;
}

function parseResponseBody(payload) {
  if (payload === null || payload === undefined || payload === "") {
    return {};
  }
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (_error) {
      return { detail: payload };
    }
  }
  return payload;
}

function readErrorMessage(body, fallbackMessage) {
  if (typeof body === "string" && body.trim()) {
    return body;
  }
  if (body && typeof body.detail === "string" && body.detail.trim()) {
    return body.detail;
  }
  if (body && Array.isArray(body.detail)) {
    return body.detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item.msg === "string") {
          return item.msg;
        }
        return "";
      })
      .filter(Boolean)
      .join("；");
  }
  return fallbackMessage;
}

function request(options) {
  const {
    url,
    method = "GET",
    data,
    header,
    timeout = 20000,
    fallbackErrorMessage = "请求失败，请稍后重试。",
    networkErrorMessage = "网络连接失败，请检查后端服务和域名配置。",
  } = options;

  return new Promise((resolve, reject) => {
    const resolvedUrl = buildApiUrl(url);
    const previewUrlError = ensurePreviewUrlIsValid(resolvedUrl);
    if (previewUrlError) {
      reject(previewUrlError);
      return;
    }
    wx.request({
      url: resolvedUrl,
      method,
      data,
      timeout,
      header: header || { "Content-Type": "application/json" },
      success: (response) => {
        const body = parseResponseBody(response.data);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body);
          return;
        }
        reject(new Error(readErrorMessage(body, fallbackErrorMessage)));
      },
      fail: (error) => {
        const runtimeHint =
          getRuntimePlatform() === "devtools"
            ? "开发者工具请确认后端已启动在 127.0.0.1:8000。"
            : "真机请确认手机与电脑同网段，且后端监听在局域网地址。";
        reject(new Error(`${error.errMsg || networkErrorMessage} ${resolvedUrl}。${runtimeHint}`));
      },
    });
  });
}

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    const resolvedUrl = buildApiUrl("/api/v1/media/upload");
    const previewUrlError = ensurePreviewUrlIsValid(resolvedUrl);
    if (previewUrlError) {
      reject(previewUrlError);
      return;
    }
    wx.uploadFile({
      url: resolvedUrl,
      filePath,
      name: "file",
      timeout: 30000,
      success: (response) => {
        const body = parseResponseBody(response.data);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body);
          return;
        }
        reject(new Error(readErrorMessage(body, "图片上传失败，请检查文件类型和大小限制。")));
      },
      fail: (error) => {
        const runtimeHint =
          getRuntimePlatform() === "devtools"
            ? "开发者工具请确认后端已启动在 127.0.0.1:8000。"
            : "真机请确认手机与电脑同网段，且后端监听在局域网地址。";
        reject(new Error(`${error.errMsg || "图片上传失败，请检查网络或合法域名配置。"} ${resolvedUrl}。${runtimeHint}`));
      },
    });
  });
}

module.exports = {
  request,
  uploadImage,
};
