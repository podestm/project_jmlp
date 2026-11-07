#!/usr/bin/env python3
"""SessionStart + Stop hook: do not end a turn on unverified code changes.

  stop_verify.py start  (SessionStart) remembers the tree fingerprint the session began with
                        and prints the session briefing (harness/init.sh --brief) as context.
  stop_verify.py stop   (Stop) if the tree changed during this session and that exact tree has
                        not passed harness/verify.sh, block the stop once with instructions.

Questions, reviews and read-only work never trigger it: the tree has to change first.
`stop_hook_active` prevents loops; the agent can always explain why verification is impossible.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / ".harness/state"


def fingerprint():
    out = subprocess.run([str(ROOT / "harness/lib/fingerprint.sh")], capture_output=True, text=True)
    return out.stdout.strip()


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "stop"
    payload = json.load(sys.stdin)
    session = payload.get("session_id", "unknown")
    STATE.mkdir(parents=True, exist_ok=True)
    start_file = STATE / f"session-{session}.start"

    if mode == "start":
        if not start_file.exists():
            start_file.write_text(fingerprint())
        brief = subprocess.run([str(ROOT / "harness/init.sh"), "--brief"], capture_output=True, text=True)
        print(brief.stdout)  # SessionStart stdout becomes context for the agent
        return 0

    if payload.get("stop_hook_active"):
        return 0
    now = fingerprint()
    started = start_file.read_text().strip() if start_file.exists() else now
    if now == started:
        return 0
    stamp = STATE / "last-verify.json"
    if stamp.exists():
        try:
            if json.loads(stamp.read_text()).get("fingerprint") == now:
                return 0
        except json.JSONDecodeError:
            pass
    print(json.dumps({
        "decision": "block",
        "reason": ("The working tree changed in this session and is not verified. Run `harness/verify.sh fast` "
                   "(or `full` before a commit), fix failures, then finish. If verification cannot run here, "
                   "say so explicitly in your final message instead of claiming the work is done."),
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
