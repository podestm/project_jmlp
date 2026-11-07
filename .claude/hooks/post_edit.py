#!/usr/bin/env python3
"""PostToolUse hook for Edit/Write: format the file just written, then give immediate feedback.

Only the file that was written, only cheap tools (seconds, not minutes):
  backend/**/*.py            -> ruff format, then ruff check (also catches syntax errors)
  frontend/** (js, jsx, css, json, html)
                             -> prettier --write, then eslint (js/jsx) and the style rules (css/jsx)
Formatting is silent; exit 2 puts remaining findings in front of the agent so it fixes them next.
Whole-suite checks belong to harness/verify.sh, not here.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TIMEOUT = 90
PRETTIER_SUFFIXES = {".js", ".jsx", ".mjs", ".css", ".json", ".html"}


def run(cmd, cwd):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return 0, ""  # never block the agent on a slow machine; verify.sh will catch it
    return p.returncode, (p.stdout + p.stderr).strip()


def main():
    payload = json.load(sys.stdin)
    raw = payload.get("tool_input", {}).get("file_path", "")
    if not raw:
        return 0
    path = Path(raw).resolve()
    try:
        rel = path.relative_to(ROOT)
    except ValueError:
        return 0
    if not path.exists():
        return 0
    parts = rel.parts
    problems = []

    if parts[0] == "backend" and path.suffix == ".py":
        sub = str(Path(*parts[1:]))
        ruff = str(ROOT / "harness/lib/ruff.sh")
        run([ruff, "format", "--quiet", sub], ROOT)
        code, out = run([ruff, "check", "--output-format", "concise", sub], ROOT)
        if code:
            problems.append(out)

    if parts[0] == "frontend" and (ROOT / "frontend/node_modules").exists():
        sub = str(Path(*parts[1:]))
        if path.suffix in PRETTIER_SUFFIXES:
            # Respects .prettierignore (generated files stay as their generator wrote them).
            run(["npx", "prettier", "--write", "--log-level", "warn", "--ignore-unknown", sub], ROOT / "frontend")
        if path.suffix in (".js", ".jsx", ".mjs"):
            code, out = run(["npx", "eslint", "--quiet", sub], ROOT / "frontend")
            if code:
                problems.append(out)
        if path.suffix in (".css", ".jsx"):
            code, out = run(["node", "scripts/check-styles.mjs"], ROOT / "frontend")
            if code:
                problems.append(out[-3000:])

    if problems:
        print(f"Checks failed for {rel} (fix before moving on):\n\n" + "\n\n".join(problems), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
