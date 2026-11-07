import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

try:
    DATABASE_URL = os.environ["DATABASE_URL"]
except KeyError as e:
    raise RuntimeError("DATABASE_URL environment variable is required (set in secret/.env)") from e

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"charset": "utf8mb4", "init_command": "SET names utf8mb4"},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
