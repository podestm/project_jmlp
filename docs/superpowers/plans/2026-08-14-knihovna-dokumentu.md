# Knihovna dokumentů — zjednodušení: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nahradit stromovou knihovnu dokumentů plochým seznamem s filtry, dát souborům systematický název podle místa prvního připojení a umožnit hromadné stažení do ZIPu.

**Architecture:** Soubor (`fuj_jmlp_files`) + vazba (`fuj_jmlp_attachment`) jsou jediné dvě tabulky. Složky, `season_year`, `folder_id` a `attachment.title` se ruší. Název se skládá v jedné funkci v `services/files.py`, volané z jediného místa. Knihovna filtruje na serveru; ZIP bere stejné filtry jako výpis.

**Tech Stack:** FastAPI 0.110, SQLAlchemy 2.0 (raw SQL preferováno), MySQL MyISAM, React 18 + Vite, Bootstrap 5. Testy: pytest (přidává Task 1).

**Spec:** `docs/superpowers/specs/2026-08-14-knihovna-dokumentu-design.md`

---

## Struktura souborů

| Soubor | Odpovědnost |
|---|---|
| `backend/app/services/naming.py` | **nový** — skládání systematického názvu, slugify, řešení kolizí |
| `backend/app/services/library.py` | **přepis** — plochý výpis s filtry, ZIP export; strom a složky pryč |
| `backend/app/services/files.py` | beze změny kromě volání `naming` |
| `backend/app/routers/admin/library.py` | **přepis** — výpis, přejmenování, mazání, export; složky pryč |
| `backend/app/routers/admin/attachments.py` | volá `naming` při nahrání |
| `backend/app/migrations.py` | migrace 008 — přejmenování + zahození sloupců |
| `backend/app/models.py` | `File` bez `season_year`/`folder_id`/`folder`, `Attachment` bez `title`, `Folder` pryč |
| `backend/app/services/attachments.py` | `attachment_dict` bez `title` |
| `frontend/src/config/libraryApi.js` | **přepis** — list s filtry, rename, export |
| `frontend/src/components/admin/DocumentLibrary.jsx` | **přepis** — plochá tabulka s filtry |
| `frontend/src/components/admin/attachments/AttachmentList.jsx` | přejmenování míří na soubor, ne na přílohu |
| `frontend/src/components/admin/attachments/AttachmentSlot.jsx` | odstranit `title` |
| `backend/app/tests/` | **nový** — pytest, jednotkové testy čistých funkcí |

Testy leží v `backend/app/tests/`, protože docker-compose bind-mountuje pouze
`./backend/app`. Jiné umístění by v kontejneru nebylo vidět.

---

## Task 1: Zprovoznit pytest

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/tests/__init__.py`
- Create: `backend/app/tests/test_smoke.py`

- [ ] **Step 1: Přidat pytest do requirements**

V `backend/requirements.txt` na konec:

```
pytest==8.3.3
```

- [ ] **Step 2: Napsat smoke test**

Vytvořit `backend/app/tests/__init__.py` jako prázdný soubor a `backend/app/tests/test_smoke.py`:

```python
"""Ověřuje, že pytest v kontejneru běží a vidí aplikační balíček."""


def test_pytest_runs():
    assert True


def test_app_package_importable():
    from app import models
    assert hasattr(models, "File")
```

- [ ] **Step 3: Přestavět image a spustit test**

```bash
docker compose build backend && docker compose up -d backend && sleep 8
docker compose exec -T backend python -m pytest app/tests -q
```

Očekávaný výstup: `2 passed`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/app/tests/
git commit -m "test: zprovoznit pytest v backendu"
```

---

## Task 2: Slugify a název podle vlastníka

**Files:**
- Create: `backend/app/services/naming.py`
- Create: `backend/app/tests/test_naming.py`

- [ ] **Step 1: Napsat padající test**

`backend/app/tests/test_naming.py`:

```python
from app.services.naming import slugify, role_suffix, ROLE_SUFFIX


def test_slugify_removes_diacritics():
    assert slugify("FreeSki Academy Brno") == "freeski-academy-brno"
    assert slugify("Ski klub Velké Meziříčí") == "ski-klub-velke-mezirici"


def test_slugify_collapses_separators():
    assert slugify("a  b__c--d") == "a-b-c-d"
    assert slugify("  ...  ") == ""


def test_role_suffix_is_ascii_and_known():
    assert role_suffix("propozice") == "propozice"
    assert role_suffix("vysledky") == "vysledky"
    assert role_suffix("image") == "obrazek"
    assert role_suffix("document") == "dokument"
    assert role_suffix("logo") == "logo"
    # neznámá role nesmí shodit pojmenování
    assert role_suffix("neco-jineho") == "soubor"


def test_every_known_role_has_suffix():
    from app.models import AttachmentRole
    for role in AttachmentRole:
        assert role in ROLE_SUFFIX
```

- [ ] **Step 2: Spustit test, ověřit selhání**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `ModuleNotFoundError: No module named 'app.services.naming'`

- [ ] **Step 3: Implementovat**

`backend/app/services/naming.py`:

```python
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
```

- [ ] **Step 4: Spustit test, ověřit průchod**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/naming.py backend/app/tests/test_naming.py
git commit -m "feat: slugify a koncovky rolí pro systematické pojmenování"
```

---

## Task 3: Základ názvu podle vlastníka

**Files:**
- Modify: `backend/app/services/naming.py`
- Modify: `backend/app/tests/test_naming.py`

- [ ] **Step 1: Napsat padající test**

Přidat do `backend/app/tests/test_naming.py`:

```python
from app.services.naming import owner_stem


class FakeRace:
    def __init__(self, race_nr):
        self.race_nr = race_nr


class FakeClub:
    def __init__(self, name):
        self.name = name


def test_owner_stem_race_keeps_race_number_case():
    assert owner_stem("race", 127, FakeRace("JMLP2025-05")) == "JMLP2025-05"


def test_owner_stem_race_without_number_falls_back_to_id():
    assert owner_stem("race", 127, FakeRace(None)) == "zavod-127"


def test_owner_stem_season_spans_two_years():
    assert owner_stem("season", 2025, None) == "sezona-2025-2026"


def test_owner_stem_club_is_slugified():
    assert owner_stem("club", 5, FakeClub("FreeSki Academy Brno")) == "klub-freeski-academy-brno"


def test_owner_stem_post_uses_id():
    assert owner_stem("post", 6, None) == "clanek-6"


def test_owner_stem_library_has_no_systematic_name():
    assert owner_stem("library", None, None) is None
```

- [ ] **Step 2: Spustit test, ověřit selhání**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `ImportError: cannot import name 'owner_stem'`

- [ ] **Step 3: Implementovat**

Přidat do `backend/app/services/naming.py`:

```python
from typing import Any, Optional

from ..models import AttachmentOwner
from ..utils import fix_encoding


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
```

- [ ] **Step 4: Spustit test, ověřit průchod**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/naming.py backend/app/tests/test_naming.py
git commit -m "feat: základ systematického názvu podle vlastníka"
```

---

## Task 4: Řešení kolizí názvů

**Files:**
- Modify: `backend/app/services/naming.py`
- Modify: `backend/app/tests/test_naming.py`

- [ ] **Step 1: Napsat padající test**

Přidat do `backend/app/tests/test_naming.py`:

```python
from app.services.naming import unique_name


def test_unique_name_returns_stem_when_free():
    assert unique_name("JMLP2025-05_propozice", ".pdf", taken=set()) == "JMLP2025-05_propozice.pdf"


def test_unique_name_appends_counter_on_collision():
    taken = {"JMLP2025-05_propozice.pdf"}
    assert unique_name("JMLP2025-05_propozice", ".pdf", taken) == "JMLP2025-05_propozice-2.pdf"


def test_unique_name_skips_multiple_collisions():
    taken = {
        "sezona-2025-2026_dokument.pdf",
        "sezona-2025-2026_dokument-2.pdf",
        "sezona-2025-2026_dokument-3.pdf",
    }
    assert unique_name("sezona-2025-2026_dokument", ".pdf", taken) == "sezona-2025-2026_dokument-4.pdf"


def test_unique_name_is_case_insensitive():
    # MySQL porovnává názvy bez ohledu na velikost písmen, test to musí ctít
    taken = {"jmlp2025-05_propozice.pdf"}
    assert unique_name("JMLP2025-05_propozice", ".pdf", taken) == "JMLP2025-05_propozice-2.pdf"
```

- [ ] **Step 2: Spustit test, ověřit selhání**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `ImportError: cannot import name 'unique_name'`

- [ ] **Step 3: Implementovat**

Přidat do `backend/app/services/naming.py`:

```python
from typing import Iterable


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
```

- [ ] **Step 4: Spustit test, ověřit průchod**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `14 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/naming.py backend/app/tests/test_naming.py
git commit -m "feat: řešení kolizí systematických názvů"
```

---

## Task 5: Sanitizace ručně zadaného názvu

**Files:**
- Modify: `backend/app/services/naming.py`
- Modify: `backend/app/tests/test_naming.py`

- [ ] **Step 1: Napsat padající test**

Přidat do `backend/app/tests/test_naming.py`:

```python
import pytest
from app.services.naming import sanitize_manual_name


def test_sanitize_keeps_diacritics():
    assert sanitize_manual_name("Soutěžní řád XIX. ročník", ".pdf") == "Soutěžní řád XIX. ročník.pdf"


def test_sanitize_forces_real_extension():
    # Uživatel nesmí přepsat příponu - stahování by se rozbilo
    assert sanitize_manual_name("propozice.jpg", ".pdf") == "propozice.pdf"
    assert sanitize_manual_name("propozice", ".pdf") == "propozice.pdf"


def test_sanitize_strips_path_separators():
    assert sanitize_manual_name("../../etc/passwd", ".pdf") == "etc-passwd.pdf"
    assert sanitize_manual_name("a/b\\c", ".pdf") == "a-b-c.pdf"


def test_sanitize_strips_control_characters():
    assert sanitize_manual_name("na\x00zev\ntest", ".pdf") == "nazevtest.pdf"


def test_sanitize_rejects_empty():
    with pytest.raises(ValueError):
        sanitize_manual_name("   ", ".pdf")
    with pytest.raises(ValueError):
        sanitize_manual_name("///", ".pdf")
```

- [ ] **Step 2: Spustit test, ověřit selhání**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `ImportError: cannot import name 'sanitize_manual_name'`

- [ ] **Step 3: Implementovat**

Přidat do `backend/app/services/naming.py`:

```python
_PATH_SEPARATORS = re.compile(r"[\\/]+")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def sanitize_manual_name(name: str, extension: str) -> str:
    """Ručně zadaný název na bezpečný název souboru.

    Diakritika zůstává - na disku leží UUID, takže název na nic citlivého
    nesahá. Příponu určuje skutečný soubor, ne uživatel: `.pdf` přejmenované
    na `.jpg` by rozbilo stahování.
    """
    cleaned = _CONTROL_CHARS.sub("", name or "")
    cleaned = _PATH_SEPARATORS.sub("-", cleaned).strip().strip("-").strip()

    # Uživatelovu příponu zahodíme, ať už jakoukoli
    if extension and cleaned.lower().endswith(extension.lower()):
        cleaned = cleaned[: -len(extension)].strip()
    elif "." in cleaned:
        stem, _, suffix = cleaned.rpartition(".")
        if stem and len(suffix) <= 5:
            cleaned = stem.strip()

    if not cleaned:
        raise ValueError("Zadejte název souboru")

    return f"{cleaned}{extension}"
```

- [ ] **Step 4: Spustit test, ověřit průchod**

```bash
docker compose exec -T backend python -m pytest app/tests/test_naming.py -q
```

Očekávané: `19 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/naming.py backend/app/tests/test_naming.py
git commit -m "feat: sanitizace ručně zadaného názvu souboru"
```

---

## Task 6: Napojit pojmenování na nahrání přílohy

**Files:**
- Modify: `backend/app/services/naming.py`
- Modify: `backend/app/routers/admin/attachments.py:114-144`

- [ ] **Step 1: Doplnit funkci, která si sáhne do databáze**

Přidat do `backend/app/services/naming.py`:

```python
from pathlib import Path

from sqlalchemy.orm import Session

from .. import models


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
```

- [ ] **Step 2: Zavolat ji při nahrání**

V `backend/app/routers/admin/attachments.py` ve funkci `upload_attachment`
nahradit blok, který dnes nastavuje sezónu (`# Sezóna se řídí tím, k čemu…`
až po `db.commit()`), tímto:

```python
    # Systematický název podle místa prvního připojení
    systematic = naming.systematic_filename(
        db, owner_type, normalized_owner_id, role_enum.value, file_record.original_filename
    )
    if systematic:
        file_record.original_filename = systematic
        db.commit()
```

A doplnit import na začátek souboru:

```python
from ...services import naming
```

Zároveň odstranit import `library_service`, který už není potřeba:

```python
from ...services import library as library_service   # <- smazat tento řádek
```

a volání `library_service.refile_to_owner_season(...)` ve funkci
`link_attachment` (soubor se při připojení existujícího souboru nepřejmenovává —
název je dán prvním připojením).

- [ ] **Step 3: Restartovat a ověřit ručně**

```bash
docker compose restart backend && sleep 9
```

Nahrát PDF k závodu 129 jako propozice přes administraci a zkontrolovat:

```bash
docker compose exec -T db mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  -e "SELECT original_filename FROM fuj_jmlp_files ORDER BY id DESC LIMIT 1;"
```

Očekávané: `JMLP2025-09_propozice.pdf`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/naming.py backend/app/routers/admin/attachments.py
git commit -m "feat: systematický název při nahrání přílohy"
```

---

## Task 7: Plochý výpis knihovny s filtry

**Files:**
- Rewrite: `backend/app/services/library.py`
- Create: `backend/app/tests/test_library_filters.py`

- [ ] **Step 1: Napsat padající test na sestavení podmínek**

`backend/app/tests/test_library_filters.py`:

```python
from datetime import date

from app.services.library import LibraryFilters, build_where


def test_no_filters_matches_everything():
    where, params = build_where(LibraryFilters())
    assert where == ""
    assert params == {}


def test_name_filter_uses_like():
    where, params = build_where(LibraryFilters(q="propozice"))
    assert "f.original_filename LIKE :q" in where
    assert params["q"] == "%propozice%"


def test_extension_filter_is_normalised():
    where, params = build_where(LibraryFilters(extension=".PDF"))
    assert params["extension"] == "pdf"


def test_date_range_is_inclusive_on_both_ends():
    where, params = build_where(
        LibraryFilters(date_from=date(2026, 1, 1), date_to=date(2026, 1, 31))
    )
    assert "f.uploaded_at >= :date_from" in where
    assert "f.uploaded_at < :date_to_exclusive" in where
    # horní mez je půlnoc následujícího dne, ať se vejde celý poslední den
    assert params["date_to_exclusive"] == date(2026, 2, 1)


def test_owner_type_filter_uses_attachment_subquery():
    where, params = build_where(LibraryFilters(owner_type="race"))
    assert "fuj_jmlp_attachment" in where
    assert params["owner_type"] == "race"
```

- [ ] **Step 2: Spustit test, ověřit selhání**

```bash
docker compose exec -T backend python -m pytest app/tests/test_library_filters.py -q
```

Očekávané: `ImportError: cannot import name 'LibraryFilters'`

- [ ] **Step 3: Přepsat services/library.py**

Nahradit celý obsah `backend/app/services/library.py`:

```python
"""Knihovna dokumentů - plochý seznam souborů s filtry.

Složky se zrušily: soubor se hledá podle názvu a podle toho, k čemu patří,
ne podle toho, kde leží. Vazby drží fuj_jmlp_attachment.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models
from ..models import AttachmentOwner
from . import attachments as attachment_service

# Vlastníci, podle kterých jde filtrovat. 'library' = soubor bez vazby.
FILTERABLE_OWNERS = tuple(owner.value for owner in AttachmentOwner)


@dataclass(frozen=True)
class LibraryFilters:
    q: Optional[str] = None
    extension: Optional[str] = None
    owner_type: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


def build_where(filters: LibraryFilters) -> Tuple[str, Dict[str, Any]]:
    """Podmínky pro WHERE a jejich parametry. Prázdný filtr = prázdný řetězec."""
    clauses: List[str] = []
    params: Dict[str, Any] = {}

    if filters.q:
        clauses.append("f.original_filename LIKE :q")
        params["q"] = f"%{filters.q}%"

    if filters.extension:
        clauses.append("LOWER(SUBSTRING_INDEX(f.original_filename, '.', -1)) = :extension")
        params["extension"] = filters.extension.lstrip(".").lower()

    if filters.date_from:
        clauses.append("f.uploaded_at >= :date_from")
        params["date_from"] = filters.date_from

    if filters.date_to:
        # Horní mez je půlnoc následujícího dne, ať se vejde celý poslední den
        clauses.append("f.uploaded_at < :date_to_exclusive")
        params["date_to_exclusive"] = filters.date_to + timedelta(days=1)

    if filters.owner_type:
        if filters.owner_type == AttachmentOwner.library.value:
            clauses.append(
                "NOT EXISTS (SELECT 1 FROM fuj_jmlp_attachment a "
                "WHERE a.file_id = f.id AND a.owner_type <> 'library')"
            )
        else:
            clauses.append(
                "EXISTS (SELECT 1 FROM fuj_jmlp_attachment a "
                "WHERE a.file_id = f.id AND a.owner_type = :owner_type)"
            )
            params["owner_type"] = filters.owner_type

    return (" AND ".join(clauses), params)


def list_files(db: Session, filters: LibraryFilters) -> List[Dict[str, Any]]:
    """Soubory odpovídající filtru, od nejnovějšího."""
    where, params = build_where(filters)
    query = "SELECT f.id FROM fuj_jmlp_files f"
    if where:
        query += f" WHERE {where}"
    query += " ORDER BY f.uploaded_at DESC, f.id DESC"

    file_ids = [row[0] for row in db.execute(text(query), params).fetchall()]
    if not file_ids:
        return []

    files = {f.id: f for f in db.query(models.File).filter(models.File.id.in_(file_ids)).all()}
    usage = attachment_service.usage_map(db, file_ids)

    return [{
        "id": file_id,
        "original_filename": files[file_id].original_filename,
        "filename": files[file_id].filename,
        "file_size": files[file_id].file_size,
        "mime_type": files[file_id].mime_type,
        "uploaded_at": files[file_id].uploaded_at,
        "download_url": f"/uploads/documents/{files[file_id].filename}",
        "usage_info": usage.get(file_id, []),
    } for file_id in file_ids if file_id in files]
```

- [ ] **Step 4: Spustit test, ověřit průchod**

```bash
docker compose exec -T backend python -m pytest app/tests/test_library_filters.py -q
```

Očekávané: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/library.py backend/app/tests/test_library_filters.py
git commit -m "feat: plochý výpis knihovny s filtry"
```

---

## Task 8: Mapování souborů do složek ZIPu

**Files:**
- Create: `backend/app/services/library_export.py`
- Create: `backend/app/tests/test_library_export.py`

- [ ] **Step 1: Napsat padající test**

`backend/app/tests/test_library_export.py`:

```python
from app.services.library_export import zip_folder_for, zip_entry_names


def test_zip_folder_per_owner_type():
    assert zip_folder_for("race") == "zavody"
    assert zip_folder_for("season") == "sezony"
    assert zip_folder_for("club") == "kluby"
    assert zip_folder_for("post") == "clanky"
    assert zip_folder_for("library") == "nezarazene"
    assert zip_folder_for(None) == "nezarazene"


def test_entry_names_use_first_owner():
    files = [
        {"id": 1, "original_filename": "JMLP2025-05_propozice.pdf",
         "usage_info": [{"owner_type": "race"}, {"owner_type": "season"}]},
    ]
    assert zip_entry_names(files) == {1: "zavody/JMLP2025-05_propozice.pdf"}


def test_entry_names_put_unattached_in_nezarazene():
    files = [{"id": 2, "original_filename": "Jmlp.jpg", "usage_info": []}]
    assert zip_entry_names(files) == {2: "nezarazene/Jmlp.jpg"}


def test_entry_names_deduplicate_within_folder():
    files = [
        {"id": 1, "original_filename": "stejny.pdf", "usage_info": []},
        {"id": 2, "original_filename": "stejny.pdf", "usage_info": []},
    ]
    names = zip_entry_names(files)
    assert names[1] == "nezarazene/stejny.pdf"
    assert names[2] == "nezarazene/stejny-2.pdf"
```

- [ ] **Step 2: Spustit test, ověřit selhání**

```bash
docker compose exec -T backend python -m pytest app/tests/test_library_export.py -q
```

Očekávané: `ModuleNotFoundError: No module named 'app.services.library_export'`

- [ ] **Step 3: Implementovat**

`backend/app/services/library_export.py`:

```python
"""Skládání ZIPu z knihovny.

V aplikaci složky nejsou, v archivu ale dávají smysl - soubory se roztřídí
podle toho, k čemu patří.
"""
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..models import AttachmentOwner

_FOLDER_BY_OWNER = {
    AttachmentOwner.race.value: "zavody",
    AttachmentOwner.season.value: "sezony",
    AttachmentOwner.club.value: "kluby",
    AttachmentOwner.post.value: "clanky",
}

UNATTACHED_FOLDER = "nezarazene"


def zip_folder_for(owner_type: Optional[str]) -> str:
    return _FOLDER_BY_OWNER.get(owner_type, UNATTACHED_FOLDER)


def zip_entry_names(files: List[Dict[str, Any]]) -> Dict[int, str]:
    """Mapa file_id -> cesta uvnitř ZIPu.

    Soubor na víc objektech jde do složky prvního vlastníka a v archivu je
    jednou. Shodné názvy v jedné složce se očíslují, jinak by se přepsaly.
    """
    entries: Dict[int, str] = {}
    used_per_folder: Dict[str, set] = {}

    for file_obj in files:
        usage = file_obj.get("usage_info") or []
        folder = zip_folder_for(usage[0].get("owner_type") if usage else None)

        name = file_obj["original_filename"] or f"soubor-{file_obj['id']}"
        used = used_per_folder.setdefault(folder, set())

        if name.lower() in used:
            stem, suffix = Path(name).stem, Path(name).suffix
            counter = 2
            while f"{stem}-{counter}{suffix}".lower() in used:
                counter += 1
            name = f"{stem}-{counter}{suffix}"

        used.add(name.lower())
        entries[file_obj["id"]] = f"{folder}/{name}"

    return entries
```

- [ ] **Step 4: Spustit test, ověřit průchod**

```bash
docker compose exec -T backend python -m pytest app/tests/test_library_export.py -q
```

Očekávané: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/library_export.py backend/app/tests/test_library_export.py
git commit -m "feat: mapování souborů do složek ZIPu"
```

---

## Task 9: `usage_info` musí nést owner_type

**Files:**
- Modify: `backend/app/services/attachments.py` (funkce `usage_map`)

Task 8 očekává v `usage_info` klíč `owner_type`, který tam dnes není —
`usage_map` vrací jen `type` (popisek role) a `title`.

- [ ] **Step 1: Rozšířit usage_map**

V `backend/app/services/attachments.py` ve funkci `usage_map` nahradit
sestavení položky:

```python
    for attachment in attachments:
        usage[attachment.file_id].append({
            "type": role_label(attachment.role),
            "title": labels.get((attachment.owner_type, attachment.owner_id), attachment.owner_type),
            "owner_type": attachment.owner_type,
            "owner_id": attachment.owner_id,
            "role": attachment.role,
            "published": bool(attachment.published),
        })
```

Řazení podle `id`, ať je "první vlastník" deterministický — nahradit
`attachments = query.all()` za:

```python
    attachments = query.order_by(models.Attachment.id).all()
```

- [ ] **Step 2: Ověřit, že se nic nerozbilo**

```bash
docker compose restart backend && sleep 9
curl -sk https://localhost:8443/races/127 -o /dev/null -w "%{http_code}\n"
docker compose exec -T backend python -m pytest app/tests -q
```

Očekávané: `200` a všechny testy zelené

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/attachments.py
git commit -m "feat: usage_info nese owner_type, owner_id, role a published"
```

---

## Task 10: Endpointy knihovny

**Files:**
- Rewrite: `backend/app/routers/admin/library.py`

- [ ] **Step 1: Přepsat router**

Nahradit celý obsah `backend/app/routers/admin/library.py`:

```python
"""Knihovna dokumentů - výpis s filtry, přejmenování, mazání, ZIP export."""
import logging
import tempfile
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...database import get_db
from ... import models, auth
from ...services import attachments as attachment_service
from ...services import files as file_service
from ...services import library as library_service
from ...services import library_export
from ...services import naming

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/library", tags=["admin-library"])


def _filters(
    q: Optional[str],
    extension: Optional[str],
    owner_type: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
) -> library_service.LibraryFilters:
    if owner_type and owner_type not in library_service.FILTERABLE_OWNERS:
        allowed = ", ".join(library_service.FILTERABLE_OWNERS)
        raise HTTPException(
            status_code=400,
            detail=f"Neznámý typ objektu: {owner_type}. Povolené: {allowed}",
        )
    return library_service.LibraryFilters(
        q=q, extension=extension, owner_type=owner_type,
        date_from=date_from, date_to=date_to,
    )


@router.get("")
def list_library(
    q: Optional[str] = Query(None),
    extension: Optional[str] = Query(None),
    owner_type: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Soubory odpovídající filtru, od nejnovějšího."""
    files = library_service.list_files(db, _filters(q, extension, owner_type, date_from, date_to))
    total = db.query(models.File).count()
    return {"files": files, "count": len(files), "total": total}


@router.put("/files/{file_id}")
def rename_file(
    file_id: int,
    payload: Dict[str, Any],
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Přejmenuje soubor. Příponu určuje skutečný soubor, ne uživatel."""
    file_record = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Soubor nebyl nalezen")

    extension = Path(file_record.filename or "").suffix.lower()
    try:
        new_name = naming.sanitize_manual_name(payload.get("name"), extension)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    clash = db.query(models.File).filter(
        models.File.original_filename == new_name,
        models.File.id != file_id,
    ).first()
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"Soubor s názvem „{new_name}\" už existuje",
        )

    file_record.original_filename = new_name
    db.commit()
    return {"id": file_record.id, "original_filename": new_name}


@router.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    force: bool = Query(False, description="Smazat i když je soubor použitý"),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    file_record = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="Soubor nebyl nalezen")

    usage = attachment_service.usage_map(db, [file_id]).get(file_id, [])
    if usage and not force:
        places = ", ".join(f"{u['type']}: {u['title']}" for u in usage)
        raise HTTPException(
            status_code=409,
            detail=f"Soubor je používán ({places}) a nelze jej smazat. Nejprve jej odpojte.",
        )

    db.query(models.Attachment).filter(models.Attachment.file_id == file_id).delete(
        synchronize_session=False
    )
    file_service.delete_file_from_disk(file_record)
    db.delete(file_record)
    db.commit()
    return {"message": "Soubor smazán"}


@router.get("/export.zip")
def export_zip(
    background_tasks: BackgroundTasks,
    q: Optional[str] = Query(None),
    extension: Optional[str] = Query(None),
    owner_type: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """ZIP se soubory podle stejných filtrů jako výpis.

    Skládá se do dočasného souboru na disku, ne do paměti - 80 MB krát dva
    uvicorn workery by na dvoujádrovém stroji bylo znát.
    """
    files = library_service.list_files(db, _filters(q, extension, owner_type, date_from, date_to))
    if not files:
        raise HTTPException(status_code=404, detail="Filtru neodpovídá žádný soubor")

    entries = library_export.zip_entry_names(files)

    handle = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    handle.close()
    archive_path = Path(handle.name)

    try:
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for file_obj in files:
                source = Path(file_service.DOCUMENTS_DIR) / file_obj["filename"]
                if source.exists():
                    archive.write(source, entries[file_obj["id"]])
    except OSError:
        archive_path.unlink(missing_ok=True)
        logger.exception("Nepodařilo se sestavit ZIP")
        raise HTTPException(status_code=500, detail="Nepodařilo se sestavit archiv")

    # Dočasný soubor smazat až po odeslání
    background_tasks.add_task(archive_path.unlink, missing_ok=True)

    filename = f"jmlp-dokumenty-{datetime.now().strftime('%Y-%m-%d')}.zip"
    return FileResponse(path=archive_path, media_type="application/zip", filename=filename)
```

- [ ] **Step 2: Ověřit ručně**

```bash
docker compose restart backend && sleep 9
docker compose logs --since 30s backend | grep -iE "error|traceback" | head -3
```

Očekávané: žádný výstup (backend nastartoval)

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/admin/library.py
git commit -m "feat: endpointy knihovny - filtry, přejmenování, ZIP export"
```

---

## Task 11: Migrace — přejmenovat a zahodit složky

**Files:**
- Modify: `backend/app/migrations.py`
- Modify: `backend/app/models.py`

- [ ] **Step 1: Zálohovat databázi**

```bash
set -a && . ./secret/.env && set +a
docker compose exec -T db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction \
  "$MYSQL_DATABASE" | gzip > /tmp/jmlp_pred_plochou_knihovnou.sql.gz
ls -lh /tmp/jmlp_pred_plochou_knihovnou.sql.gz
```

- [ ] **Step 2: Přidat migraci**

V `backend/app/migrations.py` před `MIGRATIONS = (` vložit:

```python
# --------------------------------------------------------------------------
# 008 - plochá knihovna: systematické názvy, konec složek
#
# Ruší strom sezóna -> podsložka -> soubor. Soubor se hledá podle názvu
# a podle toho, k čemu patří; složky k tomu nejsou potřeba.
#
# attachment.title padá taky - byl to druhý název téhož souboru.
# --------------------------------------------------------------------------
def _m_flat_library(conn):
    if not _column_exists(conn, "fuj_jmlp_files", "folder_id"):
        return

    # 1) Popisek z přílohy přenést do názvu souboru, ať se neztratí
    if _column_exists(conn, "fuj_jmlp_attachment", "title"):
        conn.execute(text("""
            UPDATE fuj_jmlp_files f
            JOIN (
                SELECT file_id, MIN(id) AS first_id FROM fuj_jmlp_attachment
                WHERE title IS NOT NULL AND title <> '' GROUP BY file_id
            ) x ON x.file_id = f.id
            JOIN fuj_jmlp_attachment a ON a.id = x.first_id
            SET f.original_filename = CONCAT(
                a.title,
                CASE WHEN a.title LIKE CONCAT('%.', SUBSTRING_INDEX(f.filename, '.', -1))
                     THEN '' ELSE CONCAT('.', SUBSTRING_INDEX(f.filename, '.', -1)) END
            )
            WHERE a.title <> f.original_filename
        """))

    # 2) Systematické názvy pro připojené soubory
    renamed = _rename_attached_files(conn)

    # 3) Teprve po přejmenování zahodit, co už není potřeba
    for column in ("season_year", "folder_id", "folder"):
        if _column_exists(conn, "fuj_jmlp_files", column):
            conn.execute(text(f"ALTER TABLE fuj_jmlp_files DROP COLUMN {column}"))

    if _column_exists(conn, "fuj_jmlp_attachment", "title"):
        conn.execute(text("ALTER TABLE fuj_jmlp_attachment DROP COLUMN title"))

    if _table_exists(conn, "fuj_jmlp_folders"):
        conn.execute(text("DROP TABLE fuj_jmlp_folders"))

    logger.info("Migrace: plochá knihovna, přejmenováno %s souborů", renamed)


def _rename_attached_files(conn) -> int:
    """Systematický název pro každý připojený soubor.

    Běží v Pythonu, ne v SQL - skládání názvu je stejná logika jako
    services/naming.py a v SQL by se rozešla.
    """
    from .services.naming import owner_stem, role_suffix, unique_name

    rows = conn.execute(text("""
        SELECT a.file_id, a.owner_type, a.owner_id, a.role, MIN(a.id) AS first_id,
               f.filename, f.original_filename
        FROM fuj_jmlp_attachment a
        JOIN fuj_jmlp_files f ON f.id = a.file_id
        WHERE a.owner_type <> 'library'
        GROUP BY a.file_id
        ORDER BY MIN(a.id)
    """)).fetchall()

    taken = {
        row[0].lower() for row in
        conn.execute(text("SELECT original_filename FROM fuj_jmlp_files")).fetchall()
        if row[0]
    }

    renamed = 0
    for row in rows:
        owner = None
        if row.owner_type == "race":
            owner = conn.execute(
                text("SELECT race_nr FROM fuj_jmlp_race WHERE id = :i"), {"i": row.owner_id}
            ).first()
        elif row.owner_type == "club":
            owner = conn.execute(
                text("SELECT name FROM fuj_jmlp_club WHERE id = :i"), {"i": row.owner_id}
            ).first()

        stem = owner_stem(row.owner_type, row.owner_id, owner)
        if not stem:
            continue

        extension = ("." + row.filename.rsplit(".", 1)[-1]) if "." in row.filename else ""
        taken.discard((row.original_filename or "").lower())
        new_name = unique_name(f"{stem}_{role_suffix(row.role)}", extension, taken)
        taken.add(new_name.lower())

        if new_name != row.original_filename:
            conn.execute(
                text("UPDATE fuj_jmlp_files SET original_filename = :n WHERE id = :i"),
                {"n": new_name, "i": row.file_id},
            )
            renamed += 1

    return renamed
```

A doplnit `_m_flat_library` na konec n-tice `MIGRATIONS`.

- [ ] **Step 3: Upravit modely**

V `backend/app/models.py`:

- ve třídě `File` smazat řádky `season_year`, `folder_id`, `folder`
  i s komentářem nad nimi
- ve třídě `Attachment` smazat řádek `title`
- celou třídu `Folder` smazat

- [ ] **Step 4: Spustit migraci a ověřit**

```bash
docker compose restart backend && sleep 10
docker compose logs --since 30s backend | grep -iE "Migrace|error" | head -3
```

```bash
set -a && . ./secret/.env && set +a
docker compose exec -T db mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" \
  -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "
SELECT COUNT(*) souboru,
       COUNT(DISTINCT LOWER(original_filename)) ruznych_nazvu FROM fuj_jmlp_files;
SELECT original_filename FROM fuj_jmlp_files ORDER BY id DESC LIMIT 5;"
```

Očekávané: `souboru` = `ruznych_nazvu` (žádné duplicity), názvy ve tvaru
`JMLP2025-05_propozice.pdf`

- [ ] **Step 5: Spustit migraci podruhé (idempotence)**

```bash
docker compose restart backend && sleep 10
docker compose logs --since 30s backend | grep -iE "error|traceback" | head -3
```

Očekávané: žádný výstup

- [ ] **Step 6: Commit**

```bash
git add backend/app/migrations.py backend/app/models.py
git commit -m "feat: migrace na plochou knihovnu se systematickými názvy"
```

---

## Task 12: Odstranit title z API příloh

**Files:**
- Modify: `backend/app/services/attachments.py`
- Modify: `backend/app/routers/admin/attachments.py`
- Modify: `backend/app/routers/documents.py`

- [ ] **Step 1: attachment_dict bez title**

V `backend/app/services/attachments.py` ve funkci `attachment_dict` nahradit
řádek s `title` za:

```python
        # Soubor má jediný název - ten svůj. attachment.title se zrušil.
        "title": file_obj.original_filename if file_obj else None,
```

Ve funkci `attach` smazat parametr `title` a jeho použití při vytváření
`models.Attachment`.

- [ ] **Step 2: Router bez title**

V `backend/app/routers/admin/attachments.py`:

- z `upload_attachment` smazat parametr `title: Optional[str] = Form(None)`
  a jeho předání do `attachment_service.attach`
- z `link_attachment` smazat předání `title`
- z `update_attachment` smazat větev `if "title" in payload:`

- [ ] **Step 3: Veřejné dokumenty čtou název souboru**

V `backend/app/routers/documents.py` v sestavení položky nahradit:

```python
                "title": doc["original_filename"],
```

- [ ] **Step 4: Ověřit**

```bash
docker compose restart backend && sleep 9
curl -sk https://localhost:8443/documents
curl -sk https://localhost:8443/season-results/ -o /dev/null -w "%{http_code}\n"
docker compose exec -T backend python -m pytest app/tests -q
```

Očekávané: JSON bez chyby, `200`, testy zelené

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/attachments.py backend/app/routers/admin/attachments.py backend/app/routers/documents.py
git commit -m "refactor: zrušit attachment.title, název souboru je jediný název"
```

---

## Task 13: Frontend — API klient knihovny

**Files:**
- Rewrite: `frontend/src/config/libraryApi.js`

- [ ] **Step 1: Přepsat klienta**

Nahradit celý obsah `frontend/src/config/libraryApi.js`:

```javascript
/**
 * Knihovna dokumentů - plochý seznam s filtry.
 *
 * Složky se zrušily: soubor se hledá podle názvu a podle toho, k čemu patří.
 */
import { AdminAPI, adminAuthHeaders, fetchBlob } from './api.js';

/** Typy objektů, podle kterých jde filtrovat. Musí sedět s FILTERABLE_OWNERS. */
export const OWNER_FILTERS = [
  { value: '', label: 'Kdekoli' },
  { value: 'race', label: 'Závod' },
  { value: 'season', label: 'Sezóna' },
  { value: 'post', label: 'Článek' },
  { value: 'club', label: 'Klub' },
  { value: 'library', label: 'Nikde nepoužité' }
];

/** Prázdné hodnoty do dotazu nepatří, jinak by se filtrovalo na prázdný řetězec. */
const cleanParams = (filters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));

export const LibraryAPI = {
  list: (filters = {}) => AdminAPI.get('/api/admin/library', cleanParams(filters)),

  rename: (fileId, name) =>
    AdminAPI.put(`/api/admin/library/files/${fileId}`, { name }),

  remove: (fileId, { force = false } = {}) =>
    AdminAPI.delete(`/api/admin/library/files/${fileId}`, {}, { force }),

  /** ZIP se stejnými filtry jako výpis. Vrací Blob, ne URL - kvůli tokenu. */
  exportZip: (filters = {}) => fetchBlob('/api/admin/library/export.zip', {
    params: cleanParams(filters),
    headers: adminAuthHeaders()
  })
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/config/libraryApi.js
git commit -m "feat: API klient ploché knihovny"
```

---

## Task 14: Frontend — plochá tabulka s filtry

**Files:**
- Rewrite: `frontend/src/components/admin/DocumentLibrary.jsx`
- Modify: `frontend/src/assets/styles/admin.css` (odstranit styly stromu)

- [ ] **Step 1: Přepsat komponentu**

Nahradit celý obsah `frontend/src/components/admin/DocumentLibrary.jsx`:

```jsx
import React, { useCallback, useEffect, useState } from 'react';
import { LibraryAPI, OWNER_FILTERS } from '../../config/libraryApi.js';
import { downloadBlob } from '../../config/api.js';
import Alert from '../ui/Alert.jsx';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { useConfirm } from '../../hooks/useConfirm.jsx';
import { formatDateShort } from '../../utils/date.js';
import { formatFileSize, getExtensionBadgeClass, getExtensionLabel } from '../../utils/files.js';

const EMPTY_FILTERS = { q: '', extension: '', owner_type: '', date_from: '', date_to: '' };

/**
 * Knihovna dokumentů - plochý seznam s filtry.
 *
 * Žádné složky: soubor se najde podle názvu, přípony, data nahrání nebo podle
 * toho, k čemu je připojený. Hromadné stažení bere stejné filtry jako výpis.
 */
export default function DocumentLibrary() {
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const { confirm, confirmElement } = useConfirm();

  const load = useCallback(async (activeFilters) => {
    try {
      setLoading(true);
      const data = await LibraryAPI.list(activeFilters);
      setFiles(data.files);
      setTotal(data.total);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtry se aplikují se zpožděním, ať psaní do hledání nepálí dotaz na klávesu
  useEffect(() => {
    const timer = setTimeout(() => load(filters), 250);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const hasFilters = Object.values(filters).some(Boolean);

  const startRename = (file) => {
    setRenamingId(file.id);
    setRenameValue(file.original_filename);
  };

  const submitRename = async (file) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === file.original_filename) return;
    try {
      await LibraryAPI.rename(file.id, name);
      setMessage({ type: 'success', text: 'Soubor přejmenován' });
      load(filters);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  const removeFile = async (file) => {
    const used = file.usage_info?.length > 0;
    const choice = await confirm({
      title: `Smazat „${file.original_filename}"?`,
      message: used
        ? `Soubor je použitý: ${file.usage_info.map((u) => `${u.type} – ${u.title}`).join(', ')}.`
        : 'Soubor se smaže z knihovny i z disku.',
      choices: [{
        value: used ? 'force' : 'delete',
        label: used ? 'Přesto smazat' : 'Smazat',
        variant: 'danger',
        icon: 'bi-trash'
      }]
    });
    if (!choice) return;
    try {
      await LibraryAPI.remove(file.id, { force: choice === 'force' });
      setMessage({ type: 'success', text: 'Soubor smazán' });
      load(filters);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };

  const exportZip = async () => {
    setExporting(true);
    try {
      const blob = await LibraryAPI.exportZip(filters);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `jmlp-dokumenty-${stamp}.zip`);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="mb-0">Dokumenty</h2>
          <small className="text-muted">
            Soubory se nahrávají u závodu, článku, sezóny nebo klubu. Tady se hledají.
          </small>
        </div>
        <button className="btn btn-outline-primary" onClick={exportZip} disabled={exporting || !files.length}>
          {exporting ? <ButtonSpinner /> : <i className="bi bi-file-earmark-zip me-1" />}
          {hasFilters ? 'Stáhnout vyfiltrované' : 'Stáhnout vše'}
        </button>
      </div>

      {message && (
        <Alert key={message.text} type={message.type} message={message.text}
               onDismiss={() => setMessage(null)} />
      )}

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small mb-1">Název</label>
              <input type="search" className="form-control form-control-sm"
                     placeholder="Hledat v názvech…"
                     value={filters.q} onChange={(e) => setFilter('q', e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Typ souboru</label>
              <input type="text" className="form-control form-control-sm" placeholder="pdf"
                     value={filters.extension} onChange={(e) => setFilter('extension', e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Připojeno k</label>
              <select className="form-select form-select-sm" value={filters.owner_type}
                      onChange={(e) => setFilter('owner_type', e.target.value)}>
                {OWNER_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Nahráno od</label>
              <input type="date" className="form-control form-control-sm"
                     value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">do</label>
              <input type="date" className="form-control form-control-sm"
                     value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} />
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">
              Zobrazeno <strong>{files.length}</strong> z <strong>{total}</strong> souborů
            </small>
            {hasFilters && (
              <button className="btn btn-sm btn-link p-0" onClick={() => setFilters(EMPTY_FILTERS)}>
                Zrušit filtry
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && files.length === 0 ? (
        <LoadingState variant="page" label="Načítám knihovnu…" />
      ) : files.length === 0 ? (
        <EmptyState icon="bi-folder2-open"
                    title={hasFilters ? 'Filtru neodpovídá žádný soubor' : 'Knihovna je prázdná'}
                    hint={hasFilters ? 'Zkuste jiné nastavení filtrů.' : 'Nahrajte soubor u závodu, článku nebo sezóny.'} />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Název</th>
                  <th style={{ width: '110px' }}>Velikost</th>
                  <th style={{ width: '110px' }}>Nahráno</th>
                  <th>Použito</th>
                  <th style={{ width: '120px' }} className="text-end">Akce</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <span className={`badge me-2 ${getExtensionBadgeClass(file.original_filename)}`}>
                        {getExtensionLabel(file.original_filename)}
                      </span>
                      {renamingId === file.id ? (
                        <input type="text" className="form-control form-control-sm d-inline-block"
                               style={{ maxWidth: '24rem' }} value={renameValue} autoFocus
                               onChange={(e) => setRenameValue(e.target.value)}
                               onBlur={() => submitRename(file)}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') submitRename(file);
                                 if (e.key === 'Escape') setRenamingId(null);
                               }} />
                      ) : (
                        <a href={file.download_url} target="_blank" rel="noopener noreferrer"
                           className="text-decoration-none text-reset">
                          {file.original_filename}
                        </a>
                      )}
                    </td>
                    <td className="text-nowrap"><small>{formatFileSize(file.file_size)}</small></td>
                    <td className="text-nowrap"><small>{formatDateShort(file.uploaded_at)}</small></td>
                    <td>
                      {file.usage_info?.length ? (
                        <div className="d-flex flex-wrap gap-1">
                          {file.usage_info.map((u, i) => (
                            <span key={i}
                                  className={`badge ${u.published ? 'bg-success' : 'bg-secondary'}`}
                                  title={`${u.type}: ${u.title}`}>
                              {u.title}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <small className="text-muted">nikde</small>
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-link p-0 me-2" onClick={() => startRename(file)}
                              title="Přejmenovat">
                        <i className="bi bi-pencil" />
                      </button>
                      <a className="btn btn-sm btn-link p-0 me-2" href={file.download_url}
                         target="_blank" rel="noopener noreferrer" title="Stáhnout">
                        <i className="bi bi-download" />
                      </a>
                      <button className="btn btn-sm btn-link p-0 text-danger" onClick={() => removeFile(file)}
                              title="Smazat">
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmElement}
    </div>
  );
}
```

- [ ] **Step 2: Odstranit styly stromu**

V `frontend/src/assets/styles/admin.css` smazat celý blok začínající
`/* --- Knihovna dokumentů: jeden strom sezóna -> složka -> soubor --- */`
až po konec pravidla `.library-row.drop-target { … }`, a blok
`/* --- File manager: layout helpers used by DocumentManagement + subcomponents --- */`
až po konec `.file-table-scroll thead th { … }`.

- [ ] **Step 3: Sestavit a nasadit**

```bash
cd frontend && docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/app -w /app node:20-alpine sh -c "npm run build 2>&1 | grep -E 'error|✓ built'"
cd .. && docker compose build frontend && docker compose up -d frontend && sleep 7
curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:8443/admin/documents
```

Očekávané: `✓ built` a `200`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/DocumentLibrary.jsx frontend/src/assets/styles/admin.css
git commit -m "feat: plochá knihovna dokumentů s filtry a exportem"
```

---

## Task 15: Frontend — odstranit title z příloh

**Files:**
- Modify: `frontend/src/components/admin/attachments/AttachmentList.jsx`
- Modify: `frontend/src/components/admin/attachments/AttachmentSlot.jsx`
- Modify: `frontend/src/components/admin/attachments/AttachmentManager.jsx`
- Modify: `frontend/src/components/admin/SeasonManagement.jsx`

- [ ] **Step 1: AttachmentList přejmenovává soubor**

V `AttachmentList.jsx` v `commitRename` volat přejmenování souboru místo
přílohy — komponenta dostane nový prop `onRenameFile`:

```jsx
  const commitRename = (attachment) => {
    const title = draftTitle.trim();
    setEditingId(null);
    if (title && title !== attachment.original_filename) {
      onRenameFile(attachment, title);
    }
  };
```

a `startRename` bere výchozí hodnotu z názvu souboru:

```jsx
  const startRename = (attachment) => {
    setEditingId(attachment.id);
    setDraftTitle(attachment.original_filename);
  };
```

- [ ] **Step 2: AttachmentManager volá knihovnu**

V `AttachmentManager.jsx` nahradit `handleRename`:

```jsx
  const handleRename = (key, attachment, name) => run(
    key,
    () => LibraryAPI.rename(attachment.file_id, name),
    'Soubor přejmenován'
  );
```

a doplnit import:

```jsx
import { LibraryAPI } from '../../../config/libraryApi.js';
```

Předání do `AttachmentList` přejmenovat z `onRename` na `onRenameFile`.

- [ ] **Step 3: AttachmentSlot bez title**

V `AttachmentSlot.jsx` nahradit zobrazení názvu:

```jsx
              {attachment.original_filename}
```

- [ ] **Step 4: Popisek sekce v sezónách**

V `SeasonManagement.jsx` u `AttachmentManager` pro sezónu doplnit prop:

```jsx
                          title={`Dokumenty sezóny ${season.season_label}`}
```

a v `AttachmentManager.jsx` v `SLOT_CONFIG` upravit nápovědu role `document`:

```jsx
  [ROLE.document]: {
    accept: DOCUMENT_ACCEPT,
    hint: 'Zveřejní se na /dokumenty. Název souboru je zároveň popisek na webu.'
  },
```

- [ ] **Step 5: Sestavit, nasadit, ověřit**

```bash
cd frontend && docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/app -w /app node:20-alpine sh -c "npm run build 2>&1 | grep -E 'error|✓ built'"
cd .. && docker compose build frontend && docker compose up -d frontend && sleep 7
for p in /admin/documents /admin/seasons /admin/races /admin/posts; do
  printf "%-20s " "$p"; curl -sk -o /dev/null -w "%{http_code}\n" "https://localhost:8443$p"
done
```

Očekávané: všude `200`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/
git commit -m "refactor: přílohy používají název souboru místo vlastního title"
```

---

## Task 16: Zveřejnit existující soubor na webu

Spec slibuje v knihovně akci, která připojí už nahraný soubor k sezóně jako
veřejný dokument — aby se nemusel nahrávat podruhé.

**Files:**
- Modify: `frontend/src/components/admin/DocumentLibrary.jsx`
- Modify: `frontend/src/config/libraryApi.js`

- [ ] **Step 1: Doplnit volání do API klienta**

Do `frontend/src/config/libraryApi.js` přidat:

```javascript
  /** Připojí existující soubor k sezóně jako veřejný dokument na /dokumenty. */
  publishToSeason: (fileId, seasonYear) =>
    AdminAPI.post('/api/admin/attachments/link', {
      file_id: fileId,
      owner_type: 'season',
      owner_id: seasonYear,
      role: 'document'
    }),

  /** Sezóny pro výběr, kam soubor zveřejnit. */
  seasons: () => AdminAPI.get('/api/admin/seasons'),
```

- [ ] **Step 2: Načíst sezóny a přidat akci do řádku**

V `DocumentLibrary.jsx` doplnit stav a načtení:

```jsx
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    LibraryAPI.seasons().then(setSeasons).catch(() => setSeasons([]));
  }, []);
```

a novou akci:

```jsx
  const publishToWeb = async (file) => {
    const choice = await confirm({
      title: `Zveřejnit „${file.original_filename}" na webu?`,
      message: 'Soubor se připojí k vybrané sezóně a objeví se na stránce /dokumenty.',
      choices: seasons.slice(0, 4).map((s) => ({
        value: String(s.year_start),
        label: `Sezóna ${s.season_label}`,
        variant: 'primary',
        icon: 'bi-globe'
      }))
    });
    if (!choice) return;
    try {
      await LibraryAPI.publishToSeason(file.id, Number(choice));
      setMessage({ type: 'success', text: 'Soubor zveřejněn na /dokumenty' });
      load(filters);
    } catch (err) {
      setMessage({ type: 'danger', text: err.message });
    }
  };
```

- [ ] **Step 3: Přidat tlačítko do sloupce akcí**

V řádku tabulky před tlačítko pro stažení vložit:

```jsx
                      <button className="btn btn-sm btn-link p-0 me-2" onClick={() => publishToWeb(file)}
                              title="Zveřejnit na /dokumenty">
                        <i className="bi bi-globe" />
                      </button>
```

- [ ] **Step 4: Sestavit, nasadit a ověřit**

```bash
cd frontend && docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/app -w /app node:20-alpine sh -c "npm run build 2>&1 | grep -E 'error|✓ built'"
cd .. && docker compose build frontend && docker compose up -d frontend && sleep 7
curl -sk https://localhost:8443/documents
```

Očekávané: po zveřejnění souboru vrátí `/documents` JSON s tou položkou

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/DocumentLibrary.jsx frontend/src/config/libraryApi.js
git commit -m "feat: zveřejnění existujícího souboru na /dokumenty z knihovny"
```

---

## Task 17: Ověřit celek a doplnit dokumentaci

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Projít ověřovací seznam ze specu**

```bash
# Filtry
docker compose exec -T backend python - <<'EOF'
import json, urllib.request
from app.auth import create_access_token
t = create_access_token({"sub": "1"})
def call(path):
    req = urllib.request.Request("http://localhost:8000" + path,
                                 headers={"Authorization": "Bearer " + t})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())
print("vše:        ", call("/api/admin/library")["count"])
print("q=propozice:", call("/api/admin/library?q=propozice")["count"])
print("owner=race: ", call("/api/admin/library?owner_type=race")["count"])
print("owner=library:", call("/api/admin/library?owner_type=library")["count"])
print("pdf:        ", call("/api/admin/library?extension=pdf")["count"])
EOF
```

Očekávané: `vše` = 238, `owner=race` = 206 nebo méně, `pdf` = 231

- [ ] **Step 2: Ověřit ZIP**

Stáhnout přes administraci tlačítkem „Stáhnout vše" a rozbalit:

```bash
cd /tmp && unzip -l jmlp-dokumenty-*.zip | head -20
unzip -l jmlp-dokumenty-*.zip | tail -3
```

Očekávané: složky `zavody/`, `sezony/`, `clanky/`, `nezarazene/`; počet souborů
sedí s počtem ve výpisu

- [ ] **Step 3: Ověřit veřejné API beze změny**

```bash
for p in /races/127 /races/ /posts/ /season-results/ /documents; do
  printf "%-20s " "$p"; curl -sk -o /dev/null -w "%{http_code}\n" "https://localhost:8443$p"
done
```

Očekávané: všude `200`

- [ ] **Step 4: Aktualizovat CLAUDE.md**

Nahradit odstavec o přílohách a knihovně:

```markdown
**Knihovna dokumentů**: `fuj_jmlp_files` (soubor) + `fuj_jmlp_attachment` (kam patří).
Žádné složky — knihovna je plochý seznam s filtry (název, přípona, typ objektu,
datum nahrání) na `GET /api/admin/library`; stejné filtry bere i
`GET /api/admin/library/export.zip`. Soubor dostane systematický název podle
místa prvního připojení (`services/naming.py`, např. `JMLP2025-05_propozice.pdf`)
a dál jde kdykoli ručně přejmenovat. Soubor má **jediný název** — je to zároveň
popisek na webu; `attachment.title` se zrušil.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: popsat plochou knihovnu dokumentů"
```

---

## Ověření na závěr

- [ ] `docker compose exec -T backend python -m pytest app/tests -q` — vše zelené
- [ ] Migrace spuštěná dvakrát bez chyby
- [ ] Žádné dva soubory se stejným názvem (bez ohledu na velikost písmen)
- [ ] Nahrání ke každému ze čtyř míst dá očekávaný název
- [ ] Přejmenování: zachová příponu, odmítne duplicitu i prázdno
- [ ] ZIP: struktura podle vazby, soubor na dvou objektech jednou
- [ ] `/dokumenty` ukáže zveřejněný dokument sezóny pod názvem souboru
- [ ] Veřejné API (`/races/…`, `/posts/…`, `/season-results/`) beze změny
