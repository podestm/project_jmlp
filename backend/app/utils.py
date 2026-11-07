from datetime import date, datetime
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import and_, or_


def fix_encoding(text: str) -> str:
    if not text:
        return text

    # Check for signs of double-encoded UTF-8 (UTF-8 bytes misread as Latin-1)
    # Common markers: Ã, Â, Å, Ä followed by other garbled bytes
    if any(marker in text for marker in ["Ã", "Â", "Å", "Ä"]):
        try:
            return text.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            replacements = {
                "Å½": "Ž",
                "Å¾": "ž",
                "Å ": "Š",
                "Å¡": "š",
                "Å": "Ř",
                "Å": "ř",
                "Ä": "Č",
                "Ä": "č",
                "Ä": "Ě",
                "Ä": "ě",
                "Å": "Ň",
                "Å": "ň",
                "Å¤": "Ť",
                "Å¥": "ť",
                "Å®": "Ů",
                "Å¯": "ů",
                "Ã": "Á",
                "Ã¡": "á",
                "Ã": "É",
                "Ã©": "é",
                "Ã": "Í",
                "Ã­": "í",
                "Ã": "Ó",
                "Ã³": "ó",
                "Ã": "Ú",
                "Ãº": "ú",
                "Ã": "Ý",
                "Ã½": "ý",
            }
            fixed = text
            for broken, correct in replacements.items():
                fixed = fixed.replace(broken, correct)
            return fixed

    return text


def get_current_season_id(reference_date: Optional[date] = None) -> int:
    if reference_date is None:
        reference_date = date.today()

    year = reference_date.year

    # season_id v databázi je POČÁTEČNÍ rok sezóny.
    # Sezóna 2025 = 1.8.2025 - 31.7.2026 (viz fuj_jmlp_race.season_id)
    if reference_date.month >= 8:  # srpen a později - začíná nová sezóna
        season_id = year
    else:  # leden až červenec - stále běží sezóna začínající loni
        season_id = year - 1

    return season_id


# Pohár se jezdí od roku 2006: sezóna 2025 = XIX. ročník (edition = year_start - 2006)
EDITION_BASE_YEAR = 2006


_ROMAN_NUMERALS = (
    (1000, "M"),
    (900, "CM"),
    (500, "D"),
    (400, "CD"),
    (100, "C"),
    (90, "XC"),
    (50, "L"),
    (40, "XL"),
    (10, "X"),
    (9, "IX"),
    (5, "V"),
    (4, "IV"),
    (1, "I"),
)


def to_roman(number: Optional[int]) -> str:
    """Číslo ročníku na římské číslice (19 -> 'XIX'). Prázdný řetězec pro None."""
    if not number or number <= 0:
        return ""
    result = []
    remaining = int(number)
    for value, numeral in _ROMAN_NUMERALS:
        count, remaining = divmod(remaining, value)
        result.append(numeral * count)
    return "".join(result)


def parse_date_string(date_string: str) -> date:
    try:
        return datetime.strptime(date_string, "%Y-%m-%d").date()
    except ValueError as e:
        raise ValueError(f"Invalid date format: {date_string}. Expected YYYY-MM-DD.") from e


def calculate_season_for_date(date_string: str) -> int:
    race_date = parse_date_string(date_string)
    return get_current_season_id(race_date)


def convert_utf8_field(field_name: str) -> str:
    return f"CONVERT(CONVERT({field_name} USING binary) USING utf8mb4)"


def category_display_sql(alias: str = "cat") -> str:
    """SQL výraz pro zobrazovaný název kategorie.

    Protějšek category_display_name() pro raw SQL dotazy. display_name je čisté
    utf8mb4 (nová data), zatímco name je legacy sloupec a potřebuje konverzi.
    """
    return (
        f"COALESCE(NULLIF({alias}.display_name, ''), CONCAT("
        f"{convert_utf8_field(f'{alias}.name')}, "
        f"CASE {alias}.sex WHEN 2 THEN ' - Ženy' WHEN 1 THEN ' - Muži' ELSE '' END))"
    )


def format_file_size(size_bytes: int) -> str:
    """Převede byty na čitelný formát (jednotné formátování napříč adminem)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def csv_safe(value) -> str:
    """Neutralizuje hodnoty, které by Excel interpretoval jako vzorec (CSV injection)."""
    if value is None:
        return ""
    text = str(value)
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + text
    return text


# Standard HTTP exceptions for consistent error handling
class StandardExceptions:
    """Standard HTTP exceptions with Czech error messages."""

    @staticmethod
    def not_found(detail: str = "Položka nenalezena") -> HTTPException:
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

    @staticmethod
    def bad_request(detail: str = "Neplatný požadavek") -> HTTPException:
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    @staticmethod
    def internal_error(detail: str = "Vnitřní chyba serveru") -> HTTPException:
        return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)

    @staticmethod
    def unauthorized(detail: str = "Nepřihlášený uživatel") -> HTTPException:
        return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

    @staticmethod
    def forbidden(detail: str = "Nemáte oprávnění") -> HTTPException:
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    # Specific domain exceptions
    @staticmethod
    def race_not_found() -> HTTPException:
        return StandardExceptions.not_found("Závod nenalezen")

    @staticmethod
    def racer_not_found() -> HTTPException:
        return StandardExceptions.not_found("Jezdec nenalezen")

    @staticmethod
    def document_not_found() -> HTTPException:
        return StandardExceptions.not_found("Dokument nenalezen")

    @staticmethod
    def file_not_found() -> HTTPException:
        return StandardExceptions.not_found("Soubor nenalezen")

    @staticmethod
    def registration_closed() -> HTTPException:
        return StandardExceptions.bad_request("Registrace pro tento závod je uzavřena")

    @staticmethod
    def file_too_large() -> HTTPException:
        return StandardExceptions.bad_request("Soubor je příliš velký (max 10MB)")

    @staticmethod
    def invalid_file_type() -> HTTPException:
        return StandardExceptions.bad_request("Neplatný typ souboru")

    @staticmethod
    def already_registered() -> HTTPException:
        return StandardExceptions.bad_request("Jezdec je již zaregistrován na tento závod")

    @staticmethod
    def invalid_date_format() -> HTTPException:
        return StandardExceptions.bad_request("Neplatný formát data. Použijte YYYY-MM-DD")


def compose_category_name(name: Optional[str], sex: Optional[int]) -> Optional[str]:
    """Záložní název kategorie, když není vyplněný display_name.

    Skládá "U8 Myšáci" + sex na "U8 Myšáci - Ženy". Pro nová data se používá
    fuj_jmlp_category.display_name ("Myšáci dívky"), který je jediný
    zobrazovaný název napříč webem, timekeeperem i výsledkovou listinou.
    """
    if not name:
        return None
    composed = fix_encoding(name)
    if sex == 2:
        return f"{composed} - Ženy"
    if sex == 1:
        return f"{composed} - Muži"
    return composed


def category_display_name(category) -> Optional[str]:
    """Zobrazovaný název kategorie - display_name, jinak složený z name + sex."""
    if category is None:
        return None
    display_name = getattr(category, "display_name", None)
    if display_name and display_name.strip():
        return fix_encoding(display_name)
    return compose_category_name(category.name, category.sex)


def get_category_snapshot_for_birth_year(
    birth_year: int, racer_sex: int, db
) -> tuple[Optional[int], Optional[str], Optional[int]]:
    from .models import Category

    category = (
        db.query(Category)
        .filter(
            and_(
                Category.active == True,
                Category.min_birth_year <= birth_year,
                Category.max_birth_year >= birth_year,
                or_(
                    Category.sex == 0,
                    Category.sex == racer_sex,
                ),
            )
        )
        .order_by(Category.sex.desc())
        .first()
    )

    if not category:
        return None, None, None

    return category.id, category_display_name(category), category.sex


def get_category_for_birth_year(birth_year: int, racer_sex: int, db) -> Optional[int]:
    category_id, _, _ = get_category_snapshot_for_birth_year(birth_year, racer_sex, db)
    return category_id
