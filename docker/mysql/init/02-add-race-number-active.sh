#!/bin/sh
set -eu

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" <<'EOSQL'
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fuj_jmlp_race_numbers'
    AND COLUMN_NAME = 'is_active'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE fuj_jmlp_race_numbers ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER display_number',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
EOSQL
