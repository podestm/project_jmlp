from fastapi import APIRouter, Depends

from ...auth import require_role
from .auth import router as auth_router
from .race_numbers import router as race_numbers_router
from .races import router as races_router
from .results import router as results_router
from .slcr import router as slcr_router
from .standings import router as standings_router
from .start_list import router as start_list_router
from .timing import router as timing_router

# Main timekeeper router
router = APIRouter(prefix="/api/timekeeper")

# Časomíru smí obsluhovat admin i timekeeper; přihlášení zůstává bez ochrany
timekeeper_access = [Depends(require_role("admin", "timekeeper"))]

router.include_router(auth_router)
router.include_router(races_router, dependencies=timekeeper_access)
router.include_router(start_list_router, dependencies=timekeeper_access)
router.include_router(timing_router, dependencies=timekeeper_access)
router.include_router(results_router, dependencies=timekeeper_access)
router.include_router(race_numbers_router, dependencies=timekeeper_access)
router.include_router(standings_router, dependencies=timekeeper_access)
router.include_router(slcr_router, dependencies=timekeeper_access)
