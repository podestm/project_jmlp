#!/usr/bin/env python3
"""PreToolUse hook for Bash: blocks commands that touch production, shared data or secrets.

Reads the hook payload from stdin, matches the command against guard-rules.json (+ the
optional gitignored guard-rules.local.json) and exits 2 with the rule's reason, which
Claude Code shows to the agent instead of running the command. Exit 0 = allowed.

Deliberately simple and fail-closed on its own errors: a guard that silently stops
guarding is worse than one that blocks a command once.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_rules():
    rules = []
    for name in ("guard-rules.json", "guard-rules.local.json"):
        path = HERE / name
        if path.exists():
            rules += json.loads(path.read_text(encoding="utf-8"))["rules"]
    return rules


def check(command, rules):
    for rule in rules:
        if re.search(rule["pattern"], command, flags=re.IGNORECASE | re.MULTILINE):
            return rule
    return None


def main():
    try:
        payload = json.load(sys.stdin)
        command = payload.get("tool_input", {}).get("command", "")
        rule = check(command, load_rules())
    except Exception as exc:  # fail closed
        print(f"guard_bash: hook error ({exc}); command blocked. Fix .claude/hooks/guard-rules*.json.", file=sys.stderr)
        sys.exit(2)
    if rule:
        print(f"Blocked by harness guard [{rule['id']}]: {rule['reason']}", file=sys.stderr)
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
