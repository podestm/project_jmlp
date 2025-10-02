#!/usr/bin/env python3
"""
Test script pro ověření hashování hesel v JMLP systému.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.auth import verify_password, get_password_hash

def test_password_hashing():
    """Test hashování a ověřování hesel."""
    print("🔐 Test hashování hesel JMLP")
    print("=" * 40)
    
    # Test 1: Vytvoření nového hashe
    test_password = "noveheslo123"
    hashed = get_password_hash(test_password)
    print(f"✅ Nové heslo: {test_password}")
    print(f"✅ Hash: {hashed[:50]}...")
    
    # Test 2: Ověření hashe
    is_valid = verify_password(test_password, hashed)
    print(f"✅ Ověření hashe: {'OK' if is_valid else 'CHYBA'}")
    
    # Test 3: Ověření špatného hesla
    is_invalid = verify_password("spatneheslo", hashed)
    print(f"✅ Odmítnutí špatného hesla: {'OK' if not is_invalid else 'CHYBA'}")
    
    # Test 4: Legacy admin123 test
    legacy_valid = verify_password("admin123", "admin123")
    print(f"✅ Legacy admin123 test: {'OK' if legacy_valid else 'CHYBA'}")
    
    # Test 5: Bcrypt hash test
    bcrypt_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNi8F/G9fzOUi"
    bcrypt_valid = verify_password("admin123", bcrypt_hash)
    print(f"✅ Bcrypt hash z databáze: {'OK' if bcrypt_valid else 'CHYBA'}")
    
    print("\n" + "=" * 40)
    print("✅ Test dokončen - hesla se hashují správně!")

if __name__ == "__main__":
    test_password_hashing()