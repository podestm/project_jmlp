from sqlalchemy import Column, Integer, BigInteger, SmallInteger, String, ForeignKey, Date, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .database import Base
from datetime import datetime, date


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

    # Odstraníme relationship - budeme kluby načítat explicitně


class Club(Base):
    __tablename__ = "fuj_jmlp_club"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=True)


class Areal(Base):
    __tablename__ = "fuj_jmlp_areal"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)


class Race(Base):
    __tablename__ = "fuj_jmlp_race"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    closed: Mapped[bool] = mapped_column(Boolean)
    datum: Mapped[date | None] = mapped_column(Date, nullable=True)
    proposition: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raceNr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    registration: Mapped[bool] = mapped_column(Boolean)
    result: Mapped[str | None] = mapped_column(String(255), nullable=True)
    areal_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_areal.id"), nullable=True)
    organizer_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    raceCategory_id: Mapped[int] = mapped_column(BigInteger)
    raceMethod_id: Mapped[int] = mapped_column(BigInteger)
    raceType_id: Mapped[int] = mapped_column(BigInteger)
    season_id: Mapped[int] = mapped_column(BigInteger)

    areal = relationship("Areal")


class Registration(Base):
    __tablename__ = "race_registration"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    race_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_race.id"))
    racer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_racer.id"))
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("race_id", "racer_id", name="uq_race_racer"),
    )


class Post(Base):
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(String)  # TEXT type
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminUser(Base):
    __tablename__ = "admin_users"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
