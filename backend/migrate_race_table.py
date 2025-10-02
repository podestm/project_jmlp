#!/usr/bin/env python3
"""
Migration to update fuj_jmlp_race table structure to match models.py
Changes old varchar columns (proposition, result) to new bigint FK columns (proposition_file_id, results_file_id)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

def migrate_race_table():
    """Migrate fuj_jmlp_race table to match current model."""
    print("🔄 Migrating fuj_jmlp_race table...")
    
    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()
        try:
            # Check current structure
            result = conn.execute(text("DESCRIBE fuj_jmlp_race"))
            current_columns = {row[0] for row in result}
            print(f"Current columns: {current_columns}")
            
            # Add new columns if they don't exist
            if 'proposition_file_id' not in current_columns:
                print("  Adding proposition_file_id column...")
                conn.execute(text("""
                    ALTER TABLE fuj_jmlp_race 
                    ADD COLUMN proposition_file_id BIGINT NULL
                """))
            
            if 'results_file_id' not in current_columns:
                print("  Adding results_file_id column...")
                conn.execute(text("""
                    ALTER TABLE fuj_jmlp_race 
                    ADD COLUMN results_file_id BIGINT NULL
                """))
            
            # Migrate data from old columns to new ones if they exist
            if 'proposition' in current_columns:
                print("  Migrating proposition data...")
                # For now, set to NULL - in future you might want to migrate actual file paths
                conn.execute(text("""
                    UPDATE fuj_jmlp_race 
                    SET proposition_file_id = NULL 
                    WHERE proposition IS NOT NULL
                """))
                
                print("  Dropping old proposition column...")
                conn.execute(text("ALTER TABLE fuj_jmlp_race DROP COLUMN proposition"))
            
            if 'result' in current_columns:
                print("  Migrating result data...")
                # For now, set to NULL - in future you might want to migrate actual file paths
                conn.execute(text("""
                    UPDATE fuj_jmlp_race 
                    SET results_file_id = NULL 
                    WHERE result IS NOT NULL
                """))
                
                print("  Dropping old result column...")
                conn.execute(text("ALTER TABLE fuj_jmlp_race DROP COLUMN result"))
            
            # Commit transaction
            trans.commit()
            print("✅ Race table migration completed successfully!")
            
            # Show new structure
            result = conn.execute(text("DESCRIBE fuj_jmlp_race"))
            print("\n📋 New table structure:")
            for row in result:
                print(f"  {row[0]}: {row[1]} {'NULL' if row[2] == 'YES' else 'NOT NULL'}")
            
            return True
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            return False

def main():
    """Main function."""
    print("JMLP Race Table Migration")
    print("=" * 30)
    
    success = migrate_race_table()
    if success:
        print("\n🎉 Migration completed successfully!")
        print("   The fuj_jmlp_race table now matches the SQLAlchemy model.")
    else:
        print("\n💥 Migration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()