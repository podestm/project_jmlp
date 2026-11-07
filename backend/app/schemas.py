from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class RacerBase(BaseModel):
    name: str | None = None  # firstName
    surname: str  # lastName
    sex: int
    year: int  # birthYear
    telefon: str | None = None
    email: str | None = None
    slcr_id: str | None = None  # idSlcr
    club_id: int | None = None
    category_id: int | None = None


def _reject_formula_prefix(v):
    """Odmítne hodnoty, které by se v Excelu vyhodnotily jako vzorec (CSV injection)."""
    if isinstance(v, str) and v[:1] in ("=", "+", "-", "@", "\t", "\r"):
        raise ValueError("Hodnota nesmí začínat znakem =, +, -, @ ani tabulátorem")
    return v


def _empty_slcr_id(v):
    """Starší záznamy mají místo chybějícího ID SLČR pomlčku ("-") nebo nulu;
    formulář je při úpravě pošle zpátky. Pomlčka, nula i prázdný text = bez ID."""
    if isinstance(v, str) and (v.strip() in ("", "-") or set(v.strip()) == {"0"}):
        return None
    return v.strip() if isinstance(v, str) else v


class RacerCreate(BaseModel):
    firstName: str  # Will be mapped to 'name' field
    lastName: str  # Will be mapped to 'surname' field
    sex: int
    birthYear: int  # Will be mapped to 'year' field
    club_id: int | None = None
    idSlcr: str | None = None  # Will be mapped to 'slcr_id' field

    @field_validator("idSlcr", mode="before")
    @classmethod
    def empty_slcr_id(cls, v):
        return _empty_slcr_id(v)

    @field_validator("firstName", "lastName", "idSlcr")
    @classmethod
    def no_formula_prefix(cls, v):
        return _reject_formula_prefix(v)


class Racer(RacerBase):
    id: int
    # Add computed fields for frontend compatibility
    firstName: str | None = None
    lastName: str | None = None
    birthYear: int | None = None
    idSlcr: str | None = None
    club_name: str | None = None
    category_name: str | None = None
    slcr_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RacerPublic(BaseModel):
    """Veřejná varianta závodníka - bez kontaktních údajů (telefon, email)."""

    id: int
    name: str | None = None
    surname: str
    sex: int
    year: int
    slcr_id: str | None = None
    club_id: int | None = None
    category_id: int | None = None
    club_name: str | None = None
    category_name: str | None = None

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
    display_name: str | None = None  # zobrazovaný název ("Myšáci dívky")
    min_birth_year: int  # Nejstarší ročník (např. 1990)
    max_birth_year: int  # Nejmladší ročník (např. 2005)
    sex: int  # 0 = mix, 1 = muži, 2 = ženy
    active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    min_birth_year: int | None = None
    max_birth_year: int | None = None
    sex: int | None = None
    active: bool | None = None


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
    datum: date | None = None
    race_nr: str | None = None
    registration: bool
    proposition_file_id: int | None = None
    results_file_id: int | None = None
    proposition_file_path: str | None = None
    results_file_path: str | None = None
    areal_id: int | None = None
    areal_name: str | None = None
    organizer_id: int | None = None
    organizer_name: str | None = None
    race_method_id: int
    season_id: int
    registrations_count: int | None = None
    is_live: bool = False
    is_final: bool = False

    model_config = ConfigDict(from_attributes=True)


class RaceRunIn(BaseModel):
    """Údaje o jednom kole závodu (blok 1.KOLO / 2.KOLO v listině)."""

    run_number: int
    course_setter: str | None = None  # STAVITEL TRATI
    gates_count: int | None = None  # BRANEK
    conditions: str | None = None  # PODMÍNKY
    start_time: str | None = None  # ČAS STARTU ("10:00")
    course_length_m: str | None = None  # DÉLKA TRATI ("400m, 7 stanovišť")

    @field_validator("gates_count", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        return None if v in ("", None) else v

    @field_validator("course_length_m", mode="before")
    @classmethod
    def length_text(cls, v):
        if v is None:
            return None
        text = str(v).strip()
        return text[:60] or None


class RaceRunOut(RaceRunIn):
    model_config = ConfigDict(from_attributes=True)


class RaceDetailUpdate(BaseModel):
    """Hlavičkové údaje závodu zadávané v timekeeper sekci.

    Počet kol se nenastavuje - kategorie můžou jet různý počet kol, takže
    listina se řídí naměřenými daty. Údaje o kolech se ukládají pro obě kola
    a do hlavičky se tiskne jen to kolo, které je vyplněné.
    """

    model_config = ConfigDict(extra="ignore")
    race_director: str | None = None
    technical_delegate: str | None = None
    chief_timekeeper: str | None = None
    runs: list[RaceRunIn] | None = None


class RaceDetail(BaseModel):
    """Vše, co potřebuje hlavička výsledkové listiny."""

    race_id: int
    race_nr: str | None = None
    race_number_label: str | None = None  # "2025-05" (race_nr bez prefixu JMLP)
    datum: date | None = None
    areal_name: str | None = None
    organizer_id: int | None = None
    organizer_name: str | None = None
    organizer_logo_url: str | None = None
    sponsors_url: str | None = None  # pruh sponzorů pod výsledkovou listinou
    season_id: int
    season_name: str | None = None
    edition: int | None = None
    edition_label: str | None = None  # "XIX."
    race_director: str | None = None
    technical_delegate: str | None = None
    chief_timekeeper: str | None = None
    runs: list[RaceRunOut] = []


class RegistrationCreate(BaseModel):
    race_id: int
    # Pro existujícího závodníka
    racer_id: int | None = None
    # Pro nového závodníka
    racer_name: str | None = None
    racer_surname: str | None = None
    racer_sex: int | None = None
    racer_year: int | None = None
    racer_telefon: str | None = None
    racer_email: str | None = None
    racer_slcr_id: str | None = None
    # Klub - buď ID existujícího nebo poznámka pro admina
    club_id: int | None = None
    club_request_note: str | None = None

    @field_validator("racer_slcr_id", mode="before")
    @classmethod
    def empty_slcr_id(cls, v):
        return _empty_slcr_id(v)

    @field_validator("racer_name", "racer_surname", "racer_slcr_id")
    @classmethod
    def no_formula_prefix(cls, v):
        return _reject_formula_prefix(v)

    @model_validator(mode="after")
    def validate_club(self):
        if not self.club_id and not (self.club_request_note and self.club_request_note.strip()):
            raise ValueError("Musíte vybrat klub nebo uvést poznámku")
        return self


class ClubRequestItem(BaseModel):
    registration_id: int
    race_id: int
    race_name: str
    racer_id: int
    racer_name: str
    registered_at: datetime
    club_request_note: str
    current_club_name: str | None = None


class ResolveClubRequest(BaseModel):
    club_id: int | None = None
    new_club_name: str | None = None

    @model_validator(mode="after")
    def validate_resolution(self):
        if not self.club_id and not (self.new_club_name and self.new_club_name.strip()):
            raise ValueError("Musíte vybrat existující klub nebo zadat název nového")
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
    image_file_id: int | None = None
    image_position: str | None = "right"  # "left", "right", "top", "none"
    document_file_id: int | None = None
    published: bool = True


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    image_file_id: int | None = None
    image_position: str | None = None  # "left", "right", "top", "none"
    document_file_id: int | None = None
    published: bool | None = None


class Post(PostBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Admin schemas
class AdminUserBase(BaseModel):
    email: str
    full_name: str | None = None
    is_active: bool = True


class AdminUserCreate(AdminUserBase):
    password: str
    role: str = "timekeeper"  # explicitní volba role; "admin" musí být zadán vědomě


class AdminUser(AdminUserBase):
    id: int
    # Role přihlášeného: časomíra podle ní ukazuje "Admin"/"Časoměřič"
    # a přepínač do administrace (ten dostanou jen správci).
    role: str | None = None
    last_login: datetime | None = None
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
    admin_id: int | None = None


# File schemas
class FileBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_size: int = 0
    mime_type: str | None = None
    file_type: str = "document"
    folder: str | None = None


class FileCreate(FileBase):
    uploaded_by: int | None = None


class File(FileBase):
    id: int
    uploaded_at: datetime
    uploaded_by: int | None = None

    model_config = ConfigDict(from_attributes=True)


def _empty_to_none(v):
    """Convert empty strings and 'null' to None for optional integer fields."""
    if v == "" or v == "null":
        return None
    return v


# Race management schemas
class RaceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    datum: str | None = None  # Changed from date to str - will be converted in backend
    race_nr: str | None = None
    registration: bool = False
    proposition_file_id: int | None = None
    results_file_id: int | None = None
    areal_name: str | None = None
    organizer_name: str | None = None
    areal_id: int | str | None = None
    organizer_id: int | str | None = None
    race_method_id: int | None = 1
    season_id: int | None = None  # Will be auto-generated
    closed: bool = False
    is_final: bool = False

    @field_validator(
        "areal_id",
        "organizer_id",
        "proposition_file_id",
        "results_file_id",
        "season_id",
        mode="before",
    )
    @classmethod
    def empty_string_to_none(cls, v):
        return _empty_to_none(v)


class RaceUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    datum: date | None = None
    race_nr: str | None = None
    registration: bool | None = None
    proposition_file_id: int | None = None
    results_file_id: int | None = None
    areal_name: str | None = None
    organizer_name: str | None = None
    areal_id: int | str | None = None
    organizer_id: int | str | None = None
    race_method_id: int | None = None
    season_id: int | None = None
    closed: bool | None = None
    is_final: bool | None = None

    @field_validator(
        "areal_id",
        "organizer_id",
        "proposition_file_id",
        "results_file_id",
        "season_id",
        mode="before",
    )
    @classmethod
    def empty_string_to_none(cls, v):
        return _empty_to_none(v)


# ===== Sezóny (ročníky poháru) =====


class SeasonBase(BaseModel):
    year_start: int
    year_end: int | None = None  # dopočítá se jako year_start + 1
    edition: int | None = None  # 19 -> "XIX."
    name: str = "Jihomoravský lyžařský pohár"


class SeasonCreate(SeasonBase):
    pass


class SeasonUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    year_end: int | None = None
    edition: int | None = None
    name: str | None = None


class Season(SeasonBase):
    id: int
    year_end: int
    is_current: bool = False  # aktuální sezóna (nastavuje se zvlášť)
    edition_label: str | None = None  # "XIX."
    season_label: str | None = None  # "2025/2026"
    races_count: int = 0
    documents_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ===== Timekeeper schemas =====


class StartListEntryBase(BaseModel):
    race_id: int
    racer_id: int
    category_id: int | None = None
    start_number: int | None = None
    race_number_id: int | None = None


class StartListEntryCreate(StartListEntryBase):
    pass


class StartListEntryUpdate(BaseModel):
    base_revision: str | None = None
    force_apply: bool | None = False
    start_number: int | None = None
    race_number_id: int | None = None
    race_number_display: str | None = None
    category_id: int | None = None
    racer_name: str | None = None
    racer_surname: str | None = None
    racer_year: int | None = None
    club_name: str | None = None
    name_override: str | None = None
    surname_override: str | None = None
    year_override: int | None = None
    time1: float | None = None
    time2: float | None = None
    dnf: bool | None = None
    dns: bool | None = None
    dsq: bool | None = None
    points: int | None = None


class StartListExcludedUpdate(BaseModel):
    """Vyřazení ze startovky - cílový stav, ne přepínač (viz start_list.py)."""

    excluded: bool


class StartListEntry(StartListEntryBase):
    id: int
    category_rank: int | None = None
    time1: float | None = None
    time2: float | None = None
    time_sum: float | None = None
    dnf: bool = False
    dns: bool = False
    dsq: bool = False
    points: int | None = None
    excluded: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
    racer_name: str | None = None
    racer_surname: str | None = None
    racer_year: int | None = None
    racer_sex: int | None = None
    club_name: str | None = None
    category_name: str | None = None
    category_sex: int | None = None
    race_number_actual: int | None = None
    race_number_display: str | None = None
    display_number: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TimeEntry(BaseModel):
    """For batch time entry"""

    entry_id: int
    base_revision: str | None = None
    force_apply: bool | None = False
    time1: float | None = None
    time2: float | None = None
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
    display_number: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)
