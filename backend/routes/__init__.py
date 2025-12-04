from fastapi import APIRouter
from .auth import router as auth_router
from .user import router as user_router
from .repository import router as repository_router
from .maintainer import router as maintainer_router
from .contributor import router as contributor_router
from .chat import router as chat_router

# Create main API router
api_router = APIRouter(prefix="/api")

# Include all sub-routers
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(user_router, tags=["user"])
api_router.include_router(repository_router, tags=["repositories"])
api_router.include_router(maintainer_router, tags=["maintainer"])
api_router.include_router(contributor_router, tags=["contributor"])
api_router.include_router(chat_router, tags=["chat"])

__all__ = ['api_router']
