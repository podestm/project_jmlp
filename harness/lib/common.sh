# Sourced by every harness script and hook. Sets ROOT and makes git usable when the
# checkout is owned by another user (shared servers), without touching global git config.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="$ROOT"
