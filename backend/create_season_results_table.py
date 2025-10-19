#!/usr/bin/env python3
"""
Migration script to create season results table.
Stores season-to-document mappings for overall season results.
"""

import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def create_season_results_table():
    """Create fuj_jmlp_season_results table"""
    
    conn = mysql.connector.connect(
        host=os.getenv('MYSQL_HOST', 'localhost'),
        user=os.getenv('MYSQL_USER', 'root'),
        password=os.getenv('MYSQL_PASSWORD', 'root'),
        database=os.getenv('MYSQL_DATABASE', 'jmlpcz'),
        port=int(os.getenv('MYSQL_PORT', 3307))
    )
    
    cursor = conn.cursor()
    
    # Create season results table
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS `fuj_jmlp_season_results` (
        `id` BIGINT NOT NULL AUTO_INCREMENT,
        `season_year_start` INT NOT NULL COMMENT 'Start year of season (e.g. 2024 for 2024/2025)',
        `season_year_end` INT NOT NULL COMMENT 'End year of season (e.g. 2025 for 2024/2025)',
        `document_id` BIGINT NOT NULL COMMENT 'FK to fuj_jmlp_document',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `unique_season` (`season_year_start`, `season_year_end`),
        KEY `idx_document_id` (`document_id`)
    ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Season overall results - document assignments';
    """
    
    print("Creating fuj_jmlp_season_results table...")
    cursor.execute(create_table_sql)
    conn.commit()
    print("✓ Table created successfully")
    
    # Verify table structure
    cursor.execute("DESCRIBE fuj_jmlp_season_results")
    print("\nTable structure:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    cursor.close()
    conn.close()
    print("\n✓ Migration completed successfully!")

if __name__ == "__main__":
    create_season_results_table()
