from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from config.database import db
from models.user import UserRole
from utils.dependencies import get_current_user

router = APIRouter()


class SelectRoleRequest(BaseModel):
    role: UserRole


@router.get("/user/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user information."""
    return user


@router.post("/user/select-role")
async def select_role(request: SelectRoleRequest, user: dict = Depends(get_current_user)):
    """Set or update user role."""
    result = await db.users.update_one(
        {"id": user['id']},
        {"$set": {"role": request.role.value, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create new token with updated role
    from utils.jwt_utils import create_jwt_token
    new_token = create_jwt_token(user['id'], request.role.value)
    
    return {
        "message": "Role updated successfully", 
        "role": request.role.value,
        "token": new_token
    }
