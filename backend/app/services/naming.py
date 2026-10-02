"""Systematické pojmenování souborů podle místa prvního připojení.

Název se skládá jen tady a volá se z jediného místa - z endpointu pro
nahrání přílohy. Je to výchozí hodnota, ne zámek: v knihovně jde soubor
kdykoli přejmenovat a pak se už sám nepřepíše.
"""
import re
import unicodedata
from pathlib import Path
from typing import Any, Iterable, Optional

from sqlalchemy.orm import Session

from .. import models
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
    AttachmentRole.sponzori: "sponzori",
    AttachmentRole.other: "soubor",
}

_FALLBACK_SUFFIX = "soubor"

_PATH_SEPARATORS = re.compile(r"[\\/]+")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


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
        # Chybějící klub nebo prázdný název by dal holé "klub-" - stejný základ
        # pro všechny kluby a hned kolize. Id je nudné, ale rozlišuje.
        return f"klub-{slugify(fix_encoding(getattr(owner, 'name', ''))) or owner_id}"

    if owner_type == AttachmentOwner.post.value:
        return f"clanek-{owner_id}"

    return None


def unique_name(stem: str, extension: str, taken: Iterable[str]) -> str:
    """Název, který se s ničím nesráží. Při kolizi připojí -2, -3, ...

    `taken` jsou existující názvy; porovnává se bez ohledu na velikost písmen,
    protože MySQL kolace je case-insensitive a jinak by vznikly dva soubory,
    které databáze považuje za stejné.
    """
    used = {name.lower() for name in taken}

    candidate = f"{stem}{extension}"
    if candidate.lower() not in used:
        return candidate

    counter = 2
    while True:
        candidate = f"{stem}-{counter}{extension}"
        if candidate.lower() not in used:
            return candidate
        counter += 1


def sanitize_manual_name(name: str, extension: str) -> str:
    """Ručně zadaný název na bezpečný název souboru.

    Diakritika zůstává - na disku leží UUID, takže název na nic citlivého
    nesahá. Příponu určuje skutečný soubor, ne uživatel: `.pdf` přejmenované
    na `.jpg` by rozbilo stahování.
    """
    cleaned = _CONTROL_CHARS.sub("", name or "")
    # Tečky na krajích padají spolu s pomlčkami - z "../../etc/passwd" zbyde
    # po náhradě oddělovačů "..-..-etc-passwd" a ty zbytky cesty tam nemají co dělat.
    cleaned = _PATH_SEPARATORS.sub("-", cleaned).strip().strip("-.").strip()

    if extension and cleaned.lower().endswith(extension.lower()):
        cleaned = cleaned[: -len(extension)].strip()
    elif "." in cleaned:
        # Uříznout se smí jen skutečná přípona, ne kus názvu. "Výsledky 1. kolo"
        # končí na " kolo" - krátké, ale s mezerou, takže to přípona není.
        stem, _, suffix = cleaned.rpartition(".")
        if stem and len(suffix) <= 5 and suffix.isalnum():
            cleaned = stem.strip()

    if not cleaned:
        raise ValueError("Zadejte název souboru")

    return f"{cleaned}{extension}"


def _load_owner(db: Session, owner_type: str, owner_id):
    if owner_type == AttachmentOwner.race.value:
        return db.query(models.Race).filter(models.Race.id == owner_id).first()
    if owner_type == AttachmentOwner.club.value:
        return db.query(models.Club).filter(models.Club.id == owner_id).first()
    return None


def systematic_filename(
    db: Session, owner_type: str, owner_id, role, original_filename: str
) -> Optional[str]:
    """Systematický název pro soubor právě připojený k vlastníkovi.

    None znamená "nech název, jak je" - to platí pro knihovnu, kde není
    z čeho odvodit.
    """
    stem = owner_stem(owner_type, owner_id, _load_owner(db, owner_type, owner_id))
    if not stem:
        return None

    extension = Path(original_filename or "").suffix.lower()
    taken = {
        row[0] for row in db.query(models.File.original_filename).all() if row[0]
    }
    return unique_name(f"{stem}_{role_suffix(role)}", extension, taken)
