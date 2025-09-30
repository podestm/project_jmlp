# JMLP – Registrační systém pro jezerní motolodní závody

Full-stack registrační systém postavený na FastAPI (backend), React (frontend), MySQL databázi a Docker kontejnerizaci. Slouží pro správu registrací na závody České "Jezerní Motolodní Liga Pardubice".

## 🚀 Rychlý start

1. **Spuštění aplikace:**
```cmd
docker compose up --build
```

2. **Otevření aplikace:**
- **Frontend (veřejná stránka):** http://localhost:3000
- **API dokumentace:** http://localhost:8000/docs  
- **Admin rozhraní:** http://localhost:3000/admin
  - Login: `admin@jmlp.cz` / `admin123`

Databáze se automaticky inicializuje z `db/init_exact.sql` s testovacími daty klubů, závodníků a závodů.

## 📁 Struktura projektu

```
jmlp_web_v1/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routers/        # API endpointy (races, racers, admin, etc.)
│   │   ├── models.py       # SQLAlchemy databázové modely
│   │   ├── schemas.py      # Pydantic schémata pro API
│   │   ├── auth.py         # JWT autentifikace
│   │   └── main.py         # FastAPI aplikace
│   ├── documents/          # Nahrané dokumenty (propozice, výsledky)
│   └── Dockerfile
├── frontend/               # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # React komponenty
│   │   │   ├── admin/      # Admin rozhraní komponenty
│   │   │   ├── pages/      # Veřejné stránky
│   │   │   └── ui/         # Sdílené UI komponenty
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
- `GET /admin/races/` - Správa závodů
- `GET /admin/races/{id}/registrations` - Detail registrací závodu
- `GET /admin/races/{id}/export-csv` - Export registrací do CSV
- `POST /admin/races/{id}/upload` - Nahrání dokumentů (propozice/výsledky)
- `GET /admin/documents/` - Správa dokumentů
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
- **Fetch API** pro komunikaci s backendem

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
- **Registrace nových závodníků** a přihlašování na závody
- **Zobrazení aktualit** na homepage
- **Archiv závodů** z minulých sezón

### Admin funkce
- **Správa závodů** s nahráváním dokumentů
- **Export registrací** do CSV pro organizátory
- **Správa závodníků a klubů**
- **Zobrazení detailních statistik** registrací

## 🚨 Poznámky k produkci

- **Změnit SECRET_KEY** v produkčním prostředí
- **Aktualizovat CORS_ORIGINS** na produkční domény  
- **Změnit default admin heslo** z `admin123`
- **Zvážit přechod na InnoDB** místo MyISAM pro referenční integritu
- **Nastavit SSL** pro produkční deployment

## 📋 TODO & Vylepšení

- [ ] Migrace z MyISAM na InnoDB s foreign keys
- [ ] Implementace email notifikací pro registrace
- [ ] Rozšíření admin rozhraní o pokročilé reporty
- [ ] Integrace s externími systémy (SLČR databáze)
- [ ] Optimalizace SQL dotazů pro větší objemy dat
