#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WORK="$ROOT/.cloud-test/OrderFlow-Analysis-Pro"
PINNED="b2ff4ee9dcdf5adff8d7f73e875d23558f136611"

mkdir -p "$ROOT/.cloud-test" "$ROOT/orderflow-cloud-test-output"

if [ ! -d "$WORK/.git" ]; then
  git clone https://github.com/mahmoud20138/OrderFlow-Analysis-Pro.git "$WORK"
fi

cd "$WORK"
git fetch --quiet origin master
git checkout --quiet --detach "$PINNED"

echo
echo "Pinned candidate commit:"
git rev-parse HEAD
echo
echo "Installing candidate dependencies plus dashboard server..."
python -m pip install --upgrade pip
python -m pip install -e . "fastapi>=0.110" "uvicorn[standard]>=0.27"

cd "$ROOT"
export ORDERFLOW_REPO="$WORK"
export ORDERFLOW_PROBE_LOG_DIR="$ROOT/orderflow-cloud-test-output"

echo
echo "Starting isolated BTCUSDT / Bybit probe."
echo "Dashboard port: 8080 (private Codespaces forwarding)"
echo "Raw logs: $ORDERFLOW_PROBE_LOG_DIR"
echo "Press Ctrl+C to stop."
echo

python tools/orderflow-cloud-test/runner.py
