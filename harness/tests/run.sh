#!/usr/bin/env bash
# Self-tests of the harness (feature HAR-01). Fast, no Docker, no network.
#   harness/tests/run.sh
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
cd "$ROOT"
fail=0
ok() { printf 'ok   %s\n' "$1"; }
bad() { printf 'FAIL %s\n' "$1"; fail=1; }

# 1. Guard: every block case is blocked by the expected rule, every allow case passes.
python3 - <<'EOF' || fail=1
import json, subprocess, sys
cases = json.load(open("harness/tests/guard_cases.json"))
def run(cmd):
    p = subprocess.run([sys.executable, ".claude/hooks/guard_bash.py"], input=json.dumps(
        {"tool_name": "Bash", "tool_input": {"command": cmd}}), capture_output=True, text=True)
    return p.returncode, p.stderr
bad = 0
for cmd, rule in cases["block"]:
    code, err = run(cmd)
    if code != 2 or f"[{rule}]" not in err:
        print(f"FAIL guard should block [{rule}]: {cmd!r} -> exit {code} {err.strip()}"); bad += 1
for cmd in cases["allow"]:
    code, err = run(cmd)
    if code != 0:
        print(f"FAIL guard should allow: {cmd!r} -> {err.strip()}"); bad += 1
print(f"{'ok  ' if not bad else 'FAIL'} guard: {len(cases['block'])} block + {len(cases['allow'])} allow cases, {bad} wrong")
sys.exit(1 if bad else 0)
EOF

# 2. State files are well-formed and follow their own rules.
python3 - <<'EOF' || fail=1
import json, sys
d = json.load(open("harness/features.json"))
ids = [f["id"] for f in d["features"]]
errs = []
if len(ids) != len(set(ids)): errs.append("duplicate feature ids")
for f in d["features"]:
    if f["status"] not in d["status_values"]: errs.append(f"{f['id']}: bad status {f['status']}")
    if f["status"] == "passing" and not (f.get("checks") and f.get("verified")):
        errs.append(f"{f['id']}: passing without checks/verified")
    for c in f.get("checks", []):
        import os
        if not os.path.exists(c): errs.append(f"{f['id']}: check path missing: {c}")
for e in errs: print("FAIL features:", e)
print(f"{'ok  ' if not errs else 'FAIL'} features.json: {len(ids)} features")
sys.exit(1 if errs else 0)
EOF

# 3. Every CLAUDE.md imports its sibling AGENTS.md, and every AGENTS.md has a CLAUDE.md.
while read -r a; do
  d="$(dirname "$a")"
  if [ -f "$d/CLAUDE.md" ] && grep -q '^@AGENTS.md' "$d/CLAUDE.md"; then ok "CLAUDE.md imports $a"; else bad "$d/CLAUDE.md missing or does not import AGENTS.md"; fi
done < <(git ls-files --cached --others --exclude-standard '*AGENTS.md')

# 4. Settings and agent definitions parse; hooks referenced in settings exist.
python3 - <<'EOF' || fail=1
import json, re, sys, pathlib
s = json.load(open(".claude/settings.json"))
missing = []
for event in s.get("hooks", {}).values():
    for group in event:
        for h in group["hooks"]:
            for path in re.findall(r"\.claude/hooks/[\w.-]+", h["command"]):
                if not pathlib.Path(path).exists(): missing.append(path)
for p in pathlib.Path(".claude/agents").glob("*.md"):
    head = p.read_text().split("---")[1]
    if "name:" not in head or "description:" not in head: missing.append(f"{p}: frontmatter")
for m in missing: print("FAIL settings/agents:", m)
print(f"{'ok  ' if not missing else 'FAIL'} .claude settings, hooks and agents")
sys.exit(1 if missing else 0)
EOF

# 5. No server IP addresses in agent-facing docs and config (the repo is public; deploy/ keeps real paths).
#    Vendored upstream skill content (.claude/skills/security) holds example IPs only and is excluded.
pat='\b([0-9]{1,3}\.){3}[0-9]{1,3}\b'
hits="$(git grep --untracked -nE "$pat" -- '*.md' '.claude/' 'harness/' '.mcp.json' '.playwright/*.json' ':!.claude/skills/security/' | grep -vE '127\.0\.0\.1|0\.0\.0\.0|[^0-9.]1\.0\.0' || true)"
if [ -n "$hits" ]; then bad "IP addresses in agent docs/config:"; echo "$hits" | head; else ok "no server IP addresses in docs and agent config"; fi

[ $fail = 0 ] && echo "harness self-test: PASS" || { echo "harness self-test: FAIL"; exit 1; }
