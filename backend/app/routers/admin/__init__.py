from fastapi import APIRouter, Depends

from ...auth import require_role
from .auth import router as auth_router
from .posts import router as posts_router  
from .racers import router as racers_router
from .races import router as races_router
from .documents import router as documents_router
from .attachments import router as attachments_router
from .library import router as library_router
from .registrations import router as registrations_router
from .categories import router as categories_router
from .seasons import router as seasons_router
from .dashboard import router as dashboard_router
from .clubs import router as clubs_router
from .slcr import router as slcr_router

# Main admin router that includes all sub-routers
router = APIRouter(prefix="/api/admin")

# Vyžadujeme roli "admin" na všech sub-routerech kromě přihlašovacího
admin_only = [Depends(require_role("admin"))]

# Include all sub-routers
router.include_router(auth_router)
router.include_router(posts_router, dependencies=admin_only)
router.include_router(racers_router, dependencies=admin_only)
router.include_router(races_router, dependencies=admin_only)
router.include_router(documents_router, dependencies=admin_only)
router.include_router(attachments_router, dependencies=admin_only)
router.include_router(library_router, dependencies=admin_only)
router.include_router(registrations_router, dependencies=admin_only)
router.include_router(categories_router, dependencies=admin_only)
router.include_router(seasons_router, dependencies=admin_only)
router.include_router(dashboard_router, dependencies=admin_only)
router.include_router(clubs_router, dependencies=admin_only)
router.include_router(slcr_router, dependencies=admin_only)