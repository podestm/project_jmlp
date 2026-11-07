import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from ... import auth, models
from ...database import get_db
from ...utils import category_display_name, csv_safe

router = APIRouter(tags=["admin-registrations"])


@router.get("/races/{race_id}/registrations", response_model=list[dict])
def get_race_registrations(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Get all registrations for a specific race."""
    # Verify race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")

    # Get registrations with racer and club info
    query = text("""
        SELECT 
            reg.id as registration_id,
            reg.race_id,
            reg.racer_id,
            reg.registered_at as registration_date,
            CONVERT(CONVERT(r.name USING binary) USING utf8mb4) as firstName,
            CONVERT(CONVERT(r.surname USING binary) USING utf8mb4) as lastName,
            r.sex,
            r.year as birthYear,
            r.slcr_id as idSlcr,
            CONVERT(CONVERT(c.name USING binary) USING utf8mb4) as club_name,
            reg.club_request_note
        FROM fuj_jmlp_race_registration reg
        LEFT JOIN fuj_jmlp_racer r ON reg.racer_id = r.id
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE reg.race_id = :race_id
        ORDER BY r.surname, r.name
    """)

    registrations = db.execute(query, {"race_id": race_id}).fetchall()

    # Kategorie podle ročníku a pohlaví - stejné pravidlo jako při zakládání
    # závodníka (utils.get_category_snapshot_for_birth_year): kategorie pro
    # dané pohlaví má přednost před společnou. Ženy a muži jsou zvlášť.
    categories = db.query(models.Category).filter(models.Category.active == True).all()  # noqa: E712
    categories.sort(key=lambda c: (-c.min_birth_year, -c.sex))
    order = {c.id: index for index, c in enumerate(categories)}

    def category_for(year, sex):
        matches = [
            c
            for c in categories
            if year is not None
            and c.min_birth_year <= year <= c.max_birth_year
            and c.sex in (0, sex)
        ]
        return max(matches, key=lambda c: c.sex) if matches else None

    result = []
    for reg in registrations:
        category = category_for(reg.birthYear, reg.sex)
        result.append(
            {
                "registration_id": reg.registration_id,
                "race_id": reg.race_id,
                "racer_id": reg.racer_id,
                "registration_date": reg.registration_date,
                "firstName": reg.firstName,
                "lastName": reg.lastName,
                "sex": "M" if reg.sex == 1 else ("Z" if reg.sex == 2 else ""),
                "birthYear": reg.birthYear,
                "idSlcr": reg.idSlcr,
                "club_name": reg.club_name
                or ("Nový Klub" if reg.club_request_note else "Bez klubu"),
                "category_id": category.id if category else None,
                "category_name": category_display_name(category) if category else None,
                "category_order": order.get(category.id) if category else None,
            }
        )

    return result


@router.get("/races/{race_id}/export-csv")
def export_race_registrations_csv(
    race_id: int,
    current_admin: models.AdminUser = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Export race registrations to CSV format."""
    # Check if race exists
    race = db.query(models.Race).filter(models.Race.id == race_id).first()
    if not race:
        raise HTTPException(status_code=404, detail="Závod nenalezen")

    # Get registrations with racer and club data
    query = """
        SELECT 
            TRIM(CONVERT(CONVERT(r.name USING binary) USING utf8mb4)) as firstName,
            TRIM(CONVERT(CONVERT(r.surname USING binary) USING utf8mb4)) as lastName,
            r.sex,
            r.year as birthYear,
            TRIM(CONVERT(CONVERT(c.name USING binary) USING utf8mb4)) as clubName,
            TRIM(r.slcr_id) as idSlcr
        FROM fuj_jmlp_race_registration reg
        JOIN fuj_jmlp_racer r ON reg.racer_id = r.id
        LEFT JOIN fuj_jmlp_club c ON r.club_id = c.id
        WHERE reg.race_id = :race_id
        ORDER BY r.surname, r.name
    """

    result = db.execute(text(query), {"race_id": race_id}).fetchall()

    if not result:
        raise HTTPException(status_code=404, detail="Pro tento závod nejsou registrace")

    # Generate CSV content
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    # Write header
    writer.writerow(
        ["jmeno", "prijmeni", "sex", "rocnik_narozeni", "oddil", "body_jmlp", "id_slcr"]
    )

    # Write data rows
    for row in result:
        sex_letter = "M" if row.sex == 1 else "Z"  # Convert 1/2 to M/Z
        club_name = row.clubName or ""
        id_slcr = row.idSlcr or ""

        writer.writerow(
            [
                csv_safe(row.firstName),
                csv_safe(row.lastName),
                sex_letter,
                row.birthYear or "",
                csv_safe(club_name),
                "",  # body_jmlp - empty as requested
                csv_safe(id_slcr),
            ]
        )

    csv_content = output.getvalue()
    output.close()

    # Create filename with race number
    race_number = race.race_nr or f"zavod_{race_id}"
    filename = f"registrace_{race_number}.csv"

    # Encode as Windows-1250 for Excel compatibility with Czech characters

    # Return CSV as download
    return Response(
        content=csv_content.encode("cp1250"),
        media_type="text/csv; charset=windows-1250",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
