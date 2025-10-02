#!/usr/bin/env python3
"""
Fix character encoding for all tables to use utf8mb4.
This should resolve Czech character display issues.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

def fix_table_charset():
    """Fix charset for all tables to utf8mb4."""
    print("🔄 Fixing character encoding for all tables...")
    
    tables_to_fix = [
        'fuj_jmlp_areal',
        'fuj_jmlp_club', 
        'fuj_jmlp_race',
        'fuj_jmlp_racer',
        'race_registration'
    ]
    
    with engine.connect() as conn:
        for table in tables_to_fix:
            try:
                print(f"  Converting {table} to utf8mb4...")
                conn.execute(text(f"""
                    ALTER TABLE {table} 
                    CONVERT TO CHARACTER SET utf8mb4 
                    COLLATE utf8mb4_unicode_ci
                """))
                conn.commit()
                print(f"  ✅ {table} converted successfully")
            except Exception as e:
                print(f"  ❌ Error converting {table}: {e}")
    
    print("\n🔄 Checking final charset status...")
    result = conn.execute(text("""
        SELECT TABLE_NAME, TABLE_COLLATION 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA='jmlpcz'
        ORDER BY TABLE_NAME
    """))
    
    for row in result:
        status = "✅" if "utf8mb4" in row[1] else "❌"
        print(f"  {status} {row[0]}: {row[1]}")

def fix_post_data():
    """Try to fix corrupted Czech characters in posts."""
    print("\n🔄 Attempting to fix corrupted post data...")
    
    with engine.connect() as conn:
        # Get current posts with potentially corrupted data
        result = conn.execute(text("SELECT id, title, content FROM posts"))
        posts = result.fetchall()
        
        for post in posts:
            post_id, title, content = post
            
            # Try to detect and fix double-encoded UTF-8
            try:
                # Common fix for double-encoded UTF-8
                if "Ã" in title or "Ã" in content:
                    print(f"  Fixing post {post_id}: {title[:30]}...")
                    
                    # Fix title
                    fixed_title = title.encode('latin1').decode('utf-8')
                    # Fix content  
                    fixed_content = content.encode('latin1').decode('utf-8')
                    
                    # Update database
                    conn.execute(text("""
                        UPDATE posts 
                        SET title = :title, content = :content 
                        WHERE id = :id
                    """), {
                        "title": fixed_title,
                        "content": fixed_content, 
                        "id": post_id
                    })
                    conn.commit()
                    print(f"  ✅ Fixed post {post_id}")
                    
            except Exception as e:
                print(f"  ⚠️  Could not auto-fix post {post_id}: {e}")
                print(f"     Manual intervention may be needed")

def main():
    """Main function."""
    print("JMLP Character Encoding Fix")
    print("=" * 30)
    
    fix_table_charset()
    fix_post_data()
    
    print(f"\n🎉 Character encoding fix completed!")
    print(f"   All tables should now use utf8mb4 encoding.")
    print(f"   Czech characters should display correctly.")

if __name__ == "__main__":
    main()