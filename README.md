# JMLP – minimal registrations app

Full-stack Docker setup: FastAPI backend, MySQL, React (Vite) frontend.

## Quickstart

1. Build and start containers:

```cmd
docker compose up --build
```

2. Open:
- API docs: http://localhost:8000/docs
- Frontend: http://localhost:3000

The DB is seeded via `db/init_exact.sql` with few clubs, racers, areals, and two upcoming races.

## API
- GET /races/
- GET /races/{id}
- GET /races/{id}/registrations
- GET /racers/?q=Jan
- POST /racers/ { name, surname, sex, year, telefon?, slcr_id? }
- GET /clubs/
- POST /registrations/ { race_id, racer_id, club_id }

## Configuration
- DB connection is set via `DATABASE_URL` env for the backend service (see docker-compose.yml).
- CORS is allowed for http://localhost:3000 by default.
- Frontend uses Vite env var `VITE_API_BASE` (set in docker-compose) to talk to the API.

## Notes
- MySQL runs on host port 3307 to avoid conflicts.
- If you rebuild DB from scratch, remove the `db_data` volume: `docker compose down -v`.

## Schema notes / migration

- The file `schemas.txt` contains the original phpMyAdmin-exported table definitions. Those use `BIGINT` ids and `MyISAM` engine. By default, this project uses `db/init_exact.sql` (MyISAM) to match that schema as closely as possible.
- If you prefer InnoDB and foreign keys, you can duplicate `db/init_exact.sql`, replace `ENGINE=MyISAM` with `ENGINE=InnoDB`, add FKs as needed, and mount that file instead in `docker-compose.yml`.
- To import the original dump into the running DB container:

```cmd
docker compose up -d db
docker exec -i $(docker ps -qf "name=jmlp_web_v1_db") mysql -u root -proot jmlpcz < schemas.txt
```

Replace the container selector with the correct container name (use `docker ps` to find it). Note: `schemas.txt` may need formatting if it contains phpMyAdmin XML wrappers — extract the raw CREATE TABLE / INSERT statements first.

### Importing the exact schema

If you want to import the original CREATE TABLE statements exactly as in `schemas.txt` (MyISAM), use the prepared `db/init_exact.sql`:

1. Start the DB service:

```cmd
docker compose up -d db
```

2. Find the DB container name (or id):

```cmd
docker ps
```

3. Copy the file into the container and import (or pipe it):

```cmd
docker cp .\db\init_exact.sql <container_name>:/tmp/init_exact.sql
docker exec -it <container_name> sh -c "mysql -u root -proot jmlpcz < /tmp/init_exact.sql"
```

Or pipe directly from host:

```cmd
docker exec -i <container_name> sh -c "mysql -u root -proot jmlpcz" < db/init_exact.sql
```

Notes:
- `init_exact.sql` contains `ENGINE=MyISAM` statements. MyISAM is supported by MySQL but not transactional. If you want InnoDB, replace `ENGINE=MyISAM` with `ENGINE=InnoDB` in the file before importing.
- If `schemas.txt` included phpMyAdmin XML wrappers, use `init_exact.sql` (already extracted) instead, or strip the wrappers first.
