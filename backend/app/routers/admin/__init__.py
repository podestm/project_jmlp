from fastapi import APIRouter

from .auth import router as auth_router
from .posts import router as posts_router  
from .racers import router as racers_router
from .races import router as races_router
from .documents import router as documents_router
from .registrations import router as registrations_router
from .categories import router as categories_router
from .analytics import router as analytics_router
from .stats import router as stats_router

# Main admin router that includes all sub-routers
router = APIRouter(prefix="/api/admin")

# Include all sub-routers
router.include_router(auth_router)
router.include_router(posts_router)
router.include_router(racers_router)
router.include_router(races_router)
router.include_router(documents_router)
router.include_router(registrations_router)
router.include_router(categories_router)
router.include_router(analytics_router)
router.include_router(stats_router)