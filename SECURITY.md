# 🔐 Bezpečnostní příručka JMLP

## 🚨 Před nasazením do produkce

### 1. Environment Variables
**NIKDY necommitujte .env soubory do Gitu!**

```bash
# Vytvořte .env soubor z template
cp .env.example .env
```

**Povinné změny v .env:**
```env
# Silné heslo pro MySQL root účet (min. 16 znaků)
MYSQL_ROOT_PASSWORD=your_super_strong_root_password_here_2024

# Silné heslo pro aplikační databázový účet
MYSQL_PASSWORD=your_app_database_password_here_2024

# JWT secret klíč (min. 32 znaků, generujte náhodně)
SECRET_KEY=your_random_jwt_secret_key_at_least_32_chars_long_here

# Produkční URL
CORS_ORIGINS=https://your-production-domain.com
VITE_API_BASE=https://your-api-domain.com
```

### 2. Admin účet
**Změňte default admin přihlášení:**

1. **Přihlaste se jako admin:** `admin@jmlp.cz` / `admin123`
2. **Změňte heslo v admin rozhraní** nebo přímo v databázi
3. **Optionálně změňte email** na vaši produkční administrátorskou adresu

### 3. Database Security
```sql
-- Změňte admin heslo v databázi
UPDATE fuj_jmlp_admin 
SET password = '$2b$12$NEW_HASHED_PASSWORD_HERE' 
WHERE email = 'admin@jmlp.cz';
```

### 4. Docker produkce
**Použijte environment variables místo hardcoded hodnot:**

```yaml
# ❌ ŠPATNĚ - hardcoded
environment:
  MYSQL_ROOT_PASSWORD: root

# ✅ DOBŘE - environment variable
environment:
  MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
```

### 5. File uploads
- **Maximální velikost:** 10MB (nastaveno v FastAPI)
- **Cílová složka:** `backend/documents/`
- **Naming convention:** UUID pro bezpečnost
- **Allowed types:** PDF, DOC, DOCX, TXT

### 6. CORS Configuration
**Aktualizujte CORS origins pro produkci:**
```env
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

## 🔍 Security Checklist

### Před nasazením
- [ ] `.env` soubor vytvořen s silnými hesly
- [ ] `.env` soubory v `.gitignore`
- [ ] Admin heslo změněno z `admin123`
- [ ] JWT SECRET_KEY nastaven (min. 32 znaků)
- [ ] CORS origins nastaveny pro produkční domény
- [ ] Database hesla změněna z defaults
- [ ] SSL/HTTPS nakonfigurováno
- [ ] Backup strategie nastavena

### Pravidelná údržba
- [ ] Aktualizace závislostí (`pip-audit`, `npm audit`)
- [ ] Monitoring přístupů k admin rozhraní
- [ ] Rotace JWT secret keys
- [ ] Pravidelné security scany
- [ ] Backup testování

## 🚨 Známé bezpečnostní problémy

### Vyřešené v této verzi
- ✅ Hardcoded hesla v docker-compose.yml → environment variables
- ✅ Debug printy v auth.py → odstraněny
- ✅ Exposed SECRET_KEY → environment variable s fallback jen pro dev
- ✅ .gitignore rozšířen o všechny .env soubory

### TODO pro budoucí verze
- [ ] Rate limiting pro login endpointy
- [ ] Session timeout konfigurace
- [ ] Audit log pro admin akce
- [ ] 2FA pro admin účty
- [ ] File type validation pro uploads
- [ ] Input sanitization pro CSV export

## 📞 Contact
V případě bezpečnostních problémů kontaktujte vývojový tým.