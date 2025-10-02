#!/usr/bin/env python3
"""
Migration to update posts table structure to match models.py
Adds missing columns: image_file_id, image_position, document_file_id
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

def migrate_posts_table():
    """Migrate posts table to match current model."""
    print("🔄 Migrating posts table...")
    
    with engine.connect() as conn:
        # Start transaction
        trans = conn.begin()
        try:
            # Check current structure
            result = conn.execute(text("DESCRIBE posts"))
            current_columns = {row[0] for row in result}
            print(f"Current columns: {current_columns}")
            
            # Add new columns if they don't exist
            if 'image_file_id' not in current_columns:
                print("  Adding image_file_id column...")
                conn.execute(text("""
                    ALTER TABLE posts 
                    ADD COLUMN image_file_id BIGINT NULL
                """))
            
            if 'image_position' not in current_columns:
                print("  Adding image_position column...")
                conn.execute(text("""
                    ALTER TABLE posts 
                    ADD COLUMN image_position VARCHAR(20) NULL DEFAULT 'right'
                """))
            
            if 'document_file_id' not in current_columns:
                print("  Adding document_file_id column...")
                conn.execute(text("""
                    ALTER TABLE posts 
                    ADD COLUMN document_file_id BIGINT NULL
                """))
            
            # Commit transaction
            trans.commit()
            print("✅ Posts table migration completed successfully!")
            
            # Show new structure
            result = conn.execute(text("DESCRIBE posts"))
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
    print("JMLP Posts Table Migration")
    print("=" * 30)
    
    success = migrate_posts_table()
    if success:
        print("\n🎉 Migration completed successfully!")
        print("   The posts table now matches the SQLAlchemy model.")
    else:
        print("\n💥 Migration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()