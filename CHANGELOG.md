# CHANGELOG

## [Unreleased] - 2025-10-01

### 🔐 Security
- **Environment variables protection** - All sensitive data moved to `.env` files
- **Hardcoded credentials removed** - No more exposed passwords in docker-compose.yml
- **JWT secret security** - SECRET_KEY now uses environment variables with dev-only fallback
- **Enhanced .gitignore** - Comprehensive protection for all environment files and secrets
- **Security documentation** - New SECURITY.md with production deployment checklist
- **🚨 CRITICAL FIX** - Admin login credentials no longer visible in production frontend

### ✨ Added
- **utils.py module** - Centralized utility functions for season logic and encoding
- **StandardExceptions class** - Consistent Czech error messages across all API endpoints
- **Side-by-side registration layout** - Form on left, racer list on right for better UX
- **UTF-8 BOM support** - Proper CSV export for Excel compatibility with Czech characters
- **.env.example template** - Secure configuration template for production deployment

### 🔧 Fixed
- **API routing conflicts** - Resolved `/season/*` vs `/{race_id}` routing issues
- **Auth module cleanup** - Removed debug prints and duplicate code
- **CSV encoding issues** - CONVERT operations for legacy database encoding fixes
- **Admin posts UI** - Removed duplicate "New Post" button from filters
- **Security vulnerabilities** - Eliminated exposed credentials from configuration files

### 🎨 Changed
- **Registration form** - Simplified racer display without age categories
- **Button text consistency** - "Registrovat závodníka" for all registration actions
- **Admin interface** - Single "New Post" button in header only
- **Error handling** - Standardized Czech messages throughout application
- **Docker configuration** - Now uses environment variables with secure defaults
- **Documentation** - Updated with security warnings and production setup instructions

### 🗑️ Removed
- **Age categories** - Eliminated from racer search and registration forms
- **Debug prints** - Cleaned up auth module and other components
- **Duplicate functions** - Centralized season logic from multiple files
- **Redundant UI elements** - Streamlined admin interfaces
- **Hardcoded secrets** - All sensitive data moved to environment variables

---

### 📝 Migration Notes
- **⚠️ BREAKING CHANGE**: Production deployment now requires `.env` file configuration
- Copy `.env.example` to `.env` and set secure passwords before deployment
- Default admin credentials (`admin@jmlp.cz` / `admin123`) must be changed in production
- No database schema changes required
- Frontend changes are backward compatible

### 🚨 Security Notices
- **Action Required**: Change default admin password from `admin123` in production
- **Action Required**: Set strong passwords in `.env` file for production deployment
- **Action Required**: Review SECURITY.md before production deployment

### 🐛 Known Issues
- None currently reported

### 📊 Performance Improvements
- Reduced code duplication in season logic
- Cleaner API routing without conflicts
- More efficient error handling patterns