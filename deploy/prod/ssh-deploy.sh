#!/bin/bash
# =============================================================================
# Vynucený příkaz (command=) pro SSH klíč, kterým GitHub Actions nasazuje produkci.
# Klíč nemá shell: jediné, co jím jde udělat, je `deploy <40místný commit>`.
# Cokoli jiného se odmítne. Návod: deploy/prod/README.md
# =============================================================================
set -euo pipefail

if [[ ! "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
    echo "Odmítnuto: povolen je jen příkaz 'deploy <commit>'." >&2
    exit 64
fi
# Přerušené SSH spojení nesmí zabít nasazení v půlce buildu: odpojení (HUP) se ignoruje
# a ignorování dědí i všechny procesy nasazení.
trap '' HUP
exec "$(dirname "$(readlink -f "$0")")/deploy-main.sh" "${BASH_REMATCH[1]}"
