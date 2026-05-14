#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

detect_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null
}

LAN_IP="${LAN_IP:-$(detect_lan_ip)}"

if [[ -z "${LAN_IP}" ]]; then
  echo "无法自动检测局域网 IP。请手动执行：LAN_IP=你的IP scripts/sync-wechat-api-base.sh" >&2
  exit 1
fi

TARGET_FILE="${ROOT_DIR}/wechat-miniprogram/utils/runtime-config.js"

cat > "${TARGET_FILE}" <<EOF
const DEVTOOLS_API_BASE_URL = "http://127.0.0.1:8000";
const DEVICE_DEBUG_API_BASE_URL = "http://${LAN_IP}:8000";
const PREVIEW_API_BASE_URL = "";

module.exports = {
  DEVTOOLS_API_BASE_URL,
  DEVICE_DEBUG_API_BASE_URL,
  PREVIEW_API_BASE_URL,
};
EOF

echo "已更新小程序真机调试默认 API 地址: http://${LAN_IP}:8000"
