const ACTIVE_JOB_ID_KEY = "ocean.collect.activeJobId";
const LAST_RESULT_KEY = "ocean.collect.lastResult";
const CURRENT_IDENTITY_KEY = "ocean.identity.current";

function readStorage(key, fallbackValue) {
  try {
    const value = wx.getStorageSync(key);
    return value === "" || value === undefined ? fallbackValue : value;
  } catch (_error) {
    return fallbackValue;
  }
}

function writeStorage(key, value) {
  wx.setStorageSync(key, value);
}

function removeStorage(key) {
  wx.removeStorageSync(key);
}

module.exports = {
  ACTIVE_JOB_ID_KEY,
  LAST_RESULT_KEY,
  CURRENT_IDENTITY_KEY,
  readStorage,
  writeStorage,
  removeStorage,
};
