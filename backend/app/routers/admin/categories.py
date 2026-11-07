from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, text
from sqlalchemy.orm import Session

from ... import auth, models, schemas
from ...database import get_db
from ...utils import category_display_name, fix_encoding

router = APIRouter(tags=["admin-categories"])


@router.get("/categories")
def get_categories(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
) -> list[schemas.Category]:
    """Get all categories."""
    return db.query(models.Category).order_by(models.Category.name).all()


@router.get("/categories/{category_id}", response_model=schemas.Category)
def get_category(
    category_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Get single category details."""
    query = text("""
        SELECT 
            id,
            CONVERT(CONVERT(name USING binary) USING utf8mb4) as name,
            display_name,
            min_birth_year,
            max_birth_year,
            sex,
            active,
            created_at,
            updated_at
        FROM fuj_jmlp_category
        WHERE id = :category_id
    """)
    result = db.execute(query, {"category_id": category_id}).first()
    if not result:
        raise HTTPException(status_code=404, detail="Kategorie nenalezena")

    return schemas.Category(
        id=result.id,
        name=result.name,
        display_name=result.display_name,
        min_birth_year=result.min_birth_year,
        max_birth_year=result.max_birth_year,
        sex=result.sex,
        active=bool(result.active),
        created_at=result.created_at,
        updated_at=result.updated_at,
    )


@router.post("/categories", response_model=schemas.Category)
def create_category(
    category_data: schemas.CategoryCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Create a new category."""
    # Validate birth year range
    if category_data.min_birth_year > category_data.max_birth_year:
        raise HTTPException(
            status_code=400,
            detail="Nejstarší ročník (min_birth_year) musí být menší nebo roven nejmladšímu ročníku (max_birth_year)",
        )

    # Validate sex value
    if category_data.sex not in [0, 1, 2]:
        raise HTTPException(
            status_code=400, detail="Pohlaví musí být 0 (mix), 1 (muži) nebo 2 (ženy)"
        )

    # Check for duplicate combination of name and sex
    existing = (
        db.query(models.Category)
        .filter(
            and_(
                models.Category.name == category_data.name, models.Category.sex == category_data.sex
            )
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Kategorie s tímto názvem a pohlavím již existuje"
        )

    category = models.Category(**category_data.dict())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=schemas.Category)
def update_category(
    category_id: int,
    category_data: schemas.CategoryUpdate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Update an existing category."""
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nenalezena")

    # Update fields
    update_data = category_data.dict(exclude_unset=True)

    # Validate birth year range if both are being updated or if one is being updated
    min_year = update_data.get("min_birth_year", category.min_birth_year)
    max_year = update_data.get("max_birth_year", category.max_birth_year)

    if min_year > max_year:
        raise HTTPException(
            status_code=400, detail="Nejstarší ročník musí být menší nebo roven nejmladšímu ročníku"
        )

    # Validate sex value if being updated
    if "sex" in update_data and update_data["sex"] not in [0, 1, 2]:
        raise HTTPException(
            status_code=400, detail="Pohlaví musí být 0 (mix), 1 (muži) nebo 2 (ženy)"
        )

    # Check for duplicate combination of name and sex if either is being updated
    check_name = update_data.get("name", category.name)
    check_sex = update_data.get("sex", category.sex)

    if ("name" in update_data and update_data["name"] != category.name) or (
        "sex" in update_data and update_data["sex"] != category.sex
    ):
        existing = (
            db.query(models.Category)
            .filter(
                and_(
                    models.Category.name == check_name,
                    models.Category.sex == check_sex,
                    models.Category.id != category_id,
                )
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400, detail="Kategorie s tímto názvem a pohlavím již existuje"
            )

    for key, value in update_data.items():
        setattr(category, key, value)

    # Explicitní nastavení pro bit field - ujišťujeme se, že se správně uloží
    if "active" in update_data:
        category.active = bool(update_data["active"])

    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete a category."""
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nenalezena")

    db.delete(category)
    db.commit()
    return {"message": "Kategorie úspěšně smazána"}


@router.get("/categories/check/coverage")
def check_category_coverage(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """
    Kontroluje pokrytí kategorií od roku 1900 do současnosti podle pohlaví - zjišťuje:
    - Rozsahy roků, které nejsou pokryté žádnou kategorií pro muže/ženy
    - Roky, které se překrývají ve více kategoriích
    - Neaktivní kategorie
    """
    from datetime import datetime

    # Načteme všechny aktivní kategorie
    active_categories = (
        db.query(models.Category)
        .filter(models.Category.active == True)
        .order_by(models.Category.min_birth_year)
        .all()
    )

    # Kontrolujeme od roku 1900 do současného roku
    min_check_year = 1900
    max_check_year = datetime.now().year

    # Najdeme rozmezí roků závodníků v databázi pro info
    racer_years_query = text("""
        SELECT MIN(year) as min_year, MAX(year) as max_year
        FROM fuj_jmlp_racer
        WHERE year IS NOT NULL
    """)
    racer_years = db.execute(racer_years_query).first()

    min_racer_year = racer_years[0] if racer_years and racer_years[0] else None
    max_racer_year = racer_years[1] if racer_years and racer_years[1] else None

    # Kontrola pro jednotlivá pohlaví
    results_by_sex = {}
    all_gaps = []
    all_overlaps = []

    for sex in [1, 2]:  # 1=muži, 2=ženy (mix kategorie se počítají pro obojí)
        sex_name = "Muži" if sex == 1 else "Ženy"

        # Najdeme kategorie relevantní pro toto pohlaví
        relevant_categories = []
        for cat in active_categories:
            if cat.sex == 0 or cat.sex == sex:  # mix kategorie nebo kategorie pro konkrétní pohlaví
                relevant_categories.append(cat)

        gap_years = []
        overlap_details = []

        # Zkontrolujeme všechny roky od 1900 do současnosti
        for year in range(min_check_year, max_check_year + 1):
            matching_categories = []
            for cat in relevant_categories:
                if cat.min_birth_year <= year <= cat.max_birth_year:
                    # Oficiální název z adminu ("Předžáci"), ne kódové označení.
                    # Pohlaví se nedolepuje - název ho už nese (a věta začíná
                    # "Ročník X pro Ženy"); jen u Mix kategorie to jinak není poznat.
                    label = category_display_name(cat) or fix_encoding(cat.name)
                    matching_categories.append(f"{label} (Mix)" if cat.sex == 0 else label)

            if len(matching_categories) == 0:
                gap_years.append(year)
            elif len(matching_categories) > 1:
                overlap_details.append(
                    {
                        "year": year,
                        "categories": matching_categories,
                        "message": f"Ročník {year} pro {sex_name} je pokryt více kategoriemi: {', '.join(matching_categories)}",
                    }
                )

        # Seskupíme mezery do souvislých rozsahů
        gap_ranges = []
        if gap_years:
            range_start = gap_years[0]
            range_end = gap_years[0]

            for i in range(1, len(gap_years)):
                if gap_years[i] == range_end + 1:
                    range_end = gap_years[i]
                else:
                    # Konec aktuálního rozsahu
                    if range_start == range_end:
                        gap_ranges.append(
                            {
                                "start": range_start,
                                "end": range_end,
                                "count": 1,
                                "message": f"Ročník {range_start} pro {sex_name} není pokryt žádnou kategorií",
                            }
                        )
                    else:
                        gap_ranges.append(
                            {
                                "start": range_start,
                                "end": range_end,
                                "count": range_end - range_start + 1,
                                "message": f"Ročníky {range_start}–{range_end} ({range_end - range_start + 1} let) pro {sex_name} nejsou pokryty žádnou kategorií",
                            }
                        )
                    range_start = gap_years[i]
                    range_end = gap_years[i]

            # Přidáme poslední rozsah
            if range_start == range_end:
                gap_ranges.append(
                    {
                        "start": range_start,
                        "end": range_end,
                        "count": 1,
                        "message": f"Ročník {range_start} pro {sex_name} není pokryt žádnou kategorií",
                    }
                )
            else:
                gap_ranges.append(
                    {
                        "start": range_start,
                        "end": range_end,
                        "count": range_end - range_start + 1,
                        "message": f"Ročníky {range_start}–{range_end} ({range_end - range_start + 1} let) pro {sex_name} nejsou pokryty žádnou kategorií",
                    }
                )

        results_by_sex[sex_name] = {
            "gap_ranges": gap_ranges,
            "overlap_details": overlap_details,
            "total_gaps": len(gap_years),
            "total_overlaps": len(overlap_details),
        }

        all_gaps.extend(gap_ranges)
        all_overlaps.extend(overlap_details)

    # Seznam neaktivních kategorií
    inactive_categories = db.query(models.Category).filter(models.Category.active == False).all()

    # `name` je legacy sloupec, proto fix_encoding; `display_name` je oficiální
    # název z adminu a zobrazuje se přednostně. Pohlaví se nepřidává - jde
    # vedle jako samostatný odznak.
    inactive_list = [
        {
            "id": cat.id,
            "name": fix_encoding(cat.name),
            "display_name": (
                fix_encoding(cat.display_name) if (cat.display_name or "").strip() else None
            ),
            "sex": "Mix" if cat.sex == 0 else "Muži" if cat.sex == 1 else "Ženy",
            "range": f"{cat.min_birth_year}-{cat.max_birth_year}",
        }
        for cat in inactive_categories
    ]

    total_gap_ranges = len(all_gaps)
    total_overlap_years = len(all_overlaps)

    status = "ok" if not all_gaps and not all_overlaps else "warning"
    message = "Kategorie jsou správně nastaveny pro celý rozsah 1900–současnost pro obě pohlaví"
    if all_gaps or all_overlaps:
        issues = []
        if all_gaps:
            issues.append(f"{total_gap_ranges} nepokrytých rozsahů")
        if all_overlaps:
            issues.append(f"{total_overlap_years} překrývajících se ročníků")
        message = f"Nalezeny problémy: {', '.join(issues)}"

    return {
        "status": status,
        "message": message,
        "check_range": {
            "min": min_check_year,
            "max": max_check_year,
            "total_years": max_check_year - min_check_year + 1,
        },
        "racer_range": {"min": min_racer_year, "max": max_racer_year} if min_racer_year else None,
        "active_categories": len(active_categories),
        "results_by_sex": results_by_sex,
        "inactive_categories": inactive_list,
    }


@router.post("/categories/recalculate/all")
def recalculate_all_racer_categories(
    current_admin: models.AdminUser = Depends(auth.get_current_admin), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """
    Přepočítá kategorie pro všechny závodníky v tabulce fuj_jmlp_racer
    podle jejich ročníku narození.
    Používat na začátku sezóny nebo po změnách v kategoriích.
    """
    # Načteme všechny závodníky
    racers = db.query(models.Racer).filter(models.Racer.year.isnot(None)).all()

    # Kategorie načteme jednou a vyhodnocujeme v paměti - jinak by šel jeden SELECT
    # na závodníka (2000+ dotazů nad 14řádkovou tabulkou).
    # Řazení odpovídá ORDER BY sex DESC v utils.get_category_snapshot_for_birth_year:
    # kategorie pro konkrétní pohlaví má přednost před mix kategorií.
    active_categories = sorted(
        db.query(models.Category).filter(models.Category.active == True).all(),
        key=lambda c: c.sex,
        reverse=True,
    )

    def resolve_category_id(birth_year, racer_sex):
        for cat in active_categories:
            if cat.min_birth_year <= birth_year <= cat.max_birth_year and cat.sex in (0, racer_sex):
                return cat.id
        return None

    stats = {"total": len(racers), "updated": 0, "unchanged": 0, "no_category": 0}

    for racer in racers:
        old_category_id = racer.category_id
        new_category_id = resolve_category_id(racer.year, racer.sex)

        if old_category_id != new_category_id:
            racer.category_id = new_category_id
            stats["updated"] += 1
        else:
            stats["unchanged"] += 1

        if new_category_id is None:
            stats["no_category"] += 1

    db.commit()

    return {
        "status": "success",
        "message": f"Přepočet dokončen: {stats['updated']} závodníků aktualizováno",
        "stats": stats,
    }
