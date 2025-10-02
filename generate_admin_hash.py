#!/usr/bin/env python3
"""
Generování správného bcrypt hashe pro admin123.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.auth import get_password_hash

def generate_admin_hash():
    """Vygeneruje správný bcrypt hash pro admin123."""
    password = "admin123"
    hash_value = get_password_hash(password)
    
    print("🔐 Generování admin hashe")
    print("=" * 50)
    print(f"Heslo: {password}")
    print(f"Hash:  {hash_value}")
    print("=" * 50)
    print("SQL pro update:")
    print(f"UPDATE fuj_jmlp_admin SET password_hash = '{hash_value}' WHERE email = 'admin@jmlp.cz';")

if __name__ == "__main__":
    generate_admin_hash()