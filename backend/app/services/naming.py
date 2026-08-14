"""Systematické pojmenování souborů podle místa prvního připojení.

Název se skládá jen tady a volá se z jediného místa - z endpointu pro
nahrání přílohy. Je to výchozí hodnota, ne zámek: v knihovně jde soubor
kdykoli přejmenovat a pak se už sám nepřepíše.
"""
import re
import unicodedata

from ..models import AttachmentRole

# Role -> koncovka v názvu. Bez diakritiky, ať název přežije stažení kamkoli.
ROLE_SUFFIX = {
    AttachmentRole.propozice: "propozice",
    AttachmentRole.vysledky: "vysledky",
    AttachmentRole.prubezne: "prubezne",
    AttachmentRole.image: "obrazek",
    AttachmentRole.document: "dokument",
    AttachmentRole.logo: "logo",
    AttachmentRole.other: "soubor",
}

_FALLBACK_SUFFIX = "soubor"


def slugify(value: str) -> str:
    """Bez diakritiky, malá písmena, cokoli jiného než písmeno a číslo na pomlčku."""
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Za-z0-9]+", "-", ascii_only).strip("-").lower()


def role_suffix(role) -> str:
    """Koncovka pro roli. Neznámá role nesmí shodit pojmenování."""
    try:
        return ROLE_SUFFIX[AttachmentRole(role)]
    except (ValueError, KeyError):
        return _FALLBACK_SUFFIX
