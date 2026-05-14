#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

detect_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null
}

LAN_IP="${LAN_IP:-$(detect_lan_ip)}"

if [[ -z "${LAN_IP}" ]]; then
  echo "无法自动检测局域网 IP。请手动执行：LAN_IP=你的IP scripts/run-wechat-worker.sh" >&2
  exit 1
fi

PUBLIC_BASE_URL="http://${LAN_IP}:8000" \
  .venv/bin/python services/api/scripts/run_pipeline_worker.py
