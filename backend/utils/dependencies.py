from fastapi import Header, HTTPException, Depends
from .jwt_utils import verify_jwt_token
from config.database import db
from models.user import UserRole


async def get_current_user(authorization: str = Header(None)) -> dict:
    """Get the current authenticated user from JWT token."""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.replace('Bearer ', '')
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_maintainer(user: dict = Depends(get_current_user)) -> dict:
    """Require that the current user has maintainer role."""
    if user.get('role') != UserRole.MAINTAINER.value:
        raise HTTPException(status_code=403, detail="Maintainer access required")
    return user
