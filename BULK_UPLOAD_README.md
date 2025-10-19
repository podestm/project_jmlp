# Hromadný Upload Dokumentů - Návod

## 🚀 Rychlý start

### 1. Instalace závislostí

```bash
pip3 install pymysql
```

### 2. Příprava souborů

Umístěte všechny PDF soubory do jedné složky. **Pojmenujte je obsahující klíčová slova:**

```
/tmp/dokumenty/
├── propozice_brno_2025.pdf          → automaticky detekováno jako 'propozice'
├── JMLP_propozice_pardubice.pdf     → automaticky detekováno jako 'propozice'
├── vysledky_brno_2025.pdf           → automaticky detekováno jako 'vysledky'
├── result_pardubice.pdf             → automaticky detekováno jako 'vysledky'
└── celkove_vysledky_2024_2025.pdf   → automaticky detekováno jako 'celkove_vysledky'
```

### 3. Spuštění uploadu

**⚠️ Důležité:** Skript musí běžet s `sudo`, protože zapisuje do Docker volume:

```bash
# ⚡ DOPORUČENO: Automatická detekce podle názvu souboru
sudo python3 /opt/jmlp/bulk_upload_documents.py /tmp/dokumenty/

# Manuální přepsání typu (všechny soubory budou stejného typu)
sudo python3 /opt/jmlp/bulk_upload_documents.py /tmp/dokumenty/ propozice
```

## 🎯 Automatická detekce typu

Skript rozpozná typ dokumentu podle klíčových slov v názvu:

| Klíčová slova v názvu | Detekovaný typ |
|----------------------|----------------|
| `propozice`, `propozic`, `prop` | **propozice** |
| `vysledky`, `vysledk`, `result`, `vysl` | **vysledky** |
| `celkove`, `celkový`, `sezona`, `sezóna` | **celkove_vysledky** |
| *žádné klíčové slovo* | **neprirazene** |

### ✅ Správné názvy souborů:

```
✓ propozice_JMLP2025-01.pdf
✓ JMLP_2025_propozice_brno.pdf
✓ vysledky_zavod_01.pdf
✓ result_brno_2025.pdf
✓ celkove_vysledky_sezona_2024_2025.pdf
✓ vysledky_celkove_2025.pdf
```

### ❌ Problémy s detekcí:

Pokud název neobsahuje klíčová slova, dokument bude označen jako `neprirazene`:
```
⚠️ dokument123.pdf → neprirazene
⚠️ brno_2025.pdf   → neprirazene
```

**Řešení:** Přejmenujte soubor nebo použijte manuální typ.

## Co skript dělá

1. ✅ Zkontroluje všechny PDF soubory ve složce
2. ✅ Zkopíruje je do `/opt/jmlp/backend/uploads/documents/` s UUID jmény
3. ✅ Vytvoří záznamy v databázové tabulce `fuj_jmlp_files`
4. ✅ Soubory jsou okamžitě dostupné v admin rozhraní

## Omezení

- Maximální velikost souboru: **10 MB**
- Podporované formáty: **pouze PDF**
- Port databáze: **3307** (výchozí pro JMLP projekt)

## Po nahrání

Soubory můžete přiřadit k závodům v admin rozhraní:

🔗 http://80.211.223.80/admin/zavody

V editaci závodu vyberte nahraný dokument z dropdownu "Propozice" nebo "Výsledky".

## 📋 Příklad výstupu

```
======================================================================
  HROMADNÝ UPLOAD PDF DOKUMENTŮ
======================================================================
Zdrojová složka: /tmp/dokumenty
Počet souborů:   8
Typ souboru:     AUTO-DETEKCE podle názvu
Cílová složka:   /opt/jmlp/backend/uploads/documents
======================================================================

🔌 Připojuji se k databázi...
✓ Připojeno

📤 Nahrávám soubory...

[1/8] propozice_brno_2025.pdf                [PROPOZICE]      ✓ Úspěšně nahráno jako ID 45
[2/8] JMLP_propozice_pardubice.pdf           [PROPOZICE]      ✓ Úspěšně nahráno jako ID 46
[3/8] vysledky_brno.pdf                      [VYSLEDKY]       ✓ Úspěšně nahráno jako ID 47
[4/8] result_pardubice_2025.pdf              [VYSLEDKY]       ✓ Úspěšně nahráno jako ID 48
[5/8] celkove_vysledky_2024_2025.pdf         [CELKOVE_VYSLEDKY] ✓ Úspěšně nahráno jako ID 49
[6/8] dokument.pdf                           [NEPRIRAZENE]    ✓ Úspěšně nahráno jako ID 50
...

======================================================================
  SOUHRN
======================================================================
Celkem souborů:  8
✓ Úspěšných:     8
❌ Neúspěšných:   0

📊 Rozdělení podle typu:
   propozice              2 souborů
   vysledky               3 souborů
   celkove_vysledky       2 souborů
   neprirazene            1 souborů
======================================================================

✅ Všechny soubory úspěšně nahrány!
```

## Řešení problémů

### Chyba připojení k databázi

Zkontrolujte, že běží MySQL kontejner:
```bash
docker ps | grep jmlp-db
```

### Složka uploads/documents neexistuje

Skript ji vytvoří automaticky. Pokud máte problémy s právy:
```bash
sudo chown -R $USER:$USER /opt/jmlp/backend/uploads/
```

### Soubory se nezobrazují v admin rozhraní

Zkontrolujte, že jsou v databázi:
```bash
docker exec jmlp-db mysql -ujmlpuser -pjmlppassword jmlpcz \
  -e "SELECT id, original_filename, file_type FROM fuj_jmlp_files ORDER BY id DESC LIMIT 10;"
```

## Poznámky

- Skript **nekontroluje duplicity** - stejný soubor můžete nahrát vícekrát
- UUID jména zajišťují, že se **nepřepíšou existující soubory**
- Původní název souboru je uložen v databázi pro snadné vyhledání
