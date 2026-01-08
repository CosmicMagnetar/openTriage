from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
import httpx
import logging
from config.settings import settings
from config.database import db
from models.user import User
from utils.jwt_utils import create_jwt_token

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/auth/github")
async def github_auth():
    """Redirect to GitHub OAuth authorization page."""
    callback_url = f"{settings.API_URL}/api/auth/github/callback"
    github_url = f"https://github.com/login/oauth/authorize?client_id={settings.GITHUB_CLIENT_ID}&redirect_uri={callback_url}&scope=user:email,repo"
    logger.info(f"Redirecting to GitHub OAuth with callback: {callback_url}")
    return RedirectResponse(github_url)


@router.get("/auth/github/callback")
async def github_callback(code: str):
    """Handle GitHub OAuth callback and create user session."""
    try:
        async with httpx.AsyncClient() as http_client:
            # Exchange code for access token
            token_response = await http_client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code
                },
                headers={"Accept": "application/json"}
            )
            token_data = token_response.json()
            access_token = token_data.get('access_token')
            
            if not access_token:
                logger.error(f"No access token: {token_data}")
                return RedirectResponse(f"{settings.FRONTEND_URL}/?error=no_token")
            
            # Get user info from GitHub
            user_response = await http_client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            github_user = user_response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one({"githubId": github_user['id']}, {"_id": 0})
            
            if existing_user:
                # Update existing user with new GitHub token
                await db.users.update_one(
                    {"githubId": github_user['id']},
                    {"$set": {"githubAccessToken": access_token}}
                )
                user_data = existing_user
                user_data['githubAccessToken'] = access_token
            else:
                # Create new user
                user = User(
                    githubId=github_user['id'],
                    username=github_user['login'],
                    avatarUrl=github_user['avatar_url'],
                    role=None
                )
                user_dict = user.model_dump()
                user_dict['createdAt'] = user_dict['createdAt'].isoformat()
                user_dict['updatedAt'] = user_dict['updatedAt'].isoformat()
                user_dict['githubAccessToken'] = access_token
                await db.users.insert_one(user_dict)
                user_data = user_dict
            
            # Create JWT token
            token = create_jwt_token(user_data['id'], user_data.get('role'))
            return RedirectResponse(f"{settings.FRONTEND_URL}/?token={token}")
            
    except Exception as e:
        logger.error(f"GitHub auth error: {e}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/?error=auth_failed")


from pydantic import BaseModel
from utils.dependencies import get_current_user
from fastapi import Depends


class RoleUpdateRequest(BaseModel):
    role: str  # "maintainer" or "contributor"


@router.get("/auth/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Get current user information."""
    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "avatarUrl": user.get("avatarUrl"),
        "role": user.get("role"),
        "githubId": user.get("githubId")
    }


@router.post("/auth/update-role")
async def update_user_role(request: RoleUpdateRequest, user: dict = Depends(get_current_user)):
    """Update user's role. Users can switch between contributor and maintainer."""
    if request.role not in ["maintainer", "contributor"]:
        raise HTTPException(status_code=400, detail="Role must be 'maintainer' or 'contributor'")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": request.role}}
    )
    
    # Generate new JWT with updated role
    new_token = create_jwt_token(user["id"], request.role)
    
    return {
        "success": True,
        "message": f"Role updated to {request.role}",
        "token": new_token,
        "role": request.role
    }
