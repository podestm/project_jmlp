"""Systematické pojmenování souborů podle místa prvního připojení.

Název se skládá jen tady a volá se z jediného místa - z endpointu pro
nahrání přílohy. Je to výchozí hodnota, ne zámek: v knihovně jde soubor
kdykoli přejmenovat a pak se už sám nepřepíše.
"""
import re
import unicodedata
from typing import Any, Optional

from ..models import AttachmentOwner, AttachmentRole
from ..utils import fix_encoding

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


def owner_stem(owner_type: str, owner_id: Optional[int], owner: Any) -> Optional[str]:
    """Základ názvu podle vlastníka, bez role a přípony.

    Vrací None pro knihovnu - soubor bez vlastníka nemá z čeho název odvodit
    a nechává si ten, se kterým byl nahraný.
    """
    if owner_type == AttachmentOwner.race.value:
        # Číslo závodu se needituje na malá písmena - "JMLP2025-05" je kód.
        race_nr = getattr(owner, "race_nr", None)
        return race_nr or f"zavod-{owner_id}"

    if owner_type == AttachmentOwner.season.value:
        return f"sezona-{owner_id}-{int(owner_id) + 1}"

    if owner_type == AttachmentOwner.club.value:
        return f"klub-{slugify(fix_encoding(getattr(owner, 'name', '')))}"

    if owner_type == AttachmentOwner.post.value:
        return f"clanek-{owner_id}"

    return None
