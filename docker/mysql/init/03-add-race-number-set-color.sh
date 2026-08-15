#!/bin/sh
set -e

mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" <<'SQL'
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'fuj_jmlp_race_numbers'
    AND COLUMN_NAME = 'set_color'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE fuj_jmlp_race_numbers ADD COLUMN set_color VARCHAR(20) NOT NULL DEFAULT 'rose' AFTER set_number",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE fuj_jmlp_race_numbers
SET set_color = 'rose'
WHERE set_color IS NULL OR set_color = '';
SQL
