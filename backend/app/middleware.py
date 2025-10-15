from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import re

from .database import SessionLocal
from .models import VisitorLog


class VisitorLogMiddleware(BaseHTTPMiddleware):
    """
    Middleware pro logování návštěv webu.
    Zaznamenává každý HTTP request do databáze.
    """
    
    # Cesty které ignorujeme (admin, health check, dokumentace, statické soubory)
    IGNORE_PATHS = [
        r'^/admin.*',
        r'^/health.*',
        r'^/docs.*',
        r'^/redoc.*',
        r'^/openapi.json',
        r'.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$'
    ]
    
    def should_log(self, path: str) -> bool:
        """Rozhodne, zda má být cesta zalogována."""
        for pattern in self.IGNORE_PATHS:
            if re.match(pattern, path, re.IGNORECASE):
                return False
        return True
    
    async def dispatch(self, request: Request, call_next):
        # Zpracuj request
        response = await call_next(request)
        
        # Loguj pouze GET requesty na veřejné stránky
        if request.method == "GET" and self.should_log(request.url.path):
            try:
                # Získej IP adresu (respektuje X-Forwarded-For pokud je za proxy)
                ip_address = request.headers.get("X-Forwarded-For")
                if ip_address:
                    ip_address = ip_address.split(",")[0].strip()
                else:
                    ip_address = request.client.host if request.client else None
                
                # Získej User-Agent
                user_agent = request.headers.get("User-Agent", "")[:255]
                
                # Ulož do databáze
                db: Session = SessionLocal()
                try:
                    log_entry = VisitorLog(
                        ip_address=ip_address,
                        user_agent=user_agent,
                        path=request.url.path[:255],
                        visited_at=datetime.now()
                    )
                    db.add(log_entry)
                    db.commit()
                finally:
                    db.close()
            except Exception as e:
                # Logování nesmí shodit aplikaci
                print(f"Error logging visitor: {e}")
        
        return response
