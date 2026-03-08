#!/bin/sh
set -eu

if [ -z "${MCP_MYSQL_USER:-}" ] || [ -z "${MCP_MYSQL_PASSWORD:-}" ]; then
  echo "Skipping MCP MySQL user creation because MCP_MYSQL_USER or MCP_MYSQL_PASSWORD is missing."
  exit 0
fi

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

MCP_MYSQL_USER_ESCAPED="$(sql_escape "$MCP_MYSQL_USER")"
MCP_MYSQL_PASSWORD_ESCAPED="$(sql_escape "$MCP_MYSQL_PASSWORD")"
MYSQL_DATABASE_ESCAPED="$(sql_escape "$MYSQL_DATABASE")"

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
CREATE USER IF NOT EXISTS '${MCP_MYSQL_USER_ESCAPED}'@'%' IDENTIFIED BY '${MCP_MYSQL_PASSWORD_ESCAPED}';
GRANT SELECT, SHOW VIEW ON \`${MYSQL_DATABASE_ESCAPED}\`.* TO '${MCP_MYSQL_USER_ESCAPED}'@'%';
FLUSH PRIVILEGES;
EOSQL
