#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/services/api/scripts/uninstall_api_launch_agent.sh" || true
"$ROOT_DIR/services/api/scripts/uninstall_worker_launch_agent.sh" || true
"$ROOT_DIR/scripts/uninstall_frontend_launch_agent.sh" || true

echo "Ocean local launch agents uninstalled: API + worker + frontend"
