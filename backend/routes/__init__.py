from fastapi import APIRouter
from .auth import router as auth_router
from .user import router as user_router
from .repository import router as repository_router
from .maintainer import router as maintainer_router
from .contributor import router as contributor_router
from .chat import router as chat_router

# New feature routes
from .mentor import router as mentor_router
from .trophy import router as trophy_router
from .rag import router as rag_router
from .mentorship import router as mentorship_router
from .community import router as community_router
from .profile import router as profile_router
from .messaging import router as messaging_router

# Create main API router
api_router = APIRouter(prefix="/api")

# Include all sub-routers
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(user_router, tags=["user"])
api_router.include_router(repository_router, tags=["repositories"])
api_router.include_router(maintainer_router, tags=["maintainer"])
api_router.include_router(contributor_router, tags=["contributor"])
api_router.include_router(chat_router, tags=["chat"])

# New feature routes
api_router.include_router(mentor_router, prefix="/mentor", tags=["mentor"])
api_router.include_router(trophy_router, prefix="/trophy", tags=["trophy"])
api_router.include_router(rag_router, prefix="/rag", tags=["rag"])
api_router.include_router(mentorship_router, prefix="/mentorship", tags=["mentorship"])
api_router.include_router(community_router, prefix="/community", tags=["community"])
api_router.include_router(profile_router, tags=["profile"])
api_router.include_router(messaging_router, tags=["messaging"])

# Spark routes - optional, requires pyspark to be installed
try:
    from .spark import router as spark_router
    from .webhook import router as webhook_router
    api_router.include_router(spark_router, prefix="/spark", tags=["spark"])
    api_router.include_router(webhook_router, prefix="/webhook", tags=["webhook"])
    SPARK_AVAILABLE = True
except ImportError as e:
    import logging
    logging.getLogger(__name__).warning(f"Spark routes disabled: {e}")
    SPARK_AVAILABLE = False

__all__ = ['api_router', 'SPARK_AVAILABLE']



