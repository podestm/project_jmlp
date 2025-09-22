import xml.etree.ElementTree as ET
import csv
from pathlib import Path

# Složka, kde máš XML soubory
input_dir = Path(r"C:\Users\micha\OneDrive\Dokumenty\jmlp_cz\jmlp_data")

# Výstupní složka pro CSV
output_dir = input_dir / "csv_output"
output_dir.mkdir(exist_ok=True)

# Seznam XML souborů
xml_files = [
    "fuj_jmlp_racer.xml",
    "fuj_jmlp_areal.xml",
    "fuj_jmlp_club.xml",
    "fuj_jmlp_race.xml"
]

for xml_name in xml_files:
    xml_file = input_dir / xml_name
    tree = ET.parse(xml_file)
    root = tree.getroot()

    # Najdeme první <table>, z něho vezmeme jméno tabulky
    tables = root.findall(".//table")
    if not tables:
        print(f"⚠️ {xml_name}: žádná data nenačtena")
        continue

    table_name = tables[0].attrib.get("name")
    csv_file = output_dir / f"{table_name}.csv"

    # Sloupce podle první řádky
    first_row = tables[0].findall("column")
    columns = [col.attrib["name"] for col in first_row]

    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)

        for row in tables:
            row_data = []
            for col_name in columns:
                col_elem = row.find(f"column[@name='{col_name}']")
                val = col_elem.text if col_elem is not None else None
                if val == "NULL":
                    val = None
                row_data.append(val)
            writer.writerow(row_data)

    print(f"✅ Exportováno: {csv_file}")