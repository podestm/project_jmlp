#!/usr/bin/env bash
# Prints a hash of the working tree: HEAD + uncommitted changes + untracked files.
# Equal fingerprints = the code has not changed since it was last verified.
# Harness state files are excluded, so updating progress or features does not invalidate a verification.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$ROOT"
EXCLUDE=(':!harness/progress.md' ':!harness/features.json' ':!.harness')
{
  git rev-parse HEAD
  git diff HEAD -- . "${EXCLUDE[@]}"
  git ls-files --others --exclude-standard -- . "${EXCLUDE[@]}" | while read -r f; do
    [ -f "$f" ] && { echo "$f"; cat "$f"; }
  done
} | sha256sum | cut -c1-16
