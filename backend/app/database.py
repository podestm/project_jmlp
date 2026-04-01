import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://app:default-dev-app-password@db:3306/jmlpcz?charset=utf8mb4")

engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True, 
    connect_args={
        "charset": "utf8mb4",
        "init_command": "SET names utf8mb4"
    }
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
