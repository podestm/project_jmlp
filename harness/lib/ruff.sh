#!/usr/bin/env bash
# Runs Ruff for the backend: harness/lib/ruff.sh <ruff args...>   (from any directory)
# Uses a local `ruff` when installed (CI: pip install -r backend/requirements-dev.txt), otherwise the
# pinned Docker image. Files are written as the owner of backend/, so a run as root on a shared server
# does not leave root-owned files behind.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
VERSION=0.6.9   # keep in sync with backend/requirements-dev.txt
cd "$ROOT/backend"
if command -v ruff >/dev/null && [ "$(ruff --version | awk '{print $2}')" = "$VERSION" ]; then
  exec ruff "$@"
fi
exec docker run --rm --user "$(stat -c %u:%g .)" -v "$PWD:/src" -w /src "ghcr.io/astral-sh/ruff:$VERSION" "$@"
