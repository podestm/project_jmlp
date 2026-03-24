from fastapi import APIRouter

from .auth import router as auth_router
from .races import router as races_router
from .start_list import router as start_list_router
from .timing import router as timing_router
from .results import router as results_router
from .race_numbers import router as race_numbers_router
from .sync import router as sync_router

# Main timekeeper router
router = APIRouter(prefix="/api/timekeeper")

router.include_router(auth_router)
router.include_router(races_router)
router.include_router(start_list_router)
router.include_router(timing_router)
router.include_router(results_router)
router.include_router(race_numbers_router)
router.include_router(sync_router)
