# shellcheck shell=bash
# Společná kontrola CI pro automatická nasazení (test i produkce). Načítá se přes `source`.
#
#   ci_status <repo> <sha>   vypíše: success | pending | failure:<úlohy> | unknown
#
# Úlohy z .github/workflows/ci.yml, které musí projít. Repo musí být veřejné
# (GitHub API se volá bez tokenu).
CI_JOBS="frontend backend harness"

ci_status() {
    local repo=$1 sha=$2 slug
    slug=$(git -C "$repo" remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
    curl -fsSL --max-time 20 -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$slug/commits/$sha/check-runs?per_page=100" \
      | python3 -c '
import json, sys
jobs = sys.argv[1].split()
runs = {}
for r in json.load(sys.stdin).get("check_runs", []):
    # Víc běhů téže úlohy (push i pull_request): rozhoduje ten nejnovější.
    if r["name"] not in runs or r["started_at"] > runs[r["name"]]["started_at"]:
        runs[r["name"]] = r
if any(j not in runs or runs[j]["status"] != "completed" for j in jobs):
    print("pending")
elif all(runs[j]["conclusion"] == "success" for j in jobs):
    print("success")
else:
    print("failure:" + ",".join(j for j in jobs if runs[j]["conclusion"] != "success"))
' "$CI_JOBS" 2>/dev/null || echo unknown
}
