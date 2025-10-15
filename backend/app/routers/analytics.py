from typing import Dict
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

router = APIRouter(tags=["analytics"])


@router.post("/visitor-log")
async def log_visitor(
    request: Request,
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """
    Veřejný endpoint pro logování návštěv z frontendu.
    Zavolá se při načtení každé stránky v React aplikaci.
    """
    try:
        # Získej IP adresu (respektuje X-Forwarded-For pokud je za proxy)
        ip_address = request.headers.get("X-Forwarded-For")
        if ip_address:
            ip_address = ip_address.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        
        # Získej User-Agent
        user_agent = request.headers.get("User-Agent", "")[:255]
        
        # Získej cestu z body
        body = await request.json() if request.headers.get("content-type") == "application/json" else {}
        path = body.get("path", "/")[:255]
        
        # Ulož do databáze
        log_entry = models.VisitorLog(
            ip_address=ip_address,
            user_agent=user_agent,
            path=path,
            visited_at=datetime.now()
        )
        db.add(log_entry)
        db.commit()
        
        return {"status": "ok"}
    except Exception as e:
        print(f"Error logging visit: {e}")
        return {"status": "error"}
