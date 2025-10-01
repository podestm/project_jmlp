"""
Utility functions used across the application.
"""

from datetime import date, datetime
from typing import Optional
from fastapi import HTTPException, status


def get_current_season_id(reference_date: Optional[date] = None) -> int:
    """
    Dynamicky určí season_id podle data.
    Nová sezóna začíná 1. srpna každého roku.
    
    Args:
        reference_date: Datum pro určení sezóny (pokud None, použije se aktuální datum)
    
    Returns:
        int: season_id (rok kdy sezóna končí)
    
    Příklad:
        - 15.7.2025 -> sezóna 2025 (ještě stará sezóna)
        - 1.8.2025 -> sezóna 2026 (nová sezóna)
        - 15.3.2026 -> sezóna 2026 (pokračuje sezóna)
    """
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


def parse_date_string(date_string: str) -> date:
    """
    Parse date string in various formats to date object.
    
    Args:
        date_string: Date string in format YYYY-MM-DD
        
    Returns:
        date: Parsed date object
        
    Raises:
        ValueError: If date string cannot be parsed
    """
    try:
        return datetime.strptime(date_string, "%Y-%m-%d").date()
    except ValueError as e:
        raise ValueError(f"Invalid date format: {date_string}. Expected YYYY-MM-DD.") from e


def calculate_season_for_date(date_string: str) -> int:
    """
    Calculate season ID for given date string.
    
    Args:
        date_string: Date in YYYY-MM-DD format
        
    Returns:
        int: Season ID
        
    Raises:
        ValueError: If date string is invalid
    """
    race_date = parse_date_string(date_string)
    return get_current_season_id(race_date)


def convert_utf8_field(field_name: str) -> str:
    """
    Generate SQL for converting text field to proper UTF-8 encoding.
    Used for fixing legacy encoding issues with Czech characters.
    
    Args:
        field_name: Name of the database field to convert
        
    Returns:
        str: SQL expression for UTF-8 conversion
    """
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