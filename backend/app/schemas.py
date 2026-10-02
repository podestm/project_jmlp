from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing import Optional, Union


class RacerBase(BaseModel):
    name: Optional[str] = None  # firstName
    surname: str  # lastName
    sex: int
    year: int  # birthYear
    telefon: Optional[str] = None
    email: Optional[str] = None
    slcr_id: Optional[str] = None  # idSlcr
    club_id: Optional[int] = None
    category_id: Optional[int] = None


def _reject_formula_prefix(v):
    """Odmítne hodnoty, které by se v Excelu vyhodnotily jako vzorec (CSV injection)."""
    if isinstance(v, str) and v[:1] in ('=', '+', '-', '@', '\t', '\r'):
        raise ValueError('Hodnota nesmí začínat znakem =, +, -, @ ani tabulátorem')
    return v


class RacerCreate(BaseModel):
    firstName: str  # Will be mapped to 'name' field
    lastName: str   # Will be mapped to 'surname' field
    sex: int
    birthYear: int  # Will be mapped to 'year' field
    club_id: Optional[int] = None
    idSlcr: Optional[str] = None  # Will be mapped to 'slcr_id' field

    @field_validator('firstName', 'lastName', 'idSlcr')
    @classmethod
    def no_formula_prefix(cls, v):
        return _reject_formula_prefix(v)


class Racer(RacerBase):
    id: int
    # Add computed fields for frontend compatibility
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    birthYear: Optional[int] = None
    idSlcr: Optional[str] = None
    club_name: Optional[str] = None
    category_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RacerPublic(BaseModel):
    """Veřejná varianta závodníka - bez kontaktních údajů (telefon, email)."""
    id: int
    name: Optional[str] = None
    surname: str
    sex: int
    year: int
    slcr_id: Optional[str] = None
    club_id: Optional[int] = None
    category_id: Optional[int] = None
    club_name: Optional[str] = None
    category_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Club(BaseModel):
    id: int
    name: str
    valid: bool

    model_config = ConfigDict(from_attributes=True)


class ClubCreate(BaseModel):
    name: str


class CategoryBase(BaseModel):
    name: str
    display_name: Optional[str] = None  # zobrazovaný název ("Myšáci dívky")
    min_birth_year: int  # Nejstarší ročník (např. 1990)
    max_birth_year: int  # Nejmladší ročník (např. 2005)
    sex: int  # 0 = mix, 1 = muži, 2 = ženy
    active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    min_birth_year: Optional[int] = None
    max_birth_year: Optional[int] = None
    sex: Optional[int] = None
    active: Optional[bool] = None


class Category(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Areal(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class ArealCreate(BaseModel):
    name: str


class Race(BaseModel):
    id: int
    closed: bool
    datum: Optional[date] = None
    race_nr: Optional[str] = None
    registration: bool
    proposition_file_id: Optional[int] = None
    results_file_id: Optional[int] = None
    proposition_file_path: Optional[str] = None
    results_file_path: Optional[str] = None
    areal_id: Optional[int] = None
    areal_name: Optional[str] = None
    organizer_id: Optional[int] = None
    organizer_name: Optional[str] = None
    race_method_id: int
    season_id: int
    registrations_count: Optional[int] = None
    is_live: bool = False

    model_config = ConfigDict(from_attributes=True)


class RaceRunIn(BaseModel):
    """Údaje o jednom kole závodu (blok 1.KOLO / 2.KOLO v listině)."""
    run_number: int
    course_setter: Optional[str] = None     # STAVITEL TRATI
    gates_count: Optional[int] = None       # BRANEK
    conditions: Optional[str] = None        # PODMÍNKY
    start_time: Optional[str] = None        # ČAS STARTU ("10:00")
    course_length_m: Optional[int] = None   # DÉLKA TRATI

    @field_validator('gates_count', 'course_length_m', mode='before')
    @classmethod
    def empty_to_none(cls, v):
        return None if v in ('', None) else v


class RaceRunOut(RaceRunIn):
    model_config = ConfigDict(from_attributes=True)


class RaceDetailUpdate(BaseModel):
    """Hlavičkové údaje závodu zadávané v timekeeper sekci.

    Počet kol se nenastavuje - kategorie můžou jet různý počet kol, takže
    listina se řídí naměřenými daty. Údaje o kolech se ukládají pro obě kola
    a do hlavičky se tiskne jen to kolo, které je vyplněné.
    """
    model_config = ConfigDict(extra='ignore')
    race_director: Optional[str] = None
    technical_delegate: Optional[str] = None
    chief_timekeeper: Optional[str] = None
    runs: Optional[list[RaceRunIn]] = None


class RaceDetail(BaseModel):
    """Vše, co potřebuje hlavička výsledkové listiny."""
    race_id: int
    race_nr: Optional[str] = None
    race_number_label: Optional[str] = None   # "2025-05" (race_nr bez prefixu JMLP)
    datum: Optional[date] = None
    areal_name: Optional[str] = None
    organizer_id: Optional[int] = None
    organizer_name: Optional[str] = None
    organizer_logo_url: Optional[str] = None
    season_id: int
    season_name: Optional[str] = None
    edition: Optional[int] = None
    edition_label: Optional[str] = None       # "XIX."
    race_director: Optional[str] = None
    technical_delegate: Optional[str] = None
    chief_timekeeper: Optional[str] = None
    runs: list[RaceRunOut] = []


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
    # Klub - buď ID existujícího nebo poznámka pro admina
    club_id: Optional[int] = None
    club_request_note: Optional[str] = None

    @field_validator('racer_name', 'racer_surname', 'racer_slcr_id')
    @classmethod
    def no_formula_prefix(cls, v):
        return _reject_formula_prefix(v)

    @model_validator(mode='after')
    def validate_club(self):
        if not self.club_id and not (self.club_request_note and self.club_request_note.strip()):
            raise ValueError('Musíte vybrat klub nebo uvést poznámku')
        return self


class ClubRequestItem(BaseModel):
    registration_id: int
    race_id: int
    race_name: str
    racer_id: int
    racer_name: str
    registered_at: datetime
    club_request_note: str
    current_club_name: Optional[str] = None


class ResolveClubRequest(BaseModel):
    club_id: Optional[int] = None
    new_club_name: Optional[str] = None

    @model_validator(mode='after')
    def validate_resolution(self):
        if not self.club_id and not (self.new_club_name and self.new_club_name.strip()):
            raise ValueError('Musíte vybrat existující klub nebo zadat název nového')
        return self


class Registration(BaseModel):
    id: int
    race_id: int
    racer_id: int
    registered_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Post (aktuality) schemas
class PostBase(BaseModel):
    title: str
    content: str
    image_file_id: Optional[int] = None
    image_position: Optional[str] = "right"  # "left", "right", "top", "none"
    document_file_id: Optional[int] = None
    published: bool = True


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_file_id: Optional[int] = None
    image_position: Optional[str] = None  # "left", "right", "top", "none"
    document_file_id: Optional[int] = None
    published: Optional[bool] = None


class Post(PostBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Admin schemas
class AdminUserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: bool = True


class AdminUserCreate(AdminUserBase):
    password: str
    role: str = "timekeeper"  # explicitní volba role; "admin" musí být zadán vědomě


class AdminUser(AdminUserBase):
    id: int
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class TokenData(BaseModel):
    admin_id: Optional[int] = None


# File schemas
class FileBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_size: int = 0
    mime_type: Optional[str] = None
    file_type: str = "document"
    folder: Optional[str] = None


class FileCreate(FileBase):
    uploaded_by: Optional[int] = None


class File(FileBase):
    id: int
    uploaded_at: datetime
    uploaded_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


def _empty_to_none(v):
    """Convert empty strings and 'null' to None for optional integer fields."""
    if v == '' or v == 'null':
        return None
    return v


# Race management schemas
class RaceCreate(BaseModel):
    model_config = ConfigDict(extra='ignore')

    datum: Optional[str] = None  # Changed from date to str - will be converted in backend
    race_nr: Optional[str] = None
    registration: bool = False
    proposition_file_id: Optional[int] = None
    results_file_id: Optional[int] = None
    areal_name: Optional[str] = None
    organizer_name: Optional[str] = None
    areal_id: Optional[Union[int, str]] = None
    organizer_id: Optional[Union[int, str]] = None
    race_method_id: Optional[int] = 1
    season_id: Optional[int] = None     # Will be auto-generated
    closed: bool = False

    @field_validator('areal_id', 'organizer_id', 'proposition_file_id', 'results_file_id', 'season_id', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        return _empty_to_none(v)


class RaceUpdate(BaseModel):
    model_config = ConfigDict(extra='ignore')

    datum: Optional[date] = None
    race_nr: Optional[str] = None
    registration: Optional[bool] = None
    proposition_file_id: Optional[int] = None
    results_file_id: Optional[int] = None
    areal_name: Optional[str] = None
    organizer_name: Optional[str] = None
    areal_id: Optional[Union[int, str]] = None
    organizer_id: Optional[Union[int, str]] = None
    race_method_id: Optional[int] = None
    season_id: Optional[int] = None
    closed: Optional[bool] = None

    @field_validator('areal_id', 'organizer_id', 'proposition_file_id', 'results_file_id', 'season_id', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        return _empty_to_none(v)


# ===== Sezóny (ročníky poháru) =====

class SeasonBase(BaseModel):
    year_start: int
    year_end: Optional[int] = None       # dopočítá se jako year_start + 1
    edition: Optional[int] = None        # 19 -> "XIX."
    name: str = "Jihomoravský lyžařský pohár"
    active: bool = True


class SeasonCreate(SeasonBase):
    pass


class SeasonUpdate(BaseModel):
    model_config = ConfigDict(extra='ignore')
    year_end: Optional[int] = None
    edition: Optional[int] = None
    name: Optional[str] = None
    active: Optional[bool] = None


class Season(SeasonBase):
    id: int
    year_end: int
    edition_label: Optional[str] = None   # "XIX."
    season_label: Optional[str] = None    # "2025/2026"
    races_count: int = 0
    documents_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ===== Timekeeper schemas =====

class StartListEntryBase(BaseModel):
    race_id: int
    racer_id: int
    category_id: Optional[int] = None
    start_number: Optional[int] = None
    race_number_id: Optional[int] = None

class StartListEntryCreate(StartListEntryBase):
    pass

class StartListEntryUpdate(BaseModel):
    base_revision: Optional[str] = None
    force_apply: Optional[bool] = False
    start_number: Optional[int] = None
    race_number_id: Optional[int] = None
    race_number_display: Optional[int] = None
    category_id: Optional[int] = None
    racer_name: Optional[str] = None
    racer_surname: Optional[str] = None
    racer_year: Optional[int] = None
    club_name: Optional[str] = None
    name_override: Optional[str] = None
    surname_override: Optional[str] = None
    year_override: Optional[int] = None
    time1: Optional[float] = None
    time2: Optional[float] = None
    dnf: Optional[bool] = None
    dns: Optional[bool] = None
    dsq: Optional[bool] = None
    points: Optional[int] = None

class StartListExcludedUpdate(BaseModel):
    """Vyřazení ze startovky - cílový stav, ne přepínač (viz start_list.py)."""
    excluded: bool

class StartListEntry(StartListEntryBase):
    id: int
    category_rank: Optional[int] = None
    time1: Optional[float] = None
    time2: Optional[float] = None
    time_sum: Optional[float] = None
    dnf: bool = False
    dns: bool = False
    dsq: bool = False
    points: Optional[int] = None
    excluded: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    racer_name: Optional[str] = None
    racer_surname: Optional[str] = None
    racer_year: Optional[int] = None
    racer_sex: Optional[int] = None
    club_name: Optional[str] = None
    category_name: Optional[str] = None
    category_sex: Optional[int] = None
    race_number_actual: Optional[int] = None
    race_number_display: Optional[int] = None
    display_number: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class TimeEntry(BaseModel):
    """For batch time entry"""
    entry_id: int
    base_revision: Optional[str] = None
    force_apply: Optional[bool] = False
    time1: Optional[float] = None
    time2: Optional[float] = None
    dnf: bool = False
    dns: bool = False
    dsq: bool = False

class BatchTimeEntry(BaseModel):
    """Batch update times for multiple racers"""
    entries: list[TimeEntry]

class RaceNumberInfo(BaseModel):
    id: int
    set_number: int
    set_color: str = "rose"
    actual_number: int
    display_number: int
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)
