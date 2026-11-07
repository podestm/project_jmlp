"""robots.txt, sitemap.xml a náhledy odkazů pro boty sociálních sítí.

Nginx (frontend/nginx.conf) sem posílá /robots.txt, /sitemap.xml a požadavky
botů na veřejné stránky (map $jmlp_preview). Logika je v services/seo.py.
"""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import seo
from ..services import seasons as season_service

router = APIRouter(tags=["seo"])

# Boti si stránky kešují sami; hodina na straně proxy stačí.
_CACHE = {"Cache-Control": "public, max-age=3600"}


@router.get("/robots.txt", response_class=PlainTextResponse)
def robots(request: Request):
    return PlainTextResponse(
        seo.robots_txt(seo.site_origin(request.headers.get("host"))), headers=_CACHE
    )


@router.get("/sitemap.xml")
def sitemap(request: Request, db: Session = Depends(get_db)):
    origin = seo.site_origin(request.headers.get("host"))
    xml = seo.sitemap_xml(origin, seo.public_races(db), season_service.current_season_id(db))
    return Response(xml, media_type="application/xml", headers=_CACHE)


@router.get("/seo/preview/{path:path}", response_class=HTMLResponse)
def preview(path: str, request: Request, db: Session = Depends(get_db)):
    """Stránka s titulkem a Open Graph značkami pro bota, který nespouští JS.
    Neexistující stránka nebo závod = 404 s obecnými značkami."""
    origin = seo.site_origin(request.headers.get("host"))
    meta = seo.preview_meta(db, path)
    url = f"{origin}/{path.strip('/')}" if path.strip("/") else f"{origin}/"
    html = seo.preview_html(meta or seo.NOT_FOUND, url, origin)
    return HTMLResponse(html, status_code=200 if meta else 404, headers=_CACHE)
