import pandas as pd
from sqlalchemy import create_engine
from pathlib import Path

# Připojení
user = "app"
password = "app"  # doplň své heslo
host = "localhost"
port = 3307
database = "jmlpcz"

engine = create_engine(
    f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"
)

# Složka s CSV
csv_dir = Path(r"C:\Users\micha\OneDrive\Dokumenty\jmlp_cz\jmlp_data\csv_output")

tables = [
    "fuj_jmlp_racer",
    "fuj_jmlp_areal",
    "fuj_jmlp_club",
    "fuj_jmlp_race"
]

with engine.begin() as conn:   # správně otevřený context manager
    for table in tables:
        csv_file = csv_dir / f"{table}.csv"
        print(f"📥 Nahrávám {csv_file} do tabulky {table}...")

        df = pd.read_csv(csv_file, encoding="utf-8")
        df.to_sql(table, con=conn, if_exists="append", index=False, method="multi")

print("✅ Všechna data byla úspěšně nahrána.")
