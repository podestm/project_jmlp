from datetime import date, datetime
from typing import Optional
from fastapi import HTTPException, status


def fix_encoding(text: str) -> str:
    if not text:
        return text

    # Check for signs of double-encoded UTF-8 (UTF-8 bytes misread as Latin-1)
    # Common markers: Ã, Â, Å, Ä followed by other garbled bytes
    if any(marker in text for marker in ['Ã', 'Â', 'Å', 'Ä']):
        try:
            return text.encode('latin1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass

    return text


def get_current_season_id(reference_date: Optional[date] = None) -> int:
    if reference_date is None:
        reference_date = date.today()
    
    year = reference_date.year
    
    # Pokud jsme před 1. srpnem, patříme do sezóny tohoto roku
    # Pokud jsme od 1. srpna, patříme do sezóny následujícího roku
    if reference_date.month >= 8:  # srpen a později
        season_id = year + 1
    else:  # leden až červenec
        season_id = year
    
    return season_id


def get_current_season(reference_date: Optional[date] = None) -> dict:
    season_id = get_current_season_id(reference_date)
    return {
        'year_start': season_id - 1,
        'year_end': season_id
    }


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


def get_category_for_birth_year(birth_year: int, racer_sex: int, db) -> Optional[int]:
    from sqlalchemy import and_, or_
    from .models import Category
    
    # Najdi aktivní kategorii, kde birth_year spadá do rozmezí a pohlaví se shoduje
    # Kategorie s sex=0 (mix) jsou univerzální pro všechna pohlaví
    category = db.query(Category).filter(
        and_(
            Category.active == True,
            Category.min_birth_year <= birth_year,
            Category.max_birth_year >= birth_year,
            or_(
                Category.sex == 0,  # Mix kategorie
                Category.sex == racer_sex  # Kategorie pro konkrétní pohlaví
            )
        )
    ).order_by(Category.sex.desc()).first()  # Preferuj specifické kategorie před mix
    
    return category.id if category else None