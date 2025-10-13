# JMLP – Registrační systém pro jezerní motolodní závody

Full-stack registrační systém postavený na FastAPI (backend), React (frontend), MySQL databázi a Docker kontejnerizaci. Slouží pro správu registrací na závody České "Jezerní Motolodní Liga Pardubice".

## 🚀 Rychlý start (Development)

```cmd
# 1. Spuštění aplikace
docker compose up --build

# docker-compose.yml je safe pro Git - obsahuje pouze dev fallback hesla
# Skutečná hesla jsou v .env souboru (v .gitignore)
```

**Otevření aplikace:**
- **Frontend (veřejná stránka):** http://localhost:3000
- **API dokumentace:** http://localhost:8000/docs  
- **Admin rozhraní:** http://localhost:3000/admin
  - Default login: `admin@jmlp.cz` / `admin123` (⚠️ změňte v produkci!)

⚠️ **SECURITY:** Před nasazením do produkce vytvořte `.env` soubor z `.env.example` a nastavte silná hesla!

Databáze se automaticky inicializuje z `db/init_exact.sql` s testovacími daty klubů, závodníků a závodů.

---

## 🚀 Production Deployment

**Projekt je připravený pro produkční nasazení!**

### Quick Start:
```bash
# 1. Vytvořte .env s produkčními hodnotami
cp .env.example .env
nano .env  # Změňte hesla a domény!

# 2. Build a spusťte production
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 3. IHNED změňte admin heslo po nasazení!
```

### ⚠️ Kritické kroky před nasazením:

1. **`.env` soubor** - změňte:
   - `MYSQL_ROOT_PASSWORD` (min. 16 znaků)
   - `MYSQL_PASSWORD` (min. 16 znaků)
   - `CORS_ORIGINS=https://vase-domena.cz`
   - `VITE_API_BASE=https://api.vase-domena.cz`

2. **Admin heslo** - po nasazení:
   - Přihlaste se: `admin@jmlp.cz` / `admin123`
   - **Okamžitě změňte heslo!**

3. **SSL certifikát**:
   - Použijte Let's Encrypt nebo jiný certifikát
   - Nakonfigurujte reverse proxy (nginx/Caddy)

### Production vs Development:

| Komponenta | Development | Production |
|------------|-------------|------------|
| Frontend | Vite dev (port 3000) | Nginx (port 80) |
| Backend | 1 worker | 4 workers, non-root |
| Volumes | Source mounted | Data only |
| DB Port | 3307 exposed | Internal only |
| Security Headers | ❌ | ✅ |

---

## 📁 Struktura projektu

```
jmlp_web_v1/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routers/        # API endpointy
│   │   │   ├── admin/      # Admin API (races, racers, posts, documents)
│   │   │   ├── races.py    # Veřejné závod API + season logika
│   │   │   ├── racers.py   # Vyhledávání závodníků
│   │   │   ├── clubs.py    # Seznam klubů
│   │   │   └── registration.py # Registrace na závody
│   │   ├── models.py       # SQLAlchemy databázové modely
│   │   ├── schemas.py      # Pydantic schémata pro API
│   │   ├── auth.py         # JWT autentifikace (vyčištěno)
│   │   ├── utils.py        # Utility funkce (season logika, encoding)
│   │   └── main.py         # FastAPI aplikace
│   ├── documents/          # Nahrané dokumenty (propozice, výsledky)
│   └── Dockerfile
├── frontend/               # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # React komponenty
│   │   │   ├── admin/      # Admin rozhraní komponenty
│   │   │   │   ├── post/   # Správa příspěvků
│   │   │   │   ├── race/   # Správa závodů
│   │   │   │   └── *.jsx   # Admin komponenty
│   │   │   ├── pages/      # Veřejné stránky
│   │   │   └── ui/         # Sdílené UI komponenty
│   │   │       └── registration/ # Registrační formulář
│   │   ├── hooks/          # React hooks pro business logiku
│   │   ├── assets/styles/  # CSS styly (Bootstrap + vlastní)
│   │   └── config/         # API konfigurace
│   └── Dockerfile
├── db/
│   └── init_exact.sql      # Databázové schéma a testovací data
└── docker-compose.yml      # Docker orchestrace
```

## 🔌 API Endpointy

### Veřejné API
- `GET /races/` - Seznam závodů (s filtrováním podle sezóny)
- `GET /races/{id}` - Detail závodu
- `GET /races/{id}/registrations` - Registrace závodu seskupené podle klubů
- `GET /races/{id}/club-stats` - Statistiky registrací podle klubů
- `GET /racers/` - Vyhledávání závodníků (`?q=jmeno`)
- `GET /clubs/` - Seznam klubů
- `POST /racers/` - Vytvoření nového závodníka
- `POST /registrations/` - Registrace závodníka na závod
- `GET /posts/` - Aktuality pro homepage

### Admin API (`/admin` prefix)
- `POST /admin/login` - Přihlášení administrátora
- `GET /admin/races/` - Správa závodů s automatickým generováním čísel
- `GET /admin/races/{id}/registrations` - Detail registrací závodu
- `GET /admin/races/{id}/export-csv` - Export registrací do CSV (UTF-8 s BOM)
- `POST /admin/races/{id}/upload` - Nahrání dokumentů (propozice/výsledky)
- `GET /admin/posts/` - Správa příspěvků (bez duplicitních tlačítek)
- `GET /admin/documents/` - Správa dokumentů s UUID pojmenováním
- `GET /admin/racers/` - Správa závodníků

## 🗄️ Databázové schéma

### Hlavní tabulky
- `fuj_jmlp_race` - Závody (datum, registrace, dokumenty)
- `fuj_jmlp_racer` - Závodníci (jméno, ročník, SLČR ID, klub)
- `fuj_jmlp_club` - Kluby
- `fuj_jmlp_areal` - Areály závodů
- `race_registration` - Registrace závodníků na závody
- `posts` - Aktuality pro homepage
- `fuj_jmlp_admin` - Administrátoři
- `fuj_jmlp_document` - Nahrané dokumenty

### Datové typy
- **Primary Keys:** `BIGINT` pro kompatibilitu s legacy systémem
- **Engine:** MyISAM (pro kompatibilitu, bez FK omezení)
- **Encoding:** UTF8MB4 (podpora českých znaků)

## ⚙️ Konfigurace

### Proměnné prostředí
```bash
# Backend
DATABASE_URL=mysql+pymysql://app:app@db:3306/jmlpcz?charset=utf8mb4
SECRET_KEY=your-secret-key-change-in-production
CORS_ORIGINS=http://localhost:3000
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend  
VITE_API_BASE=http://localhost:8000
```

### Docker služby
- **MySQL:** Port 3307 (místo standardního 3306)
- **Backend:** Port 8000
- **Frontend:** Port 3000

## 🏛️ Architektura

### Backend (FastAPI)
- **Modularní struktura** s routery podle zdrojů
- **JWT autentifikace** pro admin rozhraní
- **Pydantic schémata** pro validaci API
- **SQLAlchemy** s explicitními SQL dotazy (bez ORM relationships)
- **UTF8MB4 encoding** pro české znaky

### Frontend (React + Vite)
- **Bootstrap 5** pro UI framework
- **React Router** s českými cestami (`/terminovka`, `/zavod/:id`)
- **Context API** pro admin autentifikaci
- **Custom hooks** pro business logiku (useRaceManagement, usePostManagement, useRegistration)
- **Modulární komponenty** s čistou separací admin/public rozhraní
- **Responsive design** s side-by-side layouty pro formuláře

### Specifické funkce
- **Sezónní logika:** Sezóny běží od srpna do července
- **Nahrávání dokumentů:** UUID pojmenování, podpora propozic a výsledků
- **CSV export:** Středníky jako oddělovače pro Excel kompatibilitu
- **Encoding fixes:** Automatická oprava kódování pro legacy data

## 🔧 Vývoj a debugging

### Lokální vývoj
```cmd
# Restart konkrétní služby
docker compose restart backend
docker compose restart frontend

# Zobrazení logů
docker compose logs backend
docker compose logs frontend

# Reset databáze (smaže všechna data!)
docker compose down -v
docker compose up --build
```

### Databázový přístup
```cmd
# Připojení k MySQL kontejneru
docker exec -it jmlp_web_v1-db-1 mysql -u root -proot jmlpcz

# Nebo externí připojení
mysql -u app -papp -h localhost -P 3307 jmlpcz
```

### Testování API
FastAPI automaticky generuje interaktivní dokumentaci na `http://localhost:8000/docs` včetně autentifikace pro admin endpointy.

## 📊 Funkce systému

### Veřejné funkce
- **Termínovka závodů** s filtrováním podle sezón
- **Detail závodu** s kompletním seznamem registrovaných závodníků
- **Registrace závodníků** s side-by-side layoutem (formulář vlevo, seznam vpravo)
- **Inteligentní vyhledávání** existujících závodníků bez kategorií
- **Zobrazení aktualit** na homepage
- **Archiv závodů** z minulých sezón

### Admin funkce
- **Správa závodů** s automatickým generováním čísel (JMLP2025-XX)
- **Export registrací** do CSV s českými znaky a BOM pro Excel
- **Správa příspěvků** s jednoduchým rozhraním (jedno tlačítko pro nový příspěvek)
- **Nahrávání dokumentů** s UUID pojmenováním a typováním
- **Správa závodníků a klubů** s vyhledáváním
- **Zobrazení detailních statistik** registrací podle klubů

## � Bezpečnost

### Implementované features:
- ✅ JWT autentifikace s 64-char hex SECRET_KEY
- ✅ Werkzeug scrypt hashed hesla (32768 iterations)
- ✅ Non-root Docker users v produkci
- ✅ Security headers (X-Frame-Options, X-XSS-Protection)
- ✅ Internal Docker network (db nepřístupná zvenčí)
- ✅ `.env` soubor v `.gitignore`

### Doporučené další kroky:
- [ ] SSL/TLS certifikát (Let's Encrypt)
- [ ] Reverse proxy s rate limiting
- [ ] Firewall (pouze 80/443)
- [ ] Pravidelné zálohy (db_data, documents_data)

---

## � Poznámky

### Legacy záležitosti:
- **MyISAM engine** - legacy kompatibilita, zvážit přechod na InnoDB
- **BigInt IDs** - kvůli kompatibilitě se starým systémem
- **Prefix `fuj_jmlp_`** - historické pojmenování tabulek

### Technické detaily:
- **Sezóny:** Srpen-Červenec (1.8. = nová sezóna)
- **UTF-8:** Kompletní podpora českých znaků
- **Docker volumes:** Persistentní data pro db a dokumenty
- **Health checks:** Automatická kontrola stavu služeb v produkci

---

## 🤝 Kontribuce

Pro AI asistenty (GitHub Copilot): Projekt má detailní kontext v `.github/copilot-instructions.md`
- 🔄 **CONVERT operace** - automatická oprava legacy encoding v databázi

## 📋 TODO & Budoucí vylepšení

- [ ] Migrace z MyISAM na InnoDB s foreign keys
- [ ] Email notifikace
- [ ] Pokročilé reporty a statistiky v admin rozhraní
- [ ] API rate limiting pro produkční nasazení
- [ ] Automatické zálohy databáze
- [ ] Integrace s externími systémy (SLČR databáze)
