#!/usr/bin/env python3
"""
Database migration and sync utility for JMLP application.
Ensures database schema is always in sync with SQLAlchemy models.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from sqlalchemy import inspect, text
from app import models

def show_database_status():
    """Show current database tables and compare with models."""
    print("🔍 Database Schema Status")
    print("=" * 50)
    
    # Get current tables
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    
    # Expected tables from models
    expected_tables = {
        'fuj_jmlp_racer',
        'fuj_jmlp_club', 
        'fuj_jmlp_areal',
        'fuj_jmlp_race',
        'race_registration',
        'posts',
        'fuj_jmlp_admin',
        'fuj_jmlp_document',
        'fuj_jmlp_files'
    }
    
    print("📋 Expected tables:")
    for table in sorted(expected_tables):
        status = "✅" if table in existing_tables else "❌"
        print(f"  {status} {table}")
    
    print(f"\n📊 Summary:")
    print(f"  Expected: {len(expected_tables)}")
    print(f"  Existing: {len(existing_tables)}")
    
    missing = expected_tables - existing_tables
    extra = existing_tables - expected_tables
    
    if missing:
        print(f"  Missing:  {len(missing)} - {list(missing)}")
    if extra:
        print(f"  Extra:    {len(extra)} - {list(extra)}")
    
    if not missing and not extra:
        print("  Status:   ✅ Perfect sync!")
    
    return missing, extra

def sync_database():
    """Sync database with current models."""
    print("\n🔄 Syncing database with models...")
    
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database sync completed!")
        return True
    except Exception as e:
        print(f"❌ Database sync failed: {e}")
        return False

def main():
    """Main function."""
    print("JMLP Database Migration Tool")
    print("=" * 30)
    
    # Show current status
    missing, extra = show_database_status()
    
    # If there are differences, offer to sync
    if missing or extra:
        print(f"\n⚠️  Database schema is not in sync with models!")
        if missing:
            print(f"   Missing tables: {list(missing)}")
        
        sync = input(f"\n🤔 Would you like to sync now? (y/N): ").lower().strip()
        if sync in ['y', 'yes']:
            if sync_database():
                print(f"\n🎉 Database is now synced!")
                show_database_status()
            else:
                sys.exit(1)
        else:
            print(f"   Skipping sync.")
    else:
        print(f"\n🎉 Database is already in sync!")

if __name__ == "__main__":
    main()