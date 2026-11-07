#!/usr/bin/env bash
# Session initializer. Run at the start of every agent session (the SessionStart hook runs `--brief`).
#
#   harness/init.sh          # check prerequisites, install missing deps, print the session briefing
#   harness/init.sh --brief  # briefing only, no installs (fast, safe to run on every session start)
#
# The briefing is what a fresh context window needs: where the branch is, what is uncommitted,
# what the last session left, which feature is next and whether the tree is verified.
set -uo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
cd "$ROOT"
BRIEF=0; [ "${1:-}" = "--brief" ] && BRIEF=1

warn=()
if [ $BRIEF = 0 ]; then
  command -v git >/dev/null || warn+=("git missing")
  command -v docker >/dev/null || warn+=("docker missing: backend tests cannot run")
  if command -v node >/dev/null; then
    major="$(node -p 'process.versions.node.split(".")[0]')"
    [ "$major" -ge 20 ] || warn+=("node >= 20 required (found $(node -v))")
  else
    warn+=("node missing: frontend checks cannot run")
  fi
  if [ ! -d frontend/node_modules ] || [ frontend/package-lock.json -nt frontend/node_modules/.package-lock.json ]; then
    echo "[init] installing frontend dependencies (npm ci)…"
    (cd frontend && npm ci --no-audit --no-fund >/dev/null 2>&1) || warn+=("npm ci failed")
  fi
  chmod +x harness/*.sh harness/lib/*.sh .claude/hooks/*.sh 2>/dev/null || true
fi

echo "# Session briefing"
echo
echo "Branch: $(git branch --show-current)   HEAD: $(git log -1 --format='%h %s')"
dirty="$(git status --porcelain | wc -l)"
echo "Uncommitted files: $dirty"
[ "$dirty" -gt 0 ] && git status --porcelain | head -15 | sed 's/^/  /'

echo
echo "## Last session (harness/progress.md)"
awk '/^## [0-9]{4}-/{n++} n==1' harness/progress.md | head -20

echo
echo "## Features (harness/features.json)"
python3 - <<'EOF'
import json
d = json.load(open("harness/features.json"))
order = {"failing": 0, "unverified": 1, "todo": 2, "passing": 3}
fs = d["features"]
counts = {}
for f in fs:
    counts[f["status"]] = counts.get(f["status"], 0) + 1
print("  " + ", ".join(f"{k}: {v}" for k, v in sorted(counts.items(), key=lambda kv: order[kv[0]])))
nxt = sorted((f for f in fs if f["status"] != "passing"), key=lambda f: order[f["status"]])[:3]
for f in nxt:
    print(f"  next → {f['id']} [{f['status']}] {f['title']}")
EOF

echo
stamp=.harness/state/last-verify.json
if [ -f "$stamp" ]; then
  now="$(harness/lib/fingerprint.sh)"
  if grep -q "\"fingerprint\":\"$now\"" "$stamp"; then
    echo "Verification: current tree verified ($(python3 -c "import json;d=json.load(open('$stamp'));print(d['tier'],d['at'])"))"
  else
    echo "Verification: tree changed since last verify — run harness/verify.sh fast"
  fi
else
  echo "Verification: never run in this checkout — run harness/verify.sh fast"
fi

if [ ${#warn[@]} -gt 0 ]; then
  echo; echo "## Warnings"; printf '  - %s\n' "${warn[@]}"
fi
echo
echo "Protocol: AGENTS.md → 'Session protocol'. Pick one feature, work in small verified steps, end with /checkpoint."
