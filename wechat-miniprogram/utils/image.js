function createImageAsset(url) {
  return {
    previewUrl: url || "",
    renderUrl: "",
    loading: Boolean(url),
    error: false,
  };
}

function preloadImage(url) {
  if (!url) {
    return Promise.resolve(createImageAsset(""));
  }

  return new Promise((resolve) => {
    wx.getImageInfo({
      src: url,
      success: (response) => {
        resolve({
          previewUrl: url,
          renderUrl: response.path || url,
          loading: false,
          error: false,
        });
      },
      fail: () => {
        resolve({
          previewUrl: url,
          renderUrl: "",
          loading: false,
          error: true,
        });
      },
    });
  });
}

module.exports = {
  createImageAsset,
  preloadImage,
};
