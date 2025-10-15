from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, text, and_

from ...database import get_db
from ... import models, schemas, auth
from ...utils import get_category_for_birth_year

router = APIRouter(tags=["admin-categories"])


@router.get("/categories", response_model=List[schemas.Category])
def get_categories(
    skip: int = 0,
    limit: int = 100,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """List all categories for admin management."""
    # Use raw SQL with CONVERT for proper UTF-8 encoding
    query = text("""
        SELECT 
            id,
            CONVERT(CONVERT(name USING binary) USING utf8mb4) as name,
            min_birth_year,
            max_birth_year,
            active,
            created_at,
            updated_at
        FROM fuj_jmlp_category
        ORDER BY active DESC, min_birth_year ASC
        LIMIT :limit OFFSET :skip
    """)
    result = db.execute(query, {"limit": limit, "skip": skip})
    categories = []
    for row in result:
        categories.append(schemas.Category(
            id=row[0],
            name=row[1],
            min_birth_year=row[2],
            max_birth_year=row[3],
            active=bool(row[4]),
            created_at=row[5],
            updated_at=row[6]
        ))
    return categories


@router.get("/categories/{category_id}", response_model=schemas.Category)
def get_category(
    category_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get single category details."""
    query = text("""
        SELECT 
            id,
            CONVERT(CONVERT(name USING binary) USING utf8mb4) as name,
            min_birth_year,
            max_birth_year,
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
        id=result[0],
        name=result[1],
        min_birth_year=result[2],
        max_birth_year=result[3],
        active=bool(result[4]),
        created_at=result[5],
        updated_at=result[6]
    )


@router.post("/categories", response_model=schemas.Category)
def create_category(
    category_data: schemas.CategoryCreate,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new category."""
    # Validate birth year range
    if category_data.min_birth_year > category_data.max_birth_year:
        raise HTTPException(
            status_code=400,
            detail="Nejstarší ročník (min_birth_year) musí být menší nebo roven nejmladšímu ročníku (max_birth_year)"
        )
    
    # Check for duplicate name
    existing = db.query(models.Category).filter(
        models.Category.name == category_data.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Kategorie s tímto názvem již existuje")
    
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
    db: Session = Depends(get_db)
):
    """Update an existing category."""
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nenalezena")
    
    # Update fields
    update_data = category_data.dict(exclude_unset=True)
    
    # Validate birth year range if both are being updated or if one is being updated
    min_year = update_data.get('min_birth_year', category.min_birth_year)
    max_year = update_data.get('max_birth_year', category.max_birth_year)
    
    if min_year > max_year:
        raise HTTPException(
            status_code=400,
            detail="Nejstarší ročník musí být menší nebo roven nejmladšímu ročníku"
        )
    
    # Check for duplicate name if name is being updated
    if 'name' in update_data and update_data['name'] != category.name:
        existing = db.query(models.Category).filter(
            models.Category.name == update_data['name']
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Kategorie s tímto názvem již existuje")
    
    for key, value in update_data.items():
        setattr(category, key, value)
    
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
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
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Kontroluje pokrytí kategorií od roku 1900 do současnosti - zjišťuje:
    - Rozsahy roků, které nejsou pokryté žádnou kategorií
    - Roky, které se překrývají ve více kategoriích
    - Neaktivní kategorie
    """
    from datetime import datetime
    
    # Načteme všechny aktivní kategorie
    active_categories = db.query(models.Category).filter(
        models.Category.active == True
    ).order_by(models.Category.min_birth_year).all()
    
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
    
    # Kontrola mezer a překryvů
    gap_years = []
    overlap_details = []
    
    # Zkontrolujeme všechny roky od 1900 do současnosti
    for year in range(min_check_year, max_check_year + 1):
        matching_categories = []
        for cat in active_categories:
            if cat.min_birth_year <= year <= cat.max_birth_year:
                matching_categories.append(cat.name)
        
        if len(matching_categories) == 0:
            gap_years.append(year)
        elif len(matching_categories) > 1:
            overlap_details.append({
                "year": year,
                "categories": matching_categories,
                "message": f"Ročník {year} je pokryt více kategoriemi: {', '.join(matching_categories)}"
            })
    
    # Seskupíme mezery do souvislých rozsahů
    gap_ranges = []
    if gap_years:
        range_start = gap_years[0]
        range_end = gap_years[0]
        
        for i in range(1, len(gap_years)):
            if gap_years[i] == range_end + 1:
                # Pokračující rozsah
                range_end = gap_years[i]
            else:
                # Konec aktuálního rozsahu, začátek nového
                if range_start == range_end:
                    gap_ranges.append({
                        "start": range_start,
                        "end": range_end,
                        "count": 1,
                        "message": f"Ročník {range_start} není pokryt žádnou kategorií"
                    })
                else:
                    gap_ranges.append({
                        "start": range_start,
                        "end": range_end,
                        "count": range_end - range_start + 1,
                        "message": f"Ročníky {range_start}–{range_end} ({range_end - range_start + 1} let) nejsou pokryty žádnou kategorií"
                    })
                range_start = gap_years[i]
                range_end = gap_years[i]
        
        # Přidáme poslední rozsah
        if range_start == range_end:
            gap_ranges.append({
                "start": range_start,
                "end": range_end,
                "count": 1,
                "message": f"Ročník {range_start} není pokryt žádnou kategorií"
            })
        else:
            gap_ranges.append({
                "start": range_start,
                "end": range_end,
                "count": range_end - range_start + 1,
                "message": f"Ročníky {range_start}–{range_end} ({range_end - range_start + 1} let) nejsou pokryty žádnou kategorií"
            })
    
    # Seznam neaktivních kategorií
    inactive_categories = db.query(models.Category).filter(
        models.Category.active == False
    ).all()
    
    inactive_list = [{
        "id": cat.id,
        "name": cat.name,
        "range": f"{cat.min_birth_year}-{cat.max_birth_year}"
    } for cat in inactive_categories]
    
    total_gap_years = len(gap_years)
    total_overlap_years = len(overlap_details)
    
    status = "ok" if not gap_ranges and not overlap_details else "warning"
    message = "Kategorie jsou správně nastaveny pro celý rozsah 1900–současnost"
    if gap_ranges or overlap_details:
        issues = []
        if gap_ranges:
            issues.append(f"{total_gap_years} nepokrytých ročníků v {len(gap_ranges)} rozsazích")
        if overlap_details:
            issues.append(f"{total_overlap_years} překrývajících se ročníků")
        message = f"Nalezeny problémy: {', '.join(issues)}"
    
    return {
        "status": status,
        "message": message,
        "check_range": {
            "min": min_check_year,
            "max": max_check_year,
            "total_years": max_check_year - min_check_year + 1
        },
        "racer_range": {
            "min": min_racer_year,
            "max": max_racer_year
        } if min_racer_year else None,
        "active_categories": len(active_categories),
        "total_gap_years": total_gap_years,
        "gap_ranges": gap_ranges,
        "overlaps": overlap_details,
        "inactive_categories": inactive_list
    }


@router.post("/categories/recalculate/all")
def recalculate_all_racer_categories(
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Přepočítá kategorie pro všechny závodníky v tabulce fuj_jmlp_racer
    podle jejich ročníku narození.
    Používat na začátku sezóny nebo po změnách v kategoriích.
    """
    # Načteme všechny závodníky
    racers = db.query(models.Racer).filter(models.Racer.year.isnot(None)).all()
    
    stats = {
        "total": len(racers),
        "updated": 0,
        "unchanged": 0,
        "no_category": 0
    }
    
    for racer in racers:
        old_category_id = racer.category_id
        new_category_id = get_category_for_birth_year(racer.year, db)
        
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
        "stats": stats
    }
