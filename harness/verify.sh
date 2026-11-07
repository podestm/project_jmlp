#!/usr/bin/env bash
# Verification loop. An agent's work is "done" only when this passes.
#
#   harness/verify.sh fast   # changed files only: format, lint, related unit tests, style rules (~10-60 s)
#   harness/verify.sh full   # everything: all unit tests, backend suite on throwaway MySQL, build (~8 min)
#
# "Changed" = differs from the fork point with origin/dev (override: HARNESS_BASE), plus uncommitted and untracked files.
# On success the verified tree is stamped in .harness/state/last-verify.json; the Stop hook
# uses the stamp to tell whether the current tree has been verified.
set -uo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
TIER="${1:-fast}"
STATE="$ROOT/.harness/state"
mkdir -p "$STATE"
cd "$ROOT"

failures=()
step() { # step <name> <command...>
  local name="$1"; shift
  local t0=$SECONDS
  printf '\n== %s\n' "$name"
  if "$@"; then
    printf -- '-- ok: %s (%ss)\n' "$name" $((SECONDS - t0))
  else
    printf -- '-- FAIL: %s (%ss)\n' "$name" $((SECONDS - t0))
    failures+=("$name")
  fi
}

# Base = where this branch forked from the integration branch (HARNESS_BASE, default origin/dev).
base="$(git merge-base HEAD "${HARNESS_BASE:-origin/dev}" 2>/dev/null || git merge-base HEAD origin/main)"
mapfile -t changed < <( { git diff --name-only "$base"; git ls-files --others --exclude-standard; } | sort -u | while read -r f; do [ -e "$f" ] && echo "$f"; done)

fe_src=(); fe_fmt=(); py_src=()
for f in "${changed[@]}"; do
  case "$f" in
    frontend/src/*.js|frontend/src/*.jsx) fe_src+=("${f#frontend/}") ;;
  esac
  case "$f" in
    frontend/*.js|frontend/*.jsx|frontend/*.mjs|frontend/*.css|frontend/*.json|frontend/*.html) fe_fmt+=("${f#frontend/}") ;;
    backend/*.py) py_src+=("${f#backend/}") ;;
  esac
done

need_node() { [ -d frontend/node_modules ] || (cd frontend && npm ci --no-audit --no-fund >/dev/null); }

case "$TIER" in
  fast)
    printf 'verify fast: %d changed files (%d frontend, %d backend)\n' "${#changed[@]}" "${#fe_src[@]}" "${#py_src[@]}"
    if [ ${#fe_fmt[@]} -gt 0 ]; then
      need_node
      step "prettier (changed)" bash -c 'cd frontend && npx prettier --check --log-level warn --ignore-unknown "$@"' _ "${fe_fmt[@]}"
    fi
    if [ ${#fe_src[@]} -gt 0 ]; then
      need_node
      step "eslint (changed)" bash -c 'cd frontend && npx eslint --quiet "$@"' _ "${fe_src[@]}"
      step "vitest related" bash -c 'cd frontend && npx vitest related --run --reporter=dot --passWithNoTests "$@"' _ "${fe_src[@]}"
    fi
    if grep -qE '^frontend/(src|scripts)/' <<<"$(printf '%s\n' "${changed[@]}")"; then
      need_node
      step "style rules" bash -c 'cd frontend && npm run -s check:styles && npm run -s check:imports'
    fi
    if [ ${#py_src[@]} -gt 0 ]; then
      step "ruff (changed)" bash -c 'harness/lib/ruff.sh format --check --quiet "$@" && harness/lib/ruff.sh check --output-format concise "$@"' _ "${py_src[@]}"
      # Backend tests whose file name matches a changed module, e.g. services/seasons.py -> test_*season*.
      mapfile -t related < <(for f in "${py_src[@]}"; do b="$(basename "$f" .py)"; b="${b%s}"; ls backend/app/tests/test_*"$b"*.py 2>/dev/null; done | sort -u | sed 's|^backend/||')
      if [ ${#related[@]} -gt 0 ]; then
        step "backend tests (related)" harness/lib/backend-tests.sh "${related[@]}"
      else
        echo "(no backend test file matches the changed modules; run 'harness/verify.sh full')"
      fi
    fi
    ;;
  full)
    need_node
    step "prettier" bash -c 'cd frontend && npx prettier --check --log-level warn .'
    step "ruff" bash -c 'harness/lib/ruff.sh format --check --quiet . && harness/lib/ruff.sh check --output-format concise .'
    step "eslint" bash -c 'cd frontend && npx eslint --quiet src'
    step "style rules" bash -c 'cd frontend && npm run -s check:styles && npm run -s check:imports'
    step "frontend unit tests" bash -c 'cd frontend && npx vitest run --reporter=dot'
    step "backend tests (throwaway MySQL)" harness/lib/backend-tests.sh
    step "frontend build" bash -c 'cd frontend && npx vite build --logLevel error --outDir "$0"' "$STATE/build"
    ;;
  *)
    echo "usage: harness/verify.sh [fast|full]" >&2; exit 64 ;;
esac

if [ ${#failures[@]} -eq 0 ]; then
  printf '{"tier":"%s","result":"pass","head":"%s","fingerprint":"%s","at":"%s"}\n' \
    "$TIER" "$(git rev-parse HEAD)" "$("$ROOT/harness/lib/fingerprint.sh")" "$(date -Is)" > "$STATE/last-verify.json"
  printf '\nverify %s: PASS\n' "$TIER"
else
  printf '\nverify %s: FAIL (%s)\n' "$TIER" "$(IFS=', '; echo "${failures[*]}")"
  exit 1
fi
