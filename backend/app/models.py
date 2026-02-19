from sqlalchemy import Integer, BigInteger, SmallInteger, String, ForeignKey, Date, Boolean, DateTime, UniqueConstraint, Enum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator
from .database import Base
from datetime import datetime, date
import enum


class FileTypeEnum(str, enum.Enum):
    document = "document"
    image = "image"
    propozice = "propozice"
    vysledky = "vysledky"
    posty = "posty"
    neprirazene = "neprirazene"


# Custom type for MySQL BIT(1) fields
class BitBoolean(TypeDecorator):
    impl = SmallInteger
    cache_ok = True
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Handle bytes objects from MySQL BIT(1)
        if isinstance(value, bytes):
            return value != b'\x00'
        # Handle integer values
        return bool(value)
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return 1 if value else 0


class Racer(Base):
    __tablename__ = "fuj_jmlp_racer"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str | None] = mapped_column(String(25), nullable=True)
    sex: Mapped[int] = mapped_column(SmallInteger)
    surname: Mapped[str] = mapped_column(String(30))
    year: Mapped[int] = mapped_column(Integer)
    telefon: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    slcr_id: Mapped[str | None] = mapped_column(String(10), nullable=True)
    club_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_club.id"), nullable=True)
    category_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_category.id"), nullable=True)

    # Odstraníme relationship - budeme kluby a kategorie načítat explicitně


class Club(Base):
    __tablename__ = "fuj_jmlp_club"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=True)


class Category(Base):
    __tablename__ = "fuj_jmlp_category"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100, collation='utf8mb4_unicode_ci'))
    min_birth_year: Mapped[int] = mapped_column(Integer)  # Nejstarší ročník
    max_birth_year: Mapped[int] = mapped_column(Integer)  # Nejmladší ročník
    sex: Mapped[int] = mapped_column(SmallInteger)  # 1 = muži, 2 = ženy, 0 = mix
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Areal(Base):
    __tablename__ = "fuj_jmlp_areal"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)


class Race(Base):
    __tablename__ = "fuj_jmlp_race"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    closed: Mapped[bool] = mapped_column(BitBoolean)
    datum: Mapped[date | None] = mapped_column(Date, nullable=True)
    raceNr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    registration: Mapped[bool] = mapped_column(BitBoolean)
    proposition_file_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # FK to fuj_jmlp_files
    results_file_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # FK to fuj_jmlp_files
    areal_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_areal.id"), nullable=True)
    organizer_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    raceCategory_id: Mapped[int] = mapped_column(BigInteger)
    raceMethod_id: Mapped[int] = mapped_column(BigInteger)
    raceType_id: Mapped[int] = mapped_column(BigInteger)
    season_id: Mapped[int] = mapped_column(BigInteger)


class Registration(Base):
    __tablename__ = "race_registration"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    race_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_race.id"))
    racer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_racer.id"))
    category_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_category.id"), nullable=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("race_id", "racer_id", name="uq_race_racer"),
    )


class Post(Base):
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(String)
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_file_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    image_position: Mapped[str | None] = mapped_column(String(20), nullable=True, default="right")  # "left", "right", "top", "none"
    document_file_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # FK to fuj_jmlp_files
    published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminUser(Base):
    __tablename__ = "fuj_jmlp_admin"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(191), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(String(20), default="admin")  # admin, timekeeper
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class File(Base):
    __tablename__ = "fuj_jmlp_files"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_type: Mapped[FileTypeEnum] = mapped_column(Enum(FileTypeEnum), default=FileTypeEnum.neprirazene)
    folder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    uploaded_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class Folder(Base):
    __tablename__ = "fuj_jmlp_folders"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VisitorLog(Base):
    __tablename__ = "fuj_jmlp_visitor_log"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv6 support
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class SeasonResult(Base):
    __tablename__ = "fuj_jmlp_season_results"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    season_year_start: Mapped[int] = mapped_column(Integer, nullable=False)
    season_year_end: Mapped[int] = mapped_column(Integer, nullable=False)
    document_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    final_results: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)  # 0 = průběžné, 1 = celkové
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('season_year_start', 'season_year_end', name='unique_season'),
    )
