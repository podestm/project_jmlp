#!/usr/bin/env python3
"""
Hromadný upload PDF dokumentů do JMLP systému
==============================================

Použití:
    python3 bulk_upload_documents.py /cesta/k/pdf/souborum/

Poznámky:
- Nahrává všechny PDF soubory ze zadané složky
- Ukládá je do uploads/documents/ s UUID jmény
- Zapisuje záznamy do fuj_jmlp_files tabulky
- Vyžaduje běžící MySQL kontejner (jmlp-db)
"""

import os
import sys
import uuid
import shutil
import pymysql
from pathlib import Path
from datetime import datetime

# Konfigurace databáze (z docker-compose.server.yml)
DB_CONFIG = {
    'host': 'localhost',
    'port': 3307,  # Exposed port from docker
    'user': 'app',
    'password': 'Pkk2JfZza2ew7gnksz22',
    'database': 'jmlpcz',
    'charset': 'utf8mb4'
}

# Konfigurace uploadů
# Preferovaná host path (v projektu) - pokud existuje, použijeme ji
HOST_PREFERRED_DIR = Path("/opt/jmlp/backend/uploads/documents")
# Docker volume path (fallback) - standardní umístění Docker volume na hostu
DOCKER_VOLUME_DIR = Path("/var/lib/docker/volumes/jmlp_documents_data/_data")

def resolve_documents_dir() -> Path:
    """Resolve where to store documents: prefer host project folder, else docker volume.

    Returns:
        Path: existing directory (created if needed)
    """
    # Prefer project-local uploads (easier for admins to inspect)
    if HOST_PREFERRED_DIR.exists() and HOST_PREFERRED_DIR.is_dir():
        return HOST_PREFERRED_DIR

    # If host preferred doesn't exist, try docker volume path
    if DOCKER_VOLUME_DIR.exists() and DOCKER_VOLUME_DIR.is_dir():
        return DOCKER_VOLUME_DIR

    # As a last resort, attempt to create the host preferred dir
    try:
        HOST_PREFERRED_DIR.mkdir(parents=True, exist_ok=True)
        return HOST_PREFERRED_DIR
    except Exception:
        # Try to create docker volume dir (may require root)
        try:
            DOCKER_VOLUME_DIR.mkdir(parents=True, exist_ok=True)
            return DOCKER_VOLUME_DIR
        except Exception:
            # Fall back to current working directory 'uploads/documents'
            fallback = Path.cwd() / "uploads" / "documents"
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback


# Resolved documents directory used by the script
DOCUMENTS_DIR = resolve_documents_dir()
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ADMIN_ID = 1  # ID admina, který provádí upload

def get_db_connection():
    """Vytvoří připojení k databázi."""
    try:
        connection = pymysql.connect(**DB_CONFIG)
        return connection
    except Exception as e:
        print(f"❌ Chyba připojení k databázi: {e}")
        sys.exit(1)

def detect_file_type(filename: str) -> str:
    """
    Automaticky detekuje typ souboru podle názvu.
    
    Args:
        filename: Název souboru
    
    Returns:
        str: Typ souboru (propozice/vysledky/celkove_vysledky/neprirazene)
    """
    filename_lower = filename.lower()
    
    # Kontrola pro celkové výsledky (musí být před "vysledky")
    if any(keyword in filename_lower for keyword in ['celkove', 'celkový', 'celkova', 'sezona', 'sezóna']):
        return 'celkove_vysledky'
    
    # Kontrola pro propozice
    if any(keyword in filename_lower for keyword in ['propozice', 'propozic', 'prop']):
        return 'propozice'
    
    # Kontrola pro výsledky
    if any(keyword in filename_lower for keyword in ['vysledky', 'vysledk', 'result', 'vysl']):
        return 'vysledky'
    
    return 'neprirazene'


def upload_file(file_path: Path, connection, file_type: str = None):
    """
    Nahraje jeden soubor do systému.
    
    Args:
        file_path: Cesta k souboru
        connection: DB připojení
        file_type: Typ souboru (propozice/vysledky/celkove_vysledky/neprirazene)
                   Pokud není zadán, detekuje se automaticky podle názvu
    
    Returns:
        tuple: (file_id, success, message, detected_type)
    """
    try:
        # Automatická detekce typu pokud není zadán
        if file_type is None:
            file_type = detect_file_type(file_path.name)
        
        # Kontrola velikosti
        file_size = file_path.stat().st_size
        if file_size > MAX_FILE_SIZE:
            return (None, False, f"Soubor příliš velký ({file_size / 1024 / 1024:.2f} MB > 10 MB)")
        
        # Generování UUID jména
        file_extension = file_path.suffix.lower()
        if file_extension != '.pdf':
            return (None, False, f"Pouze PDF soubory jsou podporovány, nalezen: {file_extension}")
        
        unique_filename = f"{uuid.uuid4().hex}{file_extension}"
        destination = DOCUMENTS_DIR / unique_filename
        
        # Kopírování souboru
        shutil.copy2(file_path, destination)
        
        # Nastavení vlastníka na appuser:appuser (UID 1000:1000) pro Docker container
        try:
            os.chown(destination, 1000, 1000)
        except Exception:
            # Pokud nemáme root práva, ignorujeme (soubor bude stále funkční)
            pass
        
        # Vložení do databáze
        cursor = connection.cursor()
        insert_query = """
            INSERT INTO fuj_jmlp_files 
            (original_filename, filename, file_path, file_size, mime_type, file_type, uploaded_by, uploaded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        now = datetime.now()
        values = (
            file_path.name,                          # original_filename
            unique_filename,                         # filename
            f"uploads/documents/{unique_filename}",  # file_path
            file_size,                               # file_size
            "application/pdf",                       # mime_type
            file_type,                               # file_type
            ADMIN_ID,                                # uploaded_by
            now                                      # uploaded_at
        )
        
        cursor.execute(insert_query, values)
        connection.commit()
        file_id = cursor.lastrowid
        cursor.close()
        
        return (file_id, True, f"✓ Úspěšně nahráno jako ID {file_id}", file_type)
        
    except Exception as e:
        return (None, False, f"❌ Chyba: {str(e)}", None)

def main():
    """Hlavní funkce skriptu."""
    # Kontrola argumentů
    if len(sys.argv) < 2:
        print("❌ Chybí cesta ke složce s PDF soubory")
        print(f"Použití: python3 {sys.argv[0]} /cesta/k/pdf/souborum/ [typ]")
        print(f"\n⚡ AUTOMATICKÁ DETEKCE TYPU:")
        print(f"   Skript automaticky rozpozná typ podle názvu souboru:")
        print(f"   - 'propozice', 'propozic', 'prop' → propozice")
        print(f"   - 'vysledky', 'vysledk', 'result' → vysledky")
        print(f"   - 'celkove', 'sezona' → celkove_vysledky")
        print(f"\n📝 Příklady názvů souborů:")
        print(f"   - propozice_brno_2025.pdf → automaticky 'propozice'")
        print(f"   - vysledky_pardubice.pdf → automaticky 'vysledky'")
        print(f"   - celkove_vysledky_2024_2025.pdf → automaticky 'celkove_vysledky'")
        print(f"\n🔧 Manuální přepsání typu:")
        print(f"   python3 {sys.argv[0]} /cesta/k/pdf/ propozice")
        print(f"   python3 {sys.argv[0]} /cesta/k/pdf/ vysledky")
        sys.exit(1)
    
    source_dir = Path(sys.argv[1])
    file_type = sys.argv[2] if len(sys.argv) > 2 else None  # None = auto-detect
    
    # Validace typu (pokud je zadán manuálně)
    valid_types = ["propozice", "vysledky", "celkove_vysledky", "neprirazene"]
    if file_type and file_type not in valid_types:
        print(f"❌ Neplatný typ souboru: {file_type}")
        print(f"Platné typy: {', '.join(valid_types)}")
        sys.exit(1)
    
    # Kontrola složky
    if not source_dir.exists() or not source_dir.is_dir():
        print(f"❌ Složka neexistuje: {source_dir}")
        sys.exit(1)
    
    # Kontrola cílové složky
    if not DOCUMENTS_DIR.exists():
        print(f"⚠️  Vytvářím cílovou složku: {DOCUMENTS_DIR}")
        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Najdi všechny PDF soubory
    pdf_files = list(source_dir.glob("*.pdf")) + list(source_dir.glob("*.PDF"))
    
    if not pdf_files:
        print(f"❌ Žádné PDF soubory nenalezeny v: {source_dir}")
        sys.exit(1)
    
    print(f"\n{'='*70}")
    print(f"  HROMADNÝ UPLOAD PDF DOKUMENTŮ")
    print(f"{'='*70}")
    print(f"Zdrojová složka: {source_dir}")
    print(f"Počet souborů:   {len(pdf_files)}")
    print(f"Typ souboru:     {'AUTO-DETEKCE podle názvu' if file_type is None else file_type.upper()}")
    print(f"Cílová složka:   {DOCUMENTS_DIR}")
    print(f"{'='*70}\n")
    
    # Připojení k databázi
    print("🔌 Připojuji se k databázi...")
    connection = get_db_connection()
    print("✓ Připojeno\n")
    
    # Upload souborů
    results = {
        'success': 0,
        'failed': 0,
        'total': len(pdf_files),
        'by_type': {
            'propozice': 0,
            'vysledky': 0,
            'celkove_vysledky': 0,
            'neprirazene': 0
        }
    }
    
    print("📤 Nahrávám soubory...\n")
    
    for idx, pdf_file in enumerate(pdf_files, 1):
        print(f"[{idx}/{len(pdf_files)}] {pdf_file.name:45s} ", end="")
        
        file_id, success, message, detected_type = upload_file(pdf_file, connection, file_type)
        
        if success:
            results['success'] += 1
            if detected_type:
                results['by_type'][detected_type] += 1
            type_badge = f"[{detected_type.upper()}]" if detected_type else ""
            print(f"{type_badge:20s} {message}")
        else:
            results['failed'] += 1
            print(f"{'':20s} {message}")
    
    # Uzavření připojení
    connection.close()
    
    # Výsledné shrnutí
    print(f"\n{'='*70}")
    print(f"  SOUHRN")
    print(f"{'='*70}")
    print(f"Celkem souborů:  {results['total']}")
    print(f"✓ Úspěšných:     {results['success']}")
    print(f"❌ Neúspěšných:   {results['failed']}")
    
    if results['success'] > 0:
        print(f"\n📊 Rozdělení podle typu:")
        for ftype, count in results['by_type'].items():
            if count > 0:
                print(f"   {ftype:20s} {count:3d} souborů")
    
    print(f"{'='*70}\n")
    
    if results['failed'] > 0:
        print("⚠️  Některé soubory se nepodařilo nahrát. Zkontrolujte chyby výše.")
        sys.exit(1)
    else:
        print("✅ Všechny soubory úspěšně nahrány!")
        print(f"\n💡 Soubory můžete přiřadit k závodům v admin rozhraní:")
        print(f"   http://80.211.223.80/admin/zavody")

if __name__ == "__main__":
    main()
