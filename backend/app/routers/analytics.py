import logging
from typing import Dict
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analytics"])


@router.post("/visitor-log")
async def log_visitor(request: Request, db: Session = Depends(get_db)) -> Dict[str, str]:
    """
    Veřejný endpoint pro logování návštěv z frontendu.
    Zavolá se při načtení každé stránky v React aplikaci.
    """
    try:
        # IP bere z X-Real-IP, které nastavuje nginx z $remote_addr - klient ji
        # nemůže podvrhnout. X-Forwarded-For záměrně nečteme, jeho první prvek
        # pochází od klienta.
        ip_address = request.headers.get("X-Real-IP") or (
            request.client.host if request.client else None
        )

        # Získej User-Agent
        user_agent = request.headers.get("User-Agent", "")[:255]

        # Získej cestu z body - přijímáme jen tvar interní cesty aplikace
        body = (
            await request.json()
            if request.headers.get("content-type") == "application/json"
            else {}
        )
        path = body.get("path") or "/"
        if not isinstance(path, str) or not path.startswith("/") or path.startswith("//"):
            path = "/"
        path = path.split("?")[0].split("#")[0][:255]

        # Ulož do databáze
        log_entry = models.VisitorLog(
            ip_address=ip_address, user_agent=user_agent, path=path, visited_at=datetime.now()
        )
        db.add(log_entry)
        db.commit()

        return {"status": "ok"}
    except Exception:
        # Frontend volá tento endpoint fire-and-forget, proto vracíme 200 i při chybě
        logger.exception("Zápis návštěvy selhal")
        return {"status": "error"}
