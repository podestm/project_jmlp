# JMLP – Registrační systém závodů

Full‑stack systém pro správu závodů a registrací české "Jezerní Motolodní Liga Pardubice". Backend běží na FastAPI, frontend na Reactu (Vite), databáze je MySQL. Projekt je plně dockerizovaný a připravený pro vývoj i produkci.

**Tento README je jediným zdrojem pravdy** – veškerá dokumentace, bezpečnost, provoz i troubleshooting jsou sjednoceny v tomto souboru.

## 📑 Obsah

1. [Přehled a architektura](#přehled-a-architektura)
2. [Rychlý start (Development)](#rychlý-start-development)
3. [Produkční nasazení](#produkční-nasazení)
4. [Konfigurace (.env)](#konfigurace-env)
5. [Docker služby a porty](#docker-služby-a-porty)
6. [Databáze a inicializace](#databáze-a-inicializace)
7. [Soubory a úložiště dokumentů](#soubory-a-úložiště-dokumentů)
8. [Sezónní logika](#sezónní-logika)
9. [Admin přístup a autentifikace](#admin-přístup-a-autentifikace)
10. [Správa Docker Volumes](#správa-docker-volumes)
11. [Bezpečný restart služeb](#bezpečný-restart-služeb)
12. [Záloha a obnova dat](#záloha-a-obnova-dat)
13. [Monitoring a logy](#monitoring-a-logy)
14. [API přehled](#api-přehled)
15. [Frontend](#frontend)
16. [Troubleshooting](#troubleshooting)
17. [🔒 Bezpečnost](#-bezpečnost)
18. [Legacy rozhodnutí a poznámky](#legacy-rozhodnutí-a-poznámky)
19. [Kontakt a podpora](#kontakt-a-podpora)

---

## Přehled a architektura

### Systémové komponenty

Backend (FastAPI + SQLAlchemy) a React frontend běží v Docker kontejnerech. Databáze MySQL používá engine MyISAM kvůli zpětné kompatibilitě s legacy daty (bez cizích klíčů). Nahrané dokumenty se ukládají do persistentního Docker volume.

```
frontend (Vite/React, Nginx v prod)  ←→  backend (FastAPI, Uvicorn)  ←→  MySQL 8
                                     │                                   │
                                     └────────── uploads/documents (volume)
```

### Klíčové technologie

- **Backend**: FastAPI 0.104+, SQLAlchemy 2.0+, PyMySQL, JWT autentifikace
- **Frontend**: React 18+, Vite 5+, React Router 6, Bootstrap 5
- **Databáze**: MySQL 8.0 s MyISAM engine
- **Kontejnerizace**: Docker + Docker Compose
- **Web server (prod)**: Nginx s security headers

### Klíčové rysy

- JWT autentifikace pro admin rozhraní (30 minut token lifetime)
- Ručně psané SQL dotazy (lepší kontrola nad kódováním a výkonností)
- UTF8MB4 v celém stacku (podpora českých znaků)
- CSV exporty s BOM (Excel kompatibilita)
- UUID názvy souborů (prevence path traversal)
- Non-root kontejnery v produkci
- Persistent volumes pro databázi a dokumenty

---

## Rychlý start (Development)

```bash
docker compose up --build
```

Otevřete:
- Frontend: http://localhost:3000
- Admin: http://localhost:3000/admin
- API docs: http://localhost:8000/docs

Výchozí admin (změňte v prod): `admin@jmlp.cz` / `admin123`

Databáze se při prvním startu naplní podle `db/init_exact.sql`.

---

## Produkční nasazení

1) Připravte `.env` se silnými hodnotami (viz níže) a doménami.

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Po nasazení ihned změňte admin heslo.

### Development vs Production

| Komponenta | Development | Production |
|---|---|---|
| Frontend | Vite (3000) | Nginx (80) |
| Backend | 1 worker | 4 workers, non-root |
| DB | Port 3307 exposed | internal only |
| Volumes | source bind | data-only |
| Security headers | základní | zapnuté |

---

## Konfigurace (.env)

Příklad klíčů:

```bash
# Backend
DATABASE_URL=mysql+pymysql://app:app@db:3306/jmlpcz?charset=utf8mb4
SECRET_KEY=<silný klíč>
CORS_ORIGINS=http://localhost:3000
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend
VITE_API_BASE=http://localhost:8000

# MySQL (prod)
MYSQL_ROOT_PASSWORD=<min 16 znaků>
MYSQL_PASSWORD=<min 16 znaků>
```

---

## Docker služby a porty

- Frontend: 3000 (dev) / 80 (prod přes Nginx)
- Backend: 8000
- MySQL: 3307 (dev z hosta), interně 3306

Zdraví kontejneru ověříte přes `docker ps` a healthchecky.

---

## Databáze a inicializace

- Init skript: `db/init_exact.sql` (přesné schéma dle produkce)
- Primární klíče: BIGINT
- Engine: MyISAM
- Kódování: UTF8MB4

Přístup do DB (dev):

```bash
docker exec -it jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz
```

---

## Soubory a úložiště dokumentů

- Volume: `jmlp_documents_data`
- Mount v backendu: `/app/uploads/documents/`
- Ukládání: UUID názvy, metadata v DB

Statistiky úložiště (přes admin API používající `file_size` z DB):

```bash
# získej token
TOKEN=$(curl -s -X POST http://localhost:8080/admin/auth/login \
   -H "Content-Type: application/json" \
   -d '{"email":"admin@jmlp.cz","password":"admin123"}' \
   | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -H "Authorization: Bearer $TOKEN" \
   "http://localhost:8080/admin/files/storage-stats" | python3 -m json.tool
```

---

## Sezónní logika

Sezóny běží od 1. srpna do 31. července. Logika filtrování podle sezóny je centralizovaná v backendu (`utils.py`).

---

## Admin přístup a autentifikace

### Výchozí přihlašovací údaje

**⚠️ KRITICKÉ: Změňte okamžitě po prvním nasazení!**

```
Email: admin@jmlp.cz
Heslo: admin123
```

### Změna admin hesla

**Metoda 1: Přes Python skript (doporučeno)**

```bash
docker exec -it jmlp-backend python -c "
from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import AdminUser

db = SessionLocal()
admin = db.query(AdminUser).filter(AdminUser.email == 'admin@jmlp.cz').first()
if admin:
    admin.hashed_password = get_password_hash('NOVE_SILNE_HESLO')
    db.commit()
    print('✅ Heslo změněno!')
db.close()
"
```

**Metoda 2: Přes databázi**

```bash
# Vygenerujte hash hesla
docker exec -it jmlp-backend python -c "
from app.auth import get_password_hash
print(get_password_hash('NOVE_SILNE_HESLO'))
"

# Poté aktualizujte v databázi
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "UPDATE fuj_jmlp_admin SET hashed_password = 'VYGENEROVANY_HASH' WHERE email = 'admin@jmlp.cz';"
```

### JWT konfigurace

- **Token lifetime**: 30 minut (nastavitelné v `.env` - `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Algorithm**: HS256
- **Secret key**: Z environment variable `SECRET_KEY` (NIKDY v kódu!)
- **Storage**: Client-side v localStorage (frontend)

### Bezpečnostní opatření

- **Hesla**: Bcrypt hash s 12 rounds
- **Token invalidace**: Restart backendu zneplatní všechny aktivní tokeny
- **CORS**: Omezeno na povolené domény (nastavit `CORS_ORIGINS` v produkci)

---

## Správa Docker Volumes

### 🔒 Ochrana dat při rebuildu

Aplikace používá **persistentní Docker volumes** pro uchování dat:

- **`jmlp_db_data`** - MySQL databáze (všechny tabulky, závodníci, závody, registrace)
- **`jmlp_documents_data`** - Nahrané soubory (PDF, obrázky, dokumenty)

**⚠️ DŮLEŽITÉ:** Volumes zůstávají zachovány i při rebuildu kontejnerů!

### ✅ Bezpečný postup pro restart

Používejte připravené skripty nebo manuální příkazy:

#### Backend restart

```bash
# Pomocí skriptu (doporučeno)
cd /opt/jmlp
./restart-backend.sh

# Nebo manuálně
docker stop jmlp-backend
docker rm jmlp-backend
docker-compose -f docker-compose.server.yml build backend
docker-compose -f docker-compose.server.yml up -d backend
```

#### Frontend restart

```bash
# Pomocí skriptu (doporučeno)
cd /opt/jmlp
./restart-frontend.sh

# Nebo manuálně
docker stop jmlp-frontend
docker rm jmlp-frontend
docker-compose -f docker-compose.server.yml build frontend
docker-compose -f docker-compose.server.yml up -d frontend
```

#### Restart všech služeb

```bash
docker-compose -f docker-compose.server.yml restart
# nebo pro development
docker-compose restart
```

### ⚠️ Co NIKDY nedělat

**NEPOUŽÍVEJTE tyto příkazy - smažou všechna data:**

```bash
docker-compose down -v              # ❌ Smaže všechny volumes!
docker volume rm jmlp_documents_data  # ❌ Ztratíte soubory!
docker volume rm jmlp_db_data        # ❌ Ztratíte databázi!
docker volume prune                  # ❌ Smaže nepoužívané volumes!
```

### 🔍 Kontrola volumes

#### Seznam všech volumes

```bash
docker volume ls | grep jmlp
```

Očekávaný výstup:
```
local     jmlp_db_data
local     jmlp_documents_data
```

#### Kontrola obsahu documents volume

```bash
# Z kontejneru
docker exec jmlp-backend ls -la /app/uploads/documents/

# Přímo na hostu (vyžaduje sudo)
sudo ls -la /var/lib/docker/volumes/jmlp_documents_data/_data/
```

#### Statistika úložiště (přes API)

```bash
# 1. Získat JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jmlp.cz","password":"admin123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 2. Zjistit velikost úložiště
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/admin/files/storage-stats" | python3 -m json.tool
```

**Poznámka:** Storage stats endpoint používá `file_size` z databáze, takže funguje i když soubory fyzicky chybí.

### 📁 Struktura úložiště

#### Na hostu

```
/var/lib/docker/volumes/
├── jmlp_db_data/           # MySQL data
│   └── _data/
│       ├── jmlpcz/         # Databázové soubory
│       ├── mysql/
│       └── ...
└── jmlp_documents_data/    # Nahrané soubory
    └── _data/
        ├── 978b9d5ce26f4acfb1b3cc2411a0a241.jpg
        ├── 67c5de63315f4072a31d4ca1288d2de3.pdf
        └── ... (UUID názvy)
```

#### V kontejnerech

- **Backend**: `/app/uploads/documents/` → mountuje `jmlp_documents_data`
- **Databáze**: `/var/lib/mysql/` → mountuje `jmlp_db_data`

---

## Bezpečný restart služeb

### Přehled restart skriptů

Projekt obsahuje připravené skripty pro bezpečný restart bez ztráty dat:

```bash
./restart-backend.sh   # Rebuild a restart backendu
./restart-frontend.sh  # Rebuild a restart frontendu
```

### Kdy restartovat

- **Backend restart**: Po změnách Python kódu, requirements.txt, Dockerfile
- **Frontend restart**: Po změnách React kódu, package.json, nginx.conf
- **DB restart**: Pouze při problémech (zachovává data)
- **Celý stack**: `docker-compose restart` (bez rebuildu)

### Doporučený workflow pro změny kódu

```bash
# 1. Před změnami v kódu (volitelný backup)
docker exec jmlp-db mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Proveďte změny v kódu

# 3. Rebuild a restart (podle komponenty)
./restart-backend.sh   # nebo ./restart-frontend.sh

# 4. Ověření
docker ps              # Zkontrolovat health status
docker logs jmlp-backend --tail 50  # Zkontrolovat logy

# 5. Po restartu
# ✅ Data v databázi: Zachována
# ✅ Nahrané soubory: Zachovány
# ✅ Kód aplikace: Aktualizován
```

---

## Záloha a obnova dat

### Databázové zálohy

#### Ruční backup

```bash
# Jednorázový backup (bezpečná metoda bez warninku)
docker exec jmlp-db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz' > backup.sql

# Backup s časovou značkou
docker exec jmlp-db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz' > backup_$(date +%Y%m%d_%H%M%S).sql

# Komprimovaný backup
docker exec jmlp-db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz' | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Poznámka:** Použití `sh -c` zabrání warninku "Using a password on the command line interface can be insecure".

#### Automatické zálohy (cron)

```bash
# Přidat do crontabu (crontab -e)
# Denní backup ve 2:00 ráno
0 2 * * * docker exec jmlp-db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz' | gzip > /backups/jmlp_$(date +\%Y\%m\%d).sql.gz

# Týdenní rotace (zachovat pouze 7 posledních)
0 3 * * 0 find /backups -name "jmlp_*.sql.gz" -mtime +7 -delete
```

#### Restore databáze

```bash
# Z běžného SQL souboru (bezpečná metoda)
docker exec -i jmlp-db sh -c 'mysql -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz' < backup.sql

# Z komprimovaného souboru
gunzip < backup.sql.gz | docker exec -i jmlp-db sh -c 'mysql -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz'
```
```

### Záloha Docker volumes

#### Backup documents volume

```bash
# Vytvoří tar.gz archiv všech nahraných souborů
docker run --rm -v jmlp_documents_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/documents_backup_$(date +%Y%m%d).tar.gz /data
```

#### Restore documents volume

```bash
# Obnoví soubory z archivu
docker run --rm -v jmlp_documents_data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/documents_backup.tar.gz -C /
```

#### Kompletní backup obou volumes

```bash
#!/bin/bash
# backup_all.sh - Kompletní záloha databáze i souborů

BACKUP_DIR="/backups/jmlp"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup databáze (bezpečná metoda)
docker exec jmlp-db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz' | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup documents
docker run --rm -v jmlp_documents_data:/data -v $BACKUP_DIR:/backup \
  ubuntu tar czf /backup/documents_$DATE.tar.gz /data

echo "✅ Záloha dokončena: $BACKUP_DIR"
ls -lh $BACKUP_DIR/*$DATE*
```

### 🔧 Řešení problémů s volumes

#### Problém: Soubory se ztratily po rebuildu

**Diagnóza:**

```bash
# 1. Zkontrolovat, jestli volume existuje
docker volume ls | grep documents

# 2. Zkontrolovat obsah
docker exec jmlp-backend ls -la /app/uploads/documents/

# 3. Zkontrolovat záznamy v databázi
docker exec -i jmlp-db mysql -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT COUNT(*) as total_files, SUM(file_size) as total_size FROM fuj_jmlp_files;"
```

**Řešení:**
- Volumes jsou zachovány, soubory mohou být na jiné cestě
- Zkontrolovat mount points v `docker-compose.yml`
- Storage stats endpoint používá `file_size` z databáze

#### Problém: Volume chybí

```bash
# Volume se automaticky vytvoří při startu
docker-compose -f docker-compose.server.yml up -d backend
```

#### Problém: Nekonzistentní data v databázi

**SQL dotazy pro správu záznamů:**

```bash
# Zobrazit soubory v databázi
docker exec -i jmlp-db mysql -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT id, original_filename, file_path, file_size, uploaded_at FROM fuj_jmlp_files ORDER BY uploaded_at DESC LIMIT 20;"

# Zkontrolovat, které soubory fyzicky existují
docker exec jmlp-backend bash -c '
for file in /app/uploads/documents/*; do
  if [ -f "$file" ]; then
    basename "$file"
  fi
done
'

# Smazat konkrétní záznam (pokud soubor neexistuje)
docker exec -i jmlp-db mysql -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "DELETE FROM fuj_jmlp_files WHERE id = X;"
```

---

## Monitoring a logy

### Zobrazení logů

```bash
# Všechny logy
docker-compose logs --follow

# Konkrétní služba
docker logs jmlp-backend --tail 100 --follow
docker logs jmlp-frontend --tail 100 --follow
docker logs jmlp-db --tail 100 --follow

# Logy za časové období
docker logs jmlp-backend --since 1h
docker logs jmlp-backend --since "2024-01-01T00:00:00"
```

### Monitoring kontejnerů

```bash
# Status kontejnerů
docker ps

# Spotřeba zdrojů (CPU, RAM, síť)
docker stats

# Health check status
docker inspect jmlp-backend | grep -A 5 Health

# Verze obrazů
docker images | grep jmlp
```

### Admin dashboard monitoring

Dashboard v admin rozhraní (`/admin`) zobrazuje:

- **Velikost souborů** - Celková velikost nahraných souborů (z DB `file_size`)
- **Počet souborů** - Počet záznamů v databázi
- **Návštěvy (7 dní)** - Statistika návštěvnosti z `fuj_jmlp_visitor_log`

### API monitoring

```bash
# Testování backend health
curl http://localhost:8000/health

# API dokumentace
open http://localhost:8000/docs  # nebo browse ručně
```

### Nginx konfigurace (produkce)

```bash
# Test konfigurace
docker exec jmlp-frontend nginx -t

# Reload konfigurace
docker exec jmlp-frontend nginx -s reload
```

### Podezřelá aktivita - logování

```bash
# Zkontrolovat API logy (neautorizované pokusy)
docker logs jmlp-backend --tail 1000 | grep "401\|403"

# Zkontrolovat failed login attempts
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT * FROM fuj_jmlp_visitor_log WHERE path = '/admin/auth/login' ORDER BY visited_at DESC LIMIT 50;"

# Zkontrolovat admin přístupy
docker logs jmlp-backend | grep "admin"
```

---

## API přehled

Veřejné API:
- GET `/races/`, `/races/{id}`, `/races/{id}/registrations`, `/races/{id}/club-stats`
- GET `/racers/`, `/clubs/`
- POST `/racers/`, `/registrations/`
- GET `/posts/`

Admin API (`/admin`):
- POST `/admin/login`
- GET `/admin/races/`, `/admin/races/{id}/registrations`, export CSV, upload dokumentů
- GET `/admin/posts/`, `/admin/documents/`, `/admin/racers/`

Swagger UI: `http://localhost:8000/docs`

---

## Frontend

Veřejné stránky:
- `/` – homepage (aktuality + nadcházející závody)
- `/terminovka` – přehled závodů
- `/zavod/:id` – detail závodu
- `/archiv` – archiv závodů / zpráv

Admin rozhraní: `/admin` (React Router, JWT v LocalStorage, chráněné routy).

---

## Troubleshooting

### Databázové problémy

#### DB neodpovídá

```bash
# Zkontrolovat, že kontejner běží
docker ps | grep jmlp-db

# Zkontrolovat logy
docker logs jmlp-db --tail 50

# Restart databáze (zachovává data)
docker restart jmlp-db

# Test připojení
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT 1;"
```

#### Kódování českých znaků

```bash
# Zkontrolovat charset
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SHOW VARIABLES LIKE 'character_set%';"

# Oprava dat s špatným kódováním
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "UPDATE fuj_jmlp_racer SET name = CONVERT(CONVERT(name USING binary) USING utf8mb4);"
```

### Problémy s volumes

#### Soubory po rebuildu chybí

```bash
# 1. Zkontrolovat, že volume existuje
docker volume ls | grep jmlp

# 2. Zkontrolovat mount v kontejneru
docker inspect jmlp-backend | grep -A 10 Mounts

# 3. Zkontrolovat obsah
docker exec jmlp-backend ls -la /app/uploads/documents/

# 4. Porovnat s DB záznamy
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT file_path, original_filename FROM fuj_jmlp_files LIMIT 10;"
```

**Poznámka:** Storage stats endpoint používá `file_size` z databáze, takže funguje i když soubory fyzicky chybí.

#### Volume se chybně smazal

```bash
# Obnovit z backupu
gunzip < backup.sql.gz | docker exec -i jmlp-db mysql -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz

docker run --rm -v jmlp_documents_data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/documents_backup.tar.gz -C /
```

### Backend problémy

#### Health check selhává

```bash
# Zkontrolovat logy
docker logs jmlp-backend --tail 100

# Zkontrolovat health endpoint
curl http://localhost:8000/health

# Zkontrolovat DB připojení
docker exec jmlp-backend python -c "from app.database import engine; print(engine.execute('SELECT 1').scalar())"
```

#### ImportError nebo ModuleNotFoundError

```bash
# Zkontrolovat nainstalované balíčky
docker exec jmlp-backend pip list

# Reinstall dependencies
docker-compose build --no-cache backend
docker-compose up -d backend
```

#### UTF-8 encoding errors

Ujistěte se, že všechna připojení k DB používají `charset=utf8mb4`:

```python
# V connection stringu
DATABASE_URL=mysql+pymysql://user:pass@host/db?charset=utf8mb4
```

### Frontend problémy

#### Bílá obrazovka po buildu

```bash
# Zkontrolovat Nginx logy
docker logs jmlp-frontend --tail 100

# Zkontrolovat build
docker exec jmlp-frontend ls -la /usr/share/nginx/html/

# Zkontrolovat VITE_API_BASE v .env
docker exec jmlp-frontend env | grep VITE
```

#### API volání selhávají (CORS)

```bash
# Zkontrolovat CORS nastavení v backendu
docker logs jmlp-backend | grep CORS

# V .env backend zkontrolovat
CORS_ORIGINS=http://localhost:3000,https://vase-domena.cz
```

### Síťové problémy

#### Kontejnery se nevidí

```bash
# Zkontrolovat síť
docker network ls
docker network inspect jmlp_default

# Restartovat stack
docker-compose down
docker-compose up -d
```

#### Port conflict

```bash
# Zkontrolovat, co běží na portu
sudo lsof -i :3000
sudo lsof -i :8000
sudo lsof -i :3307

# Zastavit konfliktní službu nebo změnit port v docker-compose.yml
```

### Performance problémy

#### Pomalé SQL dotazy

```bash
# Zapnout slow query log
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "SET GLOBAL slow_query_log = 'ON'; SET GLOBAL long_query_time = 2;"

# Sledovat slow queries
docker exec jmlp-db tail -f /var/lib/mysql/slow-query.log
```

#### Vysoká spotřeba paměti

```bash
# Zkontrolovat spotřebu
docker stats --no-stream

# Restartovat kontejner s limitem
docker update --memory 1g jmlp-backend
```

### Bezpečnostní incidenty

#### Kompromitované heslo

```bash
# 1. Okamžitě změnit všechny hesla (viz sekce Admin přístup)
# 2. Restartovat backend (zneplatnit JWT tokeny)
docker restart jmlp-backend

# 3. Zkontrolovat databázi na neautorizované změny
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT * FROM fuj_jmlp_admin ORDER BY created_at DESC;"

# 4. Zkontrolovat logy
docker logs jmlp-backend | grep -i "login\|auth\|admin"
```

#### Suspected SQL injection

```bash
# Zkontrolovat query logy (pokud enabled)
docker logs jmlp-backend | grep "SELECT\|INSERT\|UPDATE\|DELETE"

# Zkontrolovat strukturu tabulek
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SHOW TABLES; DESCRIBE fuj_jmlp_racer;"

# Obnovit z backupu pokud nutné
```

### Testování a diagnostika

```bash
# Backend API test
curl http://localhost:8000/docs

# Frontend build test
docker exec jmlp-frontend nginx -t

# DB connection test
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz -e "SELECT COUNT(*) FROM fuj_jmlp_racer;"

# Volume inspection
docker volume inspect jmlp_db_data
docker volume inspect jmlp_documents_data
```

---

## 🔒 Bezpečnost

### ⚠️ KRITICKÉ: První kroky po nasazení

#### 1. Změnit default admin heslo

**Ihned po prvním nasazení:**

```bash
docker exec -it jmlp-backend python -c "
from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import AdminUser

db = SessionLocal()
admin = db.query(AdminUser).filter(AdminUser.email == 'admin@jmlp.cz').first()
if admin:
    admin.hashed_password = get_password_hash('NOVE_SILNE_HESLO')
    db.commit()
    print('✅ Heslo změněno!')
db.close()
"
```

**Požadavky na heslo:**
- Minimálně 12 znaků
- Kombinace malých a velkých písmen, čísel, speciálních znaků
- Nepoužívat slovníková slova

#### 2. Nastavit produkční .env

Vytvořte `.env` soubor s **silnými, náhodnými hesly**:

```bash
# Database
MYSQL_ROOT_PASSWORD=<min. 16 náhodných znaků>
MYSQL_PASSWORD=<min. 16 náhodných znaků>
MYSQL_DATABASE=jmlpcz
MYSQL_USER=app

# Backend
DATABASE_URL=mysql+pymysql://app:MYSQL_PASSWORD@db:3306/jmlpcz?charset=utf8mb4
SECRET_KEY=<min. 32 náhodných znaků>
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=https://vase-domena.cz

# Frontend
VITE_API_BASE=https://vase-domena.cz/api
```

**Generování bezpečných hesel:**

```bash
# Linux/Mac - OpenSSL
openssl rand -base64 24

# Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Bash
head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo
```

#### 3. Firewall a síťová bezpečnost

```bash
# Ubuntu/Debian - UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp    # SSH - změnit port v produkci
sudo ufw enable
sudo ufw status

# CentOS/RHEL - Firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### 4. SSL/TLS certifikát (HTTPS)

```bash
# Instalace Certbot
sudo apt install certbot python3-certbot-nginx

# Získání certifikátu (Let's Encrypt)
sudo certbot --nginx -d vase-domena.cz -d www.vase-domena.cz

# Automatická obnova
sudo certbot renew --dry-run

# Cron pro automatickou obnovu
0 3 * * * certbot renew --quiet
```

### 🔐 Implementovaná bezpečnostní opatření

#### JWT Autentifikace
- **Token lifetime:** 30 minut (konfigurovatelné)
- **Algorithm:** HS256
- **Secret key:** Z environment variable (NIKDY v kódu!)
- **Storage:** Client-side localStorage
- **Invalidace:** Restart backendu zneplatní všechny tokeny

#### Databázová bezpečnost
- **Hesla:** Bcrypt hash (12 rounds)
- **MySQL user:** Omezená práva (ne root v produkci)
- **Port binding:** `127.0.0.1:3307` (pouze localhost v dev)
- **SQL Injection:** Parametrizované dotazy (SQLAlchemy/PyMySQL)

#### Docker kontejnery
- **Non-root user:** Kontejnery běží jako `appuser` (UID 1000)
- **Internal network:** Backend a DB nejsou přímo přístupné zvenčí
- **Health checks:** Automatická kontrola stavu služeb
- **Read-only filesystem:** Kde možné

#### HTTP hlavičky (Nginx)

Frontend `nginx.conf` obsahuje security headers:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

#### File Upload
- **Max size:** 10MB (konfigurovatelné)
- **Allowed types:** `.pdf`, `.doc`, `.docx`, `.txt`, `.jpg`, `.jpeg`, `.png`, `.xlsx`, `.xls`, `.csv`
- **Filename:** UUID (prevence path traversal)
- **Storage:** Persistent volume mimo webroot (`/app/uploads/documents/`)
- **Validation:** MIME type check + extension check

### 🚨 TODO před produkcí

#### Checklist

- [ ] **SSL/TLS certifikát nainstalován** (Let's Encrypt nebo komerční)
- [ ] **`.env` obsahuje silná hesla** (min. 16 znaků, náhodné)
- [ ] **Admin default heslo změněno** (`admin123` → silné heslo)
- [ ] **`SECRET_KEY` je náhodný string** (min. 32 znaků)
- [ ] **`CORS_ORIGINS` obsahuje jen produkční domény** (ne `localhost`)
- [ ] **MySQL není exposed navenek** (pouze internal Docker network)
- [ ] **Firewall povoluje pouze 80/443/22** (SSH na nestandardním portu)
- [ ] **Rate limiting nakonfigurován** (Nginx nebo Cloudflare)
- [ ] **Databázové zálohy nastaveny** (denní cron job)
- [ ] **Monitoring a alerting** (Uptime Robot, Sentry, apod.)
- [ ] **Log rotation nakonfigurována** (logrotate nebo Docker logging)
- [ ] **SSH přístup pouze klíčem** (zakázat password auth)
- [ ] **Fail2ban nainstalován** (ochrana proti brute-force)

#### Rate Limiting (Nginx)

```nginx
# V nginx.conf
http {
    # Definovat zónu pro rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    server {
        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend:8000;
        }
        
        # Login endpoint
        location /api/admin/auth/login {
            limit_req zone=login burst=3 nodelay;
            proxy_pass http://backend:8000;
        }
    }
}
```

#### Automatické databázové zálohy

```bash
# Vytvořit backup skript
cat > /opt/jmlp/backup_database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/jmlp"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR

# Backup databáze (bezpečná metoda bez warninku)
docker exec jmlp-db sh -c 'mysqldump -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz' | gzip > $BACKUP_DIR/jmlp_db_$DATE.sql.gz

# Smazat staré zálohy
find $BACKUP_DIR -name "jmlp_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ Záloha dokončena: $BACKUP_DIR/jmlp_db_$DATE.sql.gz"
EOF

chmod +x /opt/jmlp/backup_database.sh

# Přidat do crontabu (crontab -e)
0 2 * * * /opt/jmlp/backup_database.sh >> /var/log/jmlp_backup.log 2>&1
```

#### Monitoring & Logging

```bash
# Docker logs s rotací
# V /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Restart Docker po změně
sudo systemctl restart docker

# Zobrazení logů
docker-compose -f docker-compose.prod.yml logs --follow --tail 100
```

### 🔍 Security Audit

#### Kontrola bezpečnosti

```bash
# 1. Zkontrolovat exposed porty
sudo netstat -tulpn | grep LISTEN

# 2. Zkontrolovat běžící kontejnery
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 3. Zkontrolovat .env soubor (nesmí být v Gitu)
cat .gitignore | grep .env

# 4. Zkontrolovat SSL certifikát
openssl s_client -connect vase-domena.cz:443 -servername vase-domena.cz

# 5. Zkontrolovat security headers
curl -I https://vase-domena.cz | grep -E "X-Frame-Options|X-Content-Type|X-XSS"

# 6. Zkontrolovat CORS
curl -H "Origin: https://evil.com" -I https://vase-domena.cz/api/races/

# 7. Zkontrolovat admin endpoints
curl https://vase-domena.cz/api/admin/races/  # mělo by vrátit 401
```

#### Pravidelná údržba

- **Denně:** Kontrola logů na podezřelou aktivitu
- **Týdně:** Review admin přístupů a změn v databázi
- **Měsíčně:** 
  - Update Docker images (`docker-compose pull && docker-compose up -d`)
  - Security scan (`docker scan jmlp-backend:latest`)
  - Test obnovy z backupu
- **Čtvrtletně:**
  - Penetration testing
  - Review security checklist
  - Update dependencies (`pip-audit`, `npm audit`)

### 🛡️ Incident Response

#### Podezřelá aktivita

```bash
# 1. Zkontrolovat API logy (neautorizované pokusy)
docker logs jmlp-backend --tail 1000 | grep "401\|403"

# 2. Zkontrolovat failed login attempts
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT * FROM fuj_jmlp_visitor_log WHERE path = '/admin/auth/login' ORDER BY visited_at DESC LIMIT 50;"

# 3. Zkontrolovat admin přístupy
docker logs jmlp-backend | grep "admin" | grep -v "GET /admin/auth/check"

# 4. Zkontrolovat změny v databázi
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT * FROM fuj_jmlp_race ORDER BY created_at DESC LIMIT 20;"
```

#### Kompromitované heslo

**Postup:**

1. **Okamžitě změnit všechna hesla** (admin, DB root, DB app user)
2. **Restartovat backend** (zneplatnit všechny JWT tokeny)
   ```bash
   docker restart jmlp-backend
   ```
3. **Zkontrolovat databázi** na neautorizované změny
4. **Zkontrolovat logy** za posledních 7 dní
5. **Obnovit z backupu** pokud nutné

#### Suspected SQL Injection

```bash
# 1. Zkontrolovat query logi (pokud enabled)
docker logs jmlp-backend | grep "SELECT\|INSERT\|UPDATE\|DELETE"

# 2. Zkontrolovat strukturu tabulek
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SHOW TABLES; DESCRIBE fuj_jmlp_racer;"

# 3. Zkontrolovat podezřelé záznamy
docker exec -i jmlp-db mysql -u root -p$MYSQL_ROOT_PASSWORD jmlpcz \
  -e "SELECT * FROM fuj_jmlp_racer WHERE name LIKE '%SELECT%' OR name LIKE '%UNION%';"

# 4. Obnovit z backupu pokud nutné
gunzip < backup_latest.sql.gz | docker exec -i jmlp-db mysql -uroot -p$MYSQL_ROOT_PASSWORD jmlpcz
```

### 📧 Kontakt

Pro nahlášení bezpečnostního problému:
- **Email:** security@vase-domena.cz
- **Response time:** Do 24 hodin
- **Encrypted contact:** PGP key na vyžádání

### 📖 Security Reference

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [MySQL Security Guidelines](https://dev.mysql.com/doc/refman/8.0/en/security-guidelines.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Legacy rozhodnutí a poznámky

### Architektonická rozhodnutí

1. **MyISAM over InnoDB** 
   - Důvod: Kompatibilita s legacy daty z původního systému
   - Důsledek: Žádné cizí klíče (foreign keys), manuální správa vztahů
   - Trade-off: Jednodušší migrace vs. referenční integrita

2. **Manuální SQL over ORM** 
   - Důvod: Lepší kontrola nad UTF-8 kódováním a performance
   - Použití: `CONVERT(CONVERT(field USING binary) USING utf8mb4)` pro opravy
   - Benefit: Přesné SQL dotazy, žádné N+1 problémy

3. **JWT over Sessions** 
   - Důvod: Stateless autentifikace, škálovatelnost
   - Implementation: Tokeny v localStorage (client-side)
   - Poznámka: Žádná `AdminSession` tabulka není potřeba

4. **UUID File Naming** 
   - Důvod: Prevence path traversal, kolizí a bezpečnostních problémů
   - Formát: `978b9d5ce26f4acfb1b3cc2411a0a241.jpg`
   - Storage: Originální název uložen v DB

5. **Bootstrap over Custom CSS** 
   - Důvod: Rychlejší vývoj, konzistentní UI
   - Customizace: Minimální custom CSS v `frontend/src/assets/styles/`
   - Trade-off: Větší bundle size vs. rychlost vývoje

6. **Direct Fetch over Axios** 
   - Důvod: Jednodušší API client, méně závislostí
   - Implementation: Wrapper v `frontend/src/config/api.js`
   - Benefit: Nativní browser API, menší bundle

7. **Context over Redux** 
   - Důvod: Dostatečný state management pro admin auth
   - Scope: `AuthContext` v `frontend/src/config/auth.jsx`
   - Trade-off: Jednodušší setup vs. advanced state management

8. **Utils Module** 
   - Důvod: Centralizace business logiky (sezóny, encoding)
   - Umístění: `backend/app/utils.py`
   - Benefit: DRY princip, konzistentní logika

9. **Side-by-side Registration** 
   - Důvod: Lepší UX - formulář vlevo, seznam vpravo
   - Změna: Původně accordion layout
   - Benefit: Přehlednější, méně klikání

10. **Simplified Racer Display** 
    - Důvod: Focus na essentials (jméno, rok, pohlaví, klub)
    - Removed: Věkové kategorie (zbytečné)
    - Benefit: Čistější UI, rychlejší načítání

### Databázová konvence

#### Table Naming
- **Prefix:** `fuj_jmlp_*` pro většinu tabulek
- **Exception:** `race_registration` (ne `fuj_jmlp_registration`)
- **Důvod:** Legacy kompatibilita s phpMyAdmin exporty

#### ID Fields
- **Typ:** `BIGINT` primary keys
- **Důvod:** Legacy systém používal velké ID hodnoty
- **Implementation:** `Mapped[int] = mapped_column(BigInteger, primary_key=True)`

#### Character Set
- **Encoding:** UTF8MB4 throughout
- **Collation:** `utf8mb4_czech_ci` pro české řazení
- **Connection:** `?charset=utf8mb4` v connection stringu

### Sezónní logika

#### Definice sezóny
- **Start:** 1. srpna
- **End:** 31. července následujícího roku
- **Example:** Sezóna 2024 = 1.8.2024 - 31.7.2025

#### Implementace
```python
# backend/app/utils.py
def get_current_season() -> int:
    """Returns current racing season year (August-July)"""
    today = date.today()
    if today.month >= 8:  # Aug-Dec
        return today.year
    else:  # Jan-Jul
        return today.year - 1
```

#### Použití
- Filtrování závodů v admin rozhraní
- Archiv závodů (minulé sezóny)
- Statistiky a reporty

### Frontend Route Naming (Czech)

Veškeré veřejné routy jsou v češtině:

| Route | Význam | Komponenta |
|-------|--------|------------|
| `/` | Homepage | `Homepage.jsx` |
| `/terminovka` | Rozpis závodů | `RaceList.jsx` |
| `/zavod/:id` | Detail závodu | `RaceDetail.jsx` |
| `/archiv` | Archiv | `Archive.jsx` |
| `/admin` | Admin rozhraní | `AdminDashboard.jsx` |

### CSV Export Specifics

#### Format
- **Delimiter:** Semicolon (`;`) pro Excel v českém locale
- **Encoding:** UTF-8 with BOM (`\ufeff`)
- **Line ending:** CRLF (`\r\n`)

#### Implementation
```python
# backend/app/routers/admin/races.py
csv_content = "\ufeff" + csv_string  # Add BOM
headers["Content-Type"] = "text/csv; charset=utf-8"
```

### Document Upload

#### Allowed Types
```python
ALLOWED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.txt',  # Dokumenty
    '.jpg', '.jpeg', '.png',           # Obrázky
    '.xlsx', '.xls', '.csv'            # Tabulky
}
```

#### Storage Path
- **Container:** `/app/uploads/documents/`
- **Volume:** `jmlp_documents_data`
- **Host:** `/var/lib/docker/volumes/jmlp_documents_data/_data/`

#### Metadata
```sql
-- fuj_jmlp_files table
id BIGINT PRIMARY KEY
original_filename VARCHAR(255)
file_path VARCHAR(500)      -- UUID filename
file_size INT
mime_type VARCHAR(100)
uploaded_at DATETIME
race_id BIGINT              -- FK to fuj_jmlp_race
file_type ENUM('proposition', 'result', 'other')
```

### API Versioning Strategy

**Current:** No versioning (initial version)

**Future:** When breaking changes needed:
- Version in URL: `/api/v2/races/`
- Keep v1 for backward compatibility (6-12 months)
- Document migration guide

### Code Quality Improvements (Oct 2025)

#### Backend Refactoring
- ✅ `auth.py` cleanup - Removed debug prints, fixed duplicate raise
- ✅ `utils.py` module - Centralized season logic, date parsing
- ✅ `StandardExceptions` - Consistent Czech error messages
- ✅ API routing fixes - Resolved `/season/*` vs `/{race_id}` conflicts

#### Frontend UX
- ✅ Admin posts - Removed duplicate "New Post" button
- ✅ Registration form - Side-by-side layout
- ✅ Simplified racer display - No age categories
- ✅ Consistent button text - "Registrovat závodníka"

### Known Limitations

1. **MyISAM Engine**
   - No foreign key constraints
   - No transaction support
   - Manual cascade deletes required

2. **JWT Invalidation**
   - No token blacklist
   - Restart backend to invalidate all tokens
   - Tokens valid until expiration (30 min)

3. **File Upload**
   - No virus scanning
   - No image optimization
   - Manual cleanup of orphaned files

4. **Search**
   - No full-text search
   - Basic LIKE queries only
   - No fuzzy matching

5. **Scalability**
   - Single-instance deployment
   - No horizontal scaling
   - No caching layer (Redis)

### Migration Path from Legacy System

#### Data Import
1. Export from phpMyAdmin (XML format)
2. Convert to SQL with proper UTF8MB4 encoding
3. Import via `db/init_exact.sql`
4. Run encoding fixes: `backend/fix_charset.py`

#### Document Migration
1. Copy files from old server to Docker volume
2. Rename to UUID format
3. Insert metadata to `fuj_jmlp_files` table
4. Verify file_size calculations

---

## Kontakt a podpora

### Pro vývojáře

- **Repository:** https://github.com/podestm/jmlp_web_v1
- **Issues:** GitHub Issues pro bug reporty a feature requests
- **Documentation:** Tento README + inline code comments

### Pro administrátory

- **Admin přístup:** `https://vase-domena.cz/admin`
- **API dokumentace:** `https://vase-domena.cz/api/docs`
- **Support email:** admin@jmlp.cz

### Pro AI asistenty

- **Context:** `.github/copilot-instructions.md`
- **Guidelines:** Tento README (single source of truth)
- **Code style:** Python Black, ESLint (React)

---

## Poznámka pro přispěvatele

Kód je strukturován modulárně. Při změnách:

1. **Dodržujte stávající konvence** (naming, struktura)
2. **Aktualizujte tento README** pro významné změny
3. **Testujte lokálně** přes `docker-compose up`
4. **Vytvořte PR** s popisem změn

Pro AI asistenty existuje detailní kontext v `.github/copilot-instructions.md`, ale **tento README je zdrojem pravdy** pro celou dokumentaci.

---

**Poslední aktualizace:** Říjen 2025  
**Verze:** 1.0  
**Status:** Production Ready
