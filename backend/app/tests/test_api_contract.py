"""Frontend nesmí volat endpoint, který v backendu není.

Vzniklo po konkrétní zkušenosti: formulář závodu volal
POST /api/admin/files/upload, který v routerech neexistuje. Build prošel,
lint prošel, testy prošly - a tlačítko "Nahrát nový soubor" vracelo 404,
protože se to nikde neověřovalo.

Cesty se ve frontendu skládají z šablonových literálů, takže se porovnává
tvar s ${...} nahrazeným zástupným segmentem.

POZOR: běžný běh v kontejneru backendu tenhle test PŘESKOČÍ - jmlp-backend má
namapované jen backend/app, takže na frontend nevidí. Spouští se s celým repem:

  docker run --rm --network jmlp_web_v1_jmlp -v /opt/jmlp_web_v1:/repo \\
    -w /repo/backend -e DATABASE_URL="$DATABASE_URL" -e SECRET_KEY="$SECRET_KEY" \\
    jmlp_web_v1-backend python -m pytest app/tests/test_api_contract.py
"""
import re
from pathlib import Path

import pytest

from app.main import app

FRONTEND_SRC = Path(__file__).resolve().parents[3] / "frontend" / "src"

# Volání API v klientech: TimekeeperAPI.get('...'), AdminAPI.post(`...`), fetch('/api/...')
_CALL = re.compile(
    r"""(?:AdminAPI|TimekeeperAPI|API)\s*\.\s*(?:get|post|put|delete|upload|request)\s*\(\s*['"`]([^'"`]+)['"`]"""
)
_FETCH = re.compile(r"""fetch\(\s*['"`](/api/[^'"`?]+)""")

# ${...} -> zástupný segment; koncové lomítko a dotaz pryč
_INTERP = re.compile(r"\$\{[^}]*\}")


def _shape(path: str) -> str:
    path = path.split("?")[0]
    path = _INTERP.sub("{}", path)
    return path.rstrip("/") or "/"


def _route_shapes() -> set[str]:
    shapes = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        if not path:
            continue
        shapes.add(re.sub(r"\{[^}]*\}", "{}", path).rstrip("/") or "/")
    return shapes


def _frontend_calls() -> dict[str, set[str]]:
    """Tvar cesty -> soubory, které ji volají."""
    calls: dict[str, set[str]] = {}
    for file in FRONTEND_SRC.rglob("*.js*"):
        if ".test." in file.name:
            continue
        text = file.read_text(encoding="utf-8")
        for match in list(_CALL.finditer(text)) + list(_FETCH.finditer(text)):
            raw = match.group(1)
            if not raw.startswith("/"):
                continue
            calls.setdefault(_shape(raw), set()).add(str(file.relative_to(FRONTEND_SRC)))
    return calls


@pytest.mark.skipif(not FRONTEND_SRC.exists(), reason="zdroj frontendu není namapovaný")
def test_frontend_nevola_neexistujici_endpoint():
    routes = _route_shapes()
    calls = _frontend_calls()
    assert calls, "nenašlo se žádné volání API - kontrola by tiše procházela"

    chybi = {cesta: sorted(kde) for cesta, kde in calls.items() if cesta not in routes}

    assert not chybi, "Frontend volá cesty, které backend nezná:\n" + "\n".join(
        f"  {cesta}  <- {', '.join(kde)}" for cesta, kde in sorted(chybi.items())
    )
