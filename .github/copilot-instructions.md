# JMLP Web Application - AI Coding Instructions

## Project Overview
Full-stack racing registration system with FastAPI backend, React frontend, MySQL database, and Docker containerization. Handles Czech "Jezerní Motolodní Liga Pardubice" (lake motorboat racing) event registrations.

## Architecture & Key Components

### Backend (FastAPI + SQLAlchemy + MySQL)
- **Database**: MySQL with MyISAM engine for legacy compatibility, BigInt IDs, Czech table prefixes (`fuj_jmlp_*`)
- **Season Logic**: Racing seasons run August-July (Aug 1st triggers new season), centralized in `backend/app/utils.py`
- **Table Naming**: Legacy naming convention with `fuj_jmlp_` prefix (racer, race, club, areal, admin, document)
- **Registration Table**: `race_registration` (not `fuj_jmlp_registration`) links races and racers
- **Foreign Keys**: Minimal FK constraints due to MyISAM engine choice
- **Admin System**: JWT-based authentication with cleaned auth module, admin endpoints under `/api/admin` prefix
- **Document Upload**: UUID-named files in `/app/uploads/documents/` with database tracking
- **Error Handling**: Standardized Czech error messages via `utils.StandardExceptions`
- **Visitor Analytics**: Public logging endpoint `/visitor-log`, admin analytics under `/api/admin/analytics` and `/api/admin/stats`
- **Utils Module**: Centralized season logic, UTF-8 encoding helpers, date parsing utilities

### Frontend (React + Vite + Bootstrap)
- **Routing**: React Router with Czech paths (`/registrace`, `/vysledky`, `/archiv-zprav`, `/dokumenty`, `/kontakty`, `/zavod/:id`, `/admin`)
- **API Client**: Custom API wrapper in `frontend/src/config/api.js` with environment-based base URL
- **Styling**: Bootstrap 5 with custom CSS modules in `frontend/src/assets/styles/`
- **State**: React hooks with custom business logic hooks (useRaceManagement, usePostManagement, useRegistration)
- **Admin Auth**: React Context-based authentication with localStorage token persistence
- **Admin Components**: Separate admin components in `src/components/admin/` with modular structure
- **Registration Form**: Side-by-side layout with form on left, racer list on right (no age categories)
- **Admin Posts**: Single "New Post" button (removed duplicate buttons from filters)

### Data Processing Pipeline
- **Legacy Support**: Designed to work with phpMyAdmin XML exports from existing system
- **UTF8MB4 Encoding**: Proper handling of Czech characters throughout the stack
- **CSV Export**: Semicolon-separated values for Excel compatibility in Czech locale

## Development Workflows

### Docker Setup
```bash
# Start everything (includes DB seeding)
docker compose up --build

# Reset database volume if needed
docker compose down -v
```

### Database Operations
- **Manual import**: Use `docker exec` with MySQL client for direct SQL imports
- **Dev access**: MySQL exposed on port 3307 (not standard 3306) to avoid conflicts
- **Encoding**: UTF8MB4 throughout, special handling in connection strings

### API Testing
- FastAPI docs auto-available at `http://localhost:8000/docs`
- Frontend dev server: `http://localhost:3000`
- Admin interface: `http://localhost:3000/admin`

## Project-Specific Patterns

### Model Conventions
- **SQLAlchemy Models**: Use `Mapped` type hints, explicit table names, no relationships (manual joins)
- **Pydantic Schemas**: Separate base/response models, `from_attributes = True` for ORM compatibility
- **ID Fields**: Always `BigInteger` primary keys for legacy compatibility
- **No AdminSession**: JWT tokens stored client-side, no server-side session tracking

### API Patterns
- **Router Structure**: Organized by resource with admin sub-routers (`admin/races.py`, `admin/posts.py`, etc.)
- **Error Handling**: Standardized `utils.StandardExceptions` with Czech messages for user-facing errors
- **Validation**: Heavy use of database existence checks before operations
- **Authentication**: JWT tokens with Bearer scheme, cleaned implementation in `backend/app/auth.py`
- **Admin Endpoints**: All admin operations under `/api/admin` prefix with JWT protection
- **CSV Export**: UTF-8 with BOM for Excel compatibility, CONVERT operations for encoding fixes

### Frontend Patterns
- **Component Organization**: Clear separation - `pages/`, `ui/`, `layouts/`, `admin/` folders
- **API Calls**: Direct fetch() calls in components, not centralized service layer  
- **Czech Localization**: All UI text and routing in Czech language
- **Bootstrap Integration**: Uses Bootstrap classes extensively, minimal custom CSS
- **Admin Protected Routes**: Context-based authentication with ProtectedRoute wrapper
- **Race Detail**: Tabular display of all registered racers grouped by clubs (no accordion)

### Database Patterns
- **Manual SQL**: Raw SQL queries for complex joins, especially for encoding fixes
- **UTF8 Conversion**: `CONVERT(CONVERT(field USING binary) USING utf8mb4)` for legacy data
- **Table Names**: `fuj_jmlp_*` prefix for most tables, `race_registration` exception
- **Date Handling**: `date` type (not `datetime`) for race dates
- **Document Management**: UUID filenames with original name tracking

## Critical Integration Points
- **CORS**: Backend configured for development, update for production domains
- **Environment Variables**: Use `.env` file for production: `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `SECRET_KEY`, `CORS_ORIGINS`, `VITE_API_BASE`
- **Database Init**: `db/init_exact.sql` runs on first container start
- **Season Boundary**: August 1st date logic affects race filtering throughout app
- **Admin Access**: Default login `admin@jmlp.cz` / `admin123` (⚠️ MUST change in production – see README.md Security)
- **File Upload**: Max 10MB, stored in `/app/uploads/documents/` with UUID naming
- **Admin API Prefix**: All admin API calls must use `/api/admin/*` (frontend AdminAPI already uses this)

## Testing & Debugging
- Use FastAPI `/docs` endpoint for API testing with JWT authentication
- Check `docker compose logs backend` for SQLAlchemy query debugging
- Frontend dev tools work normally with Vite HMR
- Database accessible via `mysql -u root -proot -h localhost -P 3307 jmlpcz`
- Admin interface testing with default credentials
- CSV export testing with Czech characters and Excel compatibility

## Common Gotchas
- **MyISAM Engine**: No foreign key constraints, manual relationship management required
- **BigInt vs Int**: Use `BigInteger` in SQLAlchemy models to match database schema
- **Date vs DateTime**: Race dates are `date` type, not `datetime`
- **JWT Security**: Use environment variables for SECRET_KEY, never hardcode in production
- **File Uploads**: Default limit 10MB, stored in `/app/uploads/documents/` directory
- **Encoding Issues**: Ensure UTF8MB4 in all database connections and file operations
- **Season Logic**: Always consider current season when filtering races/data
- **Table Names**: `race_registration` not `fuj_jmlp_registration` for registration table
- **Admin Session**: No server-side session tracking, JWT tokens are stateless
- **Environment Variables**: Use `.env` file for sensitive data, never commit to Git

## Recent Code Improvements (October 2025)

### Backend Refactoring
- **auth.py cleanup**: Removed debug prints, fixed duplicate raise statements, improved error handling
- **utils.py module**: Created centralized utility functions for season logic, date parsing, UTF-8 encoding
- **StandardExceptions class**: Consistent Czech error messages across all endpoints
- **API routing fixes**: Resolved conflicts between `/season/*` and `/{race_id}` routes
- **CSV export enhancement**: Added UTF-8 BOM for proper Excel compatibility with Czech characters

### Frontend UX Improvements  
- **Admin posts interface**: Removed duplicate "New Post" button from filters, kept only main green button
- **Registration form redesign**: Side-by-side layout with form on left, racer list on right
- **Simplified racer display**: Removed age categories, show only essential info (name, year, sex, club)
- **Consistent button text**: "Registrovat závodníka" instead of changing text based on selection
- **Better mobile responsiveness**: Improved layout for smaller screens

### Code Quality Enhancements
- **Eliminated code duplication**: Season logic centralized in utils.py
- **Improved type hints**: Better TypeScript-like annotations throughout Python code
- **Standardized imports**: Consistent import structure across modules
- **Enhanced documentation**: Better docstrings and inline comments

## Current Implementation Status
- **Core Features**: ✅ Race management, racer registration, admin system
- **Document Upload**: ✅ Propositions and results with UUID naming
- **Registration Display**: ✅ Side-by-side layout with simplified racer list (no categories)
- **Admin Interface**: ✅ Complete CRUD operations with CSV export and automatic race numbering
- **Authentication**: ✅ JWT-based admin auth with cleaned implementation
- **Database**: ✅ MyISAM schema with proper UTF8MB4 encoding and CONVERT fixes
- **Docker**: ✅ Multi-container setup with persistent volumes
- **Code Quality**: ✅ Refactored with utils module, standardized error handling, clean routing

## Architecture Decisions Made
1. **MyISAM over InnoDB**: Chosen for legacy compatibility, no foreign keys
2. **Manual SQL over ORM**: Better control over encoding and performance
3. **JWT over Sessions**: Stateless authentication, no AdminSession table needed
4. **UUID File Naming**: Prevents conflicts and security issues
5. **Bootstrap over Custom CSS**: Faster development, consistent UI
6. **Direct Fetch over Axios**: Simpler API client, less dependencies
7. **Context over Redux**: Sufficient state management for admin auth
8. **Utils Module**: Centralized business logic to avoid code duplication
9. **Side-by-side Registration**: Form on left, racer list on right for better UX
10. **Simplified Racer Display**: Removed age categories, focus on essential info only