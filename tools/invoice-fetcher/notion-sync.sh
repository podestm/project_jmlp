#!/bin/bash
# Twice-daily: record new invoice PDFs in Notion using Claude Code (Haiku).
# Calls Claude only when there is something to do.
set -uo pipefail
HOME_DIR=/opt/invoice-fetcher
cd "$HOME_DIR"
LEDGER=notion_synced.txt        # files already recorded or skipped
PENDING=notion_provisional.txt  # invoices with provisional CZK rate
touch "$LEDGER" "$PENDING"

new_files=$(cd invoices && ls -1 *.pdf 2>/dev/null | grep -vxF -f "$HOME_DIR/$LEDGER" || true)
if [ -z "$new_files" ] && [ ! -s "$PENDING" ]; then
  echo "nothing to do"; exit 0
fi

curl -sS -m 30 -o cnb_eur.txt \
  "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/prumerne_mena.txt?mena=EUR" \
  || echo "WARN: ČNB rates not downloaded"

prompt="$(cat notion_sync_prompt.md)

NEW FILES:
${new_files:-(none)}

PROVISIONAL:
$(cat "$PENDING")"

out=$(printf '%s' "$prompt" | timeout 1500 claude -p --model claude-haiku-5-5 \
  --allowedTools "Read" "Glob" "Bash(curl:*)" "Bash(ls:*)" "mcp__claude_ai_Notion" 2>&1)
rc=$?
echo "$out"

grep -E '^(SYNCED|SKIPPED) ' <<<"$out" | awk '{print $2}' >> "$LEDGER"
if [ $rc -eq 0 ]; then
  grep -E '^PROVISIONAL ' <<<"$out" | sort -u > "$PENDING" || true
fi
sort -u -o "$LEDGER" "$LEDGER"
exit $rc
