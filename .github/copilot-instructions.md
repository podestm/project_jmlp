# JMLP Web Application - AI Coding Instructions

## Project Overview
Full-stack racing registration system with FastAPI backend, React frontend, MySQL database, and Docker containerization. Handles Czech "Jezerní Motolodní Liga Pardubice" (lake motorboat racing) event registrations.

## Architecture & Key Components

### Backend (FastAPI + SQLAlchemy + MySQL)
- **Database**: MySQL with MyISAM engine for legacy compatibility, BigInt IDs, Czech table prefixes (`fuj_jmlp_*`)
- **Season Logic**: Racing seasons run August-July (Aug 1st triggers new season), implemented in `backend/app/routers/races.py:get_current_season_id()`
- **Table Naming**: Legacy naming convention with `fuj_jmlp_` prefix (racer, race, club, areal, admin, document)
- **Registration Table**: `race_registration` (not `fuj_jmlp_registration`) links races and racers
- **Foreign Keys**: Minimal FK constraints due to MyISAM engine choice
- **Admin System**: JWT-based authentication with bcrypt passwords, admin endpoints under `/admin` prefix
- **Document Upload**: UUID-named files in `backend/documents/` directory with database tracking

### Frontend (React + Vite + Bootstrap)
- **Routing**: React Router with Czech paths (`/terminovka`, `/archiv`, `/zavod/:id`, `/admin`)
- **API Client**: Custom API wrapper in `frontend/src/config/api.js` with environment-based base URL
- **Styling**: Bootstrap 5 with custom CSS modules in `frontend/src/assets/styles/`
- **State**: React hooks, no external state management
- **Admin Auth**: React Context-based authentication with localStorage token persistence
- **Admin Components**: Separate admin components in `src/components/admin/`

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
- **Router Structure**: Organized by resource (`races.py`, `racers.py`, `clubs.py`, `registration.py`, `admin.py`, `posts.py`)
- **Error Handling**: HTTPException with Czech messages for user-facing errors
- **Validation**: Heavy use of database existence checks before operations
- **Authentication**: JWT tokens with Bearer scheme, implemented in `backend/app/auth.py`
- **Admin Endpoints**: All admin operations under `/admin` prefix with JWT protection

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
- **CORS**: Backend configured for `http://localhost:3000`, update for production
- **Environment Variables**: `VITE_API_BASE`, `DATABASE_URL`, `CORS_ORIGINS`, `SECRET_KEY`
- **Database Init**: `db/init_exact.sql` runs on first container start
- **Season Boundary**: August 1st date logic affects race filtering throughout app
- **Admin Access**: Default login `admin@jmlp.cz` / `admin123` (change in production)
- **File Upload**: Max 10MB, stored in `backend/documents/` with UUID naming

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
- **JWT Security**: Change SECRET_KEY environment variable in production
- **File Uploads**: Default limit 10MB, stored in `backend/documents/` directory
- **Encoding Issues**: Ensure UTF8MB4 in all database connections and file operations
- **Season Logic**: Always consider current season when filtering races/data
- **Table Names**: `race_registration` not `fuj_jmlp_registration` for registration table
- **Admin Session**: No server-side session tracking, JWT tokens are stateless

## Current Implementation Status
- **Core Features**: ✅ Race management, racer registration, admin system
- **Document Upload**: ✅ Propositions and results with UUID naming
- **Registration Display**: ✅ Tabular view with club grouping on race detail pages
- **Admin Interface**: ✅ Complete CRUD operations with CSV export
- **Authentication**: ✅ JWT-based admin auth with Context API frontend
- **Database**: ✅ MyISAM schema with proper UTF8MB4 encoding
- **Docker**: ✅ Multi-container setup with persistent volumes

## Architecture Decisions Made
1. **MyISAM over InnoDB**: Chosen for legacy compatibility, no foreign keys
2. **Manual SQL over ORM**: Better control over encoding and performance
3. **JWT over Sessions**: Stateless authentication, no AdminSession table needed
4. **UUID File Naming**: Prevents conflicts and security issues
5. **Bootstrap over Custom CSS**: Faster development, consistent UI
6. **Direct Fetch over Axios**: Simpler API client, less dependencies
7. **Context over Redux**: Sufficient state management for admin auth