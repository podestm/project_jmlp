from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional


class RacerBase(BaseModel):
    name: Optional[str] = None
    surname: str
    sex: int
    year: int
    telefon: Optional[str] = None
    email: Optional[str] = None
    slcr_id: Optional[str] = None
    club_id: Optional[int] = None


class Racer(RacerBase):
    id: int

    class Config:
        from_attributes = True


class Club(BaseModel):
    id: int
    name: str
    valid: bool

    class Config:
        from_attributes = True


class Areal(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class Race(BaseModel):
    id: int
    closed: bool
    datum: Optional[date] = None
    proposition: Optional[str] = None
    raceNr: Optional[str] = None
    registration: bool
    result: Optional[str] = None
    areal_id: Optional[int] = None
    areal_name: Optional[str] = None
    organizer_id: Optional[int] = None
    organizer_name: Optional[str] = None
    raceCategory_id: int
    raceMethod_id: int
    raceType_id: int
    season_id: int

    class Config:
        from_attributes = True


class RegistrationCreate(BaseModel):
    race_id: int
    # Pro existujícího závodníka
    racer_id: Optional[int] = None
    # Pro nového závodníka
    racer_name: Optional[str] = None
    racer_surname: Optional[str] = None
    racer_sex: Optional[int] = None
    racer_year: Optional[int] = None
    racer_telefon: Optional[str] = None
    racer_email: Optional[str] = None
    racer_slcr_id: Optional[str] = None
    # Klub
    club_name: str


class Registration(BaseModel):
    id: int
    race_id: int
    racer_id: int
    registered_at: datetime

    class Config:
        from_attributes = True
