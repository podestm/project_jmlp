#!/usr/bin/env bash
# Heslo testu jen jednou: po úspěšném zadání hesla dostane prohlížeč cookie
# (90 dní) a s ní už nginx heslo nechce. Bez toho vlastní hlavička
# Authorization: Bearer administrace/časomíry přebíjí heslo testu a prohlížeč
# pořád znovu ukazuje přihlašovací dialog.
# Spouštět jako root na jmlp-server; opakované spuštění nic nerozbije.
set -euo pipefail

SITE=/etc/nginx/sites-available/preprodtest.jmlp.cz.conf
MAP=/etc/nginx/conf.d/preprodtest-gate.conf

if [[ -f "$MAP" ]]; then
  SECRET=$(grep -oE '"[0-9a-f]{32}"' "$MAP" | head -1 | tr -d '"')
else
  SECRET=$(openssl rand -hex 16)
fi

BACKUP="$SITE.bak-$(date +%F-%H%M%S)"
cp "$SITE" "$BACKUP"
MAP_BACKUP=""
if [[ -f "$MAP" ]]; then MAP_BACKUP="$BACKUP.map"; cp "$MAP" "$MAP_BACKUP"; fi

umask 077
cat > "$MAP" <<CONF
# Brána testu preprodtest.jmlp.cz (deploy/test/nginx-gate.sh)
map \$cookie_jmlp_test_gate \$preprodtest_auth {
    "$SECRET" off;
    default   "JMLP test";
}
CONF

sed -i -E 's/^([[:space:]]*)auth_basic "JMLP test";/\1auth_basic $preprodtest_auth;/' "$SITE"
sed -i '/jmlp_test_gate=/d' "$SITE"
# Bez "always": cookie jen u úspěšných odpovědí, nikdy u 401.
sed -i "/X-Robots-Tag/a\\    add_header Set-Cookie \"jmlp_test_gate=$SECRET; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax\";" "$SITE"

if nginx -t; then
  systemctl reload nginx
  echo "OK: brána nastavena (záloha $BACKUP)"
else
  cp "$BACKUP" "$SITE"
  if [[ -n "$MAP_BACKUP" ]]; then cp "$MAP_BACKUP" "$MAP"; else rm -f "$MAP"; fi
  nginx -t && systemctl reload nginx
  echo "CHYBA: nginx -t selhal, vráceno zpět" >&2
  exit 1
fi
