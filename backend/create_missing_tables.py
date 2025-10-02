#!/usr/bin/env python3
"""
Script to create missing database tables based on SQLAlchemy models.
This ensures the database schema matches models.py exactly.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app import models

def create_missing_tables():
    """Create all missing tables defined in models.py"""
    print("Creating missing database tables...")
    
    # Import all models to ensure they're registered with Base
    from app.models import (
        Racer, Club, Areal, Race, Registration, Post, 
        AdminUser, Document, File
    )
    
    try:
        # Create all tables defined in models
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully!")
        
        # Verify tables exist
        from sqlalchemy import inspect
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        print("\n📋 Current database tables:")
        for table in sorted(existing_tables):
            print(f"  - {table}")
            
        # Check for model tables that should exist
        expected_tables = {
            'fuj_jmlp_racer',
            'fuj_jmlp_club', 
            'fuj_jmlp_areal',
            'fuj_jmlp_race',
            'race_registration',
            'posts',
            'fuj_jmlp_admin',
            'fuj_jmlp_document',
            'fuj_jmlp_files'  # This was missing!
        }
        
        missing_tables = expected_tables - set(existing_tables)
        if missing_tables:
            print(f"\n⚠️  Still missing tables: {missing_tables}")
        else:
            print(f"\n✅ All expected tables are present!")
            
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = create_missing_tables()
    sys.exit(0 if success else 1)