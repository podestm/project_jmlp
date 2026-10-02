from sqlalchemy import Integer, BigInteger, SmallInteger, String, ForeignKey, Date, Boolean, DateTime, UniqueConstraint, Enum, Numeric
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


class AttachmentOwner(str, enum.Enum):
    """Typ vlastníka přílohy - viz Attachment.owner_type."""
    race = "race"
    post = "post"
    season = "season"
    club = "club"
    library = "library"


class AttachmentRole(str, enum.Enum):
    """Role přílohy u vlastníka - viz Attachment.role."""
    propozice = "propozice"
    vysledky = "vysledky"
    prubezne = "prubezne"
    image = "image"
    document = "document"
    logo = "logo"
    sponzori = "sponzori"
    other = "other"


# Lidsky čitelné popisky rolí (české, pro UI i pro kontrolu použití souboru)
ATTACHMENT_ROLE_LABELS = {
    AttachmentRole.propozice: "Propozice",
    AttachmentRole.vysledky: "Výsledky",
    AttachmentRole.prubezne: "Průběžné výsledky",
    AttachmentRole.image: "Obrázek",
    AttachmentRole.document: "Dokument",
    AttachmentRole.logo: "Logo",
    AttachmentRole.sponzori: "Sponzoři",
    AttachmentRole.other: "Ostatní",
}

# Které role smí mít který vlastník.
# Závod má propozice, výsledky a pruh s logy sponzorů pod výsledkovou listinou -
# vždy nejvýše jeden soubor od každé.
ATTACHMENT_ROLES_BY_OWNER = {
    AttachmentOwner.race: (AttachmentRole.propozice, AttachmentRole.vysledky, AttachmentRole.sponzori),
    AttachmentOwner.post: (AttachmentRole.image, AttachmentRole.document),
    AttachmentOwner.season: (AttachmentRole.vysledky, AttachmentRole.prubezne, AttachmentRole.document),
    AttachmentOwner.club: (AttachmentRole.logo,),
    AttachmentOwner.library: (AttachmentRole.document, AttachmentRole.image, AttachmentRole.other),
}

# Skupiny rolí, ze kterých smí mít vlastník dohromady nejvýše jeden dokument.
# Nahrazují původní jednosloupcové vazby (race.results_file_id atd.).
#
# U sezóny jsou průběžné a celkové výsledky ve stejné skupině: v průběhu sezóny
# platí průběžné pořadí, po jejím skončení ho nahradí celkové. Obojí zároveň
# z podstaty věci neexistuje.
ATTACHMENT_EXCLUSIVE_GROUPS = {
    AttachmentOwner.race: (
        (AttachmentRole.propozice,),
        (AttachmentRole.vysledky,),
        (AttachmentRole.sponzori,),
    ),
    AttachmentOwner.post: (
        (AttachmentRole.image,),
        (AttachmentRole.document,),
    ),
    AttachmentOwner.season: (
        (AttachmentRole.vysledky, AttachmentRole.prubezne),
    ),
    AttachmentOwner.club: (
        (AttachmentRole.logo,),
    ),
}


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
    # Jediný zobrazovaný název - web, timekeeper i PDF ("Myšáci dívky").
    # Když je NULL, složí se z name + sex (viz utils.compose_category_name).
    display_name: Mapped[str | None] = mapped_column(
        String(120, collation='utf8mb4_unicode_ci'), nullable=True)
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
    race_nr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    registration: Mapped[bool] = mapped_column(BitBoolean)
    timekeeper_category_order: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # Dokumenty závodu (propozice, výsledky) jsou přílohy - viz Attachment.
    areal_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_areal.id"), nullable=True)
    organizer_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    race_method_id: Mapped[int] = mapped_column(BigInteger)
    season_id: Mapped[int] = mapped_column(BigInteger)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    # Hlavička výsledkové listiny - vyplňuje časoměřič před závodem.
    # Čisté utf8mb4, čte se prostým SELECTem bez fix_encoding.
    race_director: Mapped[str | None] = mapped_column(
        String(120, collation='utf8mb4_unicode_ci'), nullable=True)
    technical_delegate: Mapped[str | None] = mapped_column(
        String(120, collation='utf8mb4_unicode_ci'), nullable=True)
    chief_timekeeper: Mapped[str | None] = mapped_column(
        String(120, collation='utf8mb4_unicode_ci'), nullable=True)
    # Nepoužívá se: počet kol není vlastnost závodu (jedna kategorie může jet
    # obě kola a jiná jen jedno), listina se řídí naměřenými daty. Sloupec je
    # v databázi NOT NULL, proto tu zůstává namapovaný.
    run_count: Mapped[int] = mapped_column(SmallInteger, default=1)


class RaceRun(Base):
    """Údaje o jednom kole závodu - blok 1.KOLO / 2.KOLO ve výsledkové listině.

    Ukládají se obě kola; do hlavičky listiny se tiskne jen to vyplněné.
    """
    __tablename__ = "fuj_jmlp_race_run"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    race_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    run_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    course_setter: Mapped[str | None] = mapped_column(
        String(120, collation='utf8mb4_unicode_ci'), nullable=True)
    gates_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conditions: Mapped[str | None] = mapped_column(
        String(120, collation='utf8mb4_unicode_ci'), nullable=True)
    # Jen popisek do listiny ("10:00") - jako TIME by z překlepu byla chyba 500.
    start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    course_length_m: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("race_id", "run_number", name="uq_race_run"),
    )


class Registration(Base):
    __tablename__ = "fuj_jmlp_race_registration"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    race_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_race.id"))
    racer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_racer.id"))
    category_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_category.id"), nullable=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    club_request_note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        UniqueConstraint("race_id", "racer_id", name="uq_race_racer"),
    )


class Post(Base):
    __tablename__ = "fuj_jmlp_posts"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(String)
    # Obrázek a dokument příspěvku jsou přílohy - viz Attachment.
    # image_file_id / document_file_id se do odpovědi doplňují z příloh
    # (services/attachments.py::apply_post_documents), sloupce už neexistují.
    image_position: Mapped[str | None] = mapped_column(String(20), nullable=True, default="right")  # "left", "right", "top", "none"
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
    # Knihovna je plochá: soubor nemá složku ani sezónu. Kam patří, říká
    # příloha (viz Attachment), jak se jmenuje, říká services/naming.py.
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    uploaded_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class Attachment(Base):
    """Univerzální vazba souboru na vlastníka.

    Nahrazuje pět dřívějších samostatných vazeb (race.proposition_file_id,
    race.results_file_id, posts.image_file_id, posts.document_file_id
    a celou tabulku fuj_jmlp_season_results).

    owner_type / owner_id:
        'race'    -> fuj_jmlp_race.id
        'post'    -> fuj_jmlp_posts.id
        'season'  -> rok začátku sezóny (fuj_jmlp_season.year_start)
        'club'    -> fuj_jmlp_club.id
        'library' -> NULL (soubor zatím nikam nepatří)
    """
    __tablename__ = "fuj_jmlp_attachment"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    file_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    owner_type: Mapped[str] = mapped_column(String(16), nullable=False)
    owner_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    role: Mapped[str] = mapped_column(String(24), nullable=False)
    # Vlastní název přílohy tu byl a zrušil se - soubor má jediný název,
    # svůj vlastní (File.original_filename).
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # 1 = soubor vygenerovala aplikace (nikoli ruční upload)
    is_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class Season(Base):
    """Ročník poháru. season_id v ostatních tabulkách == year_start."""
    __tablename__ = "fuj_jmlp_season"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    year_start: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    year_end: Mapped[int] = mapped_column(Integer, nullable=False)
    edition: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 19 -> "XIX."
    name: Mapped[str] = mapped_column(String(160, collation='utf8mb4_unicode_ci'), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VisitorLog(Base):
    __tablename__ = "fuj_jmlp_visitor_log"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv6 support
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class RaceNumber(Base):
    __tablename__ = "fuj_jmlp_race_numbers"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    set_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    set_color: Mapped[str] = mapped_column(String(20), nullable=False, default="rose")
    actual_number: Mapped[int] = mapped_column(Integer, nullable=False)
    display_number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("set_number", "actual_number", name="uq_race_numbers_set_actual"),
    )


class StartListEntry(Base):
    __tablename__ = "fuj_jmlp_race_start_list"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    race_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_race.id"), nullable=False, index=True)
    racer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_racer.id"), nullable=False, index=True)
    category_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_category.id"), nullable=True, index=True)
    start_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    race_number_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("fuj_jmlp_race_numbers.id"), nullable=True, index=True)
    racer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    racer_surname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    racer_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    racer_sex: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    club_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category_sex: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    race_number_actual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    race_number_display: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time1: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    time2: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    time_sum: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    dnf: Mapped[bool] = mapped_column(Boolean, default=False)  # Did Not Finish
    dns: Mapped[bool] = mapped_column(Boolean, default=False)  # Did Not Start
    dsq: Mapped[bool] = mapped_column(Boolean, default=False)  # Disqualified
    points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name_override: Mapped[str | None] = mapped_column(String(255), nullable=True)
    surname_override: Mapped[str | None] = mapped_column(String(255), nullable=True)
    year_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Vyřazený ze startky (nedorazil, nestihl start). Řádek zůstává i s časy,
    # aby šel vrátit; dokud je vyřazený, nepatří na startovku, do časů,
    # výsledků ani bodů. Nastavuje PUT /api/timekeeper/start-list/{id}/excluded.
    excluded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("race_id", "race_number_id", name="uq_start_list_race_number"),
    )
