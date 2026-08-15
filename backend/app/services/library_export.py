"""Rozvržení souborů do složek ZIP archivu knihovny.

Archiv se stahuje jednou za čas kvůli záloze, takže složky kopírují to, co
člověk hledá: závody, sezóny, kluby, články. Soubor, který nikam nepatří,
končí v „nezarazene".
"""
import re
from collections import defaultdict
from pathlib import PurePosixPath
from typing import Any, Dict, List, Optional

from ..models import AttachmentOwner
from . import naming

ZIP_FOLDERS = {
    AttachmentOwner.race.value: "zavody",
    AttachmentOwner.season.value: "sezony",
    AttachmentOwner.club.value: "kluby",
    AttachmentOwner.post.value: "clanky",
}

_UNSORTED = "nezarazene"

_PATH_SEPARATORS = re.compile(r"[\\/]+")


def zip_folder_for(owner_type: Optional[str]) -> str:
    """Složka v archivu podle toho, k čemu je soubor připojený."""
    return ZIP_FOLDERS.get(owner_type or "", _UNSORTED)


def zip_entry_names(files: List[Dict[str, Any]]) -> Dict[int, str]:
    """Mapa file_id -> „složka/název" pro celý archiv.

    Soubor použitý na víc místech leží v archivu jen jednou, ve složce podle
    prvního použití - kopie by jen nafoukly archiv.
    """
    taken: Dict[str, set] = defaultdict(set)
    entries: Dict[int, str] = {}

    for file_info in files:
        usage = file_info.get("usage_info") or []
        folder = zip_folder_for(usage[0].get("owner_type") if usage else None)

        # Lomítko ve starém názvu by v archivu založilo podsložku, případně
        # (u „../") vedlo mimo něj.
        raw_name = _PATH_SEPARATORS.sub("-", file_info.get("original_filename") or "").strip()
        name = PurePosixPath(raw_name or f"soubor-{file_info['id']}")

        unique = naming.unique_name(name.stem, name.suffix, taken[folder])
        taken[folder].add(unique)
        entries[file_info["id"]] = f"{folder}/{unique}"

    return entries
