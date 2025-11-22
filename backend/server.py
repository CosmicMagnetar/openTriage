from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import httpx
# from emergentintegrations.llm.chat import LlmChat, UserMessage
# Mocking emergentintegrations
class UserMessage:
    def __init__(self, text):
        self.text = text

class LlmChat:
    def __init__(self, api_key, session_id, system_message):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message

    def with_model(self, provider, model):
        return self

    async def send_message(self, message):
        # Return a mock response based on the prompt content to be somewhat realistic
        if "CLASSIFICATION:" in message.text:
            return "CLASSIFICATION: BUG\nSUMMARY: This is a mock analysis.\nLABEL: bug\nSENTIMENT: NEUTRAL"
        return "I am a mock AI assistant. The real AI integration is currently unavailable."
import asyncio
from enum import Enum
from openai import OpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Environment variables
GITHUB_CLIENT_ID = os.environ['GITHUB_CLIENT_ID']
GITHUB_CLIENT_SECRET = os.environ['GITHUB_CLIENT_SECRET']
JWT_SECRET = os.environ['JWT_SECRET']
OPENROUTER_API_KEY = os.environ['OPENROUTER_API_KEY']
FRONTEND_URL = os.environ.get('FRONTEND_URL', "http://localhost:3000")
API_URL = os.environ.get('API_URL', "http://localhost:8000")

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Enums
class UserRole(str, Enum):
    MAINTAINER = "MAINTAINER"
    CONTRIBUTOR = "CONTRIBUTOR"

class Classification(str, Enum):
    CRITICAL_BUG = "CRITICAL_BUG"
    BUG = "BUG"
    FEATURE_REQUEST = "FEATURE_REQUEST"
    QUESTION = "QUESTION"
    DOCS = "DOCS"
    DUPLICATE = "DUPLICATE"
    NEEDS_INFO = "NEEDS_INFO"
    SPAM = "SPAM"

class Sentiment(str, Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    FRUSTRATED = "FRUSTRATED"

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    githubId: int
    username: str
    avatarUrl: str
    role: Optional[UserRole] = None
    repositories: List[str] = []
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Repository(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    githubRepoId: int
    name: str
    owner: str
    userId: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Issue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    githubIssueId: int
    number: int
    title: str
    body: Optional[str] = ""
    authorName: str
    repoId: str
    repoName: str
    state: str = "open"
    isPR: bool = False
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IssueTriageData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    issueId: str
    classification: Classification
    summary: str
    suggestedLabel: str
    sentiment: Sentiment
    analyzedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    body: str
    ownerId: str
    triggerClassification: Optional[Classification] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    sessionId: str
    messages: List[dict]
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request/Response models
class SelectRoleRequest(BaseModel):
    role: UserRole

class CreateTemplateRequest(BaseModel):
    name: str
    body: str
    triggerClassification: Optional[Classification] = None

class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None
    triggerClassification: Optional[Classification] = None

class ReplyRequest(BaseModel):
    issueId: str
    message: str

class AddRepoRequest(BaseModel):
    repoFullName: str

class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    context: Optional[dict] = None

# Auth utilities
def create_jwt_token(user_id: str, role: Optional[str] = None) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.replace('Bearer ', '')
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_maintainer(user: dict = Depends(get_current_user)) -> dict:
    if user.get('role') != UserRole.MAINTAINER.value:
        raise HTTPException(status_code=403, detail="Maintainer access required")
    return user

# GitHub Service
class GitHubService:
    def __init__(self):
        self.base_url = "https://api.github.com"
    
    async def fetch_repo_issues(self, repo_full_name: str, include_prs: bool = True):
        """Fetch issues and PRs from a GitHub repository"""
        try:
            async with httpx.AsyncClient() as client:
                issues_url = f"{self.base_url}/repos/{repo_full_name}/issues"
                params = {"state": "all", "per_page": 100}
                
                response = await client.get(issues_url, params=params)
                
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to fetch from GitHub: {response.text}")
                
                items = response.json()
                
                issues = []
                prs = []
                
                for item in items:
                    is_pr = 'pull_request' in item
                    if is_pr:
                        prs.append(item)
                    else:
                        issues.append(item)
                
                return {"issues": issues, "prs": prs if include_prs else []}
        except Exception as e:
            logger.error(f"GitHub fetch error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def fetch_user_activity(self, username: str):
        """Fetch user's issues and PRs across all repos"""
        try:
            async with httpx.AsyncClient() as client:
                # Search for issues authored by user
                search_url = f"{self.base_url}/search/issues"
                params = {"q": f"author:{username}", "per_page": 100, "sort": "created", "order": "desc"}
                
                response = await client.get(search_url, params=params)
                
                if response.status_code != 200:
                    logger.error(f"GitHub search error: {response.text}")
                    return {"issues": [], "prs": []}
                
                items = response.json().get('items', [])
                
                issues = []
                prs = []
                
                for item in items:
                    is_pr = 'pull_request' in item
                    if is_pr:
                        prs.append(item)
                    else:
                        issues.append(item)
                
                return {"issues": issues, "prs": prs}
        except Exception as e:
            logger.error(f"GitHub user activity fetch error: {e}")
            return {"issues": [], "prs": []}

github_service = GitHubService()

# AI Services
class AITriageService:
    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key
        )
    
    async def classify_issue(self, issue: Issue) -> dict:
        """Classify an issue using Meta Llama 3.3 70B Instruct (free)"""
        try:
            item_type = "Pull Request" if issue.isPR else "Issue"
            
            system_message = f"You are an expert GitHub {item_type.lower()} triaging assistant."
            
            prompt = f"""Analyze this GitHub {item_type}:

Title: {issue.title}
Body: {issue.body}
Author: {issue.authorName}

Provide:
CLASSIFICATION: (CRITICAL_BUG, BUG, FEATURE_REQUEST, QUESTION, DOCS, DUPLICATE, NEEDS_INFO, or SPAM)
SUMMARY: (max 100 words)
LABEL: (kebab-case, max 3 words)
SENTIMENT: (POSITIVE, NEUTRAL, NEGATIVE, or FRUSTRATED)"""
            
            # Use OpenRouter with Meta Llama 3.3 70B Instruct (free)
            response = self.client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            response_text = response.choices[0].message.content
            
            lines = response_text.strip().split('\n')
            result = {}
            for line in lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    result[key.strip()] = value.strip()
            
            return {
                'classification': result.get('CLASSIFICATION', 'NEEDS_INFO'),
                'summary': result.get('SUMMARY', 'Unable to analyze'),
                'suggestedLabel': result.get('LABEL', 'needs-review'),
                'sentiment': result.get('SENTIMENT', 'NEUTRAL')
            }
        except Exception as e:
            logger.error(f"AI classification error: {e}")
            return {
                'classification': 'NEEDS_INFO',
                'summary': 'AI analysis pending',
                'suggestedLabel': 'needs-review',
                'sentiment': 'NEUTRAL'
            }

class AIChatService:
    def __init__(self):
        self.api_key = OPENROUTER_API_KEY
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key
        )
    
    async def chat(self, message: str, history: List[dict] = None, context: dict = None) -> str:
        """Chat using Meta Llama 3.3 70B Instruct (free) via OpenRouter"""
        try:
            # Build system message
            system_message = """You are an AI assistant for OpenTriage, helping contributors and maintainers with GitHub issues and open source contributions."""
            
            if context:
                role = context.get('role', 'user')
                if role == 'contributor':
                    system_message += f"\n\nUser Context: This is a contributor with {context.get('totalContributions', 0)} contributions, {context.get('pullRequests', 0)} PRs, and {context.get('openIssues', 0)} open issues."
                system_message += "\n\nHelp them with career advice, understanding open source programs like GSoC and LFX, and improving their contributions."
            
            # Build messages array
            messages = [{"role": "system", "content": system_message}]
            
            # Add conversation history
            if history:
                for msg in history[-6:]:  # Last 6 messages for context
                    messages.append({
                        "role": msg.get('role', 'user'),
                        "content": msg.get('content', '')
                    })
            
            # Add current message
            messages.append({"role": "user", "content": message})
            
            # Use OpenRouter with Meta Llama 3.3 70B Instruct (free)
            response = self.client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=messages,
                temperature=0.8,
                max_tokens=1000
            )
            
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"AI chat error: {e}")
            return "I'm sorry, I encountered an error. Please try again."

ai_triage_service = AITriageService()
ai_chat_service = AIChatService()
@api_router.get("/chat/history")
async def get_chat_history(sessionId: str, user: dict = Depends(get_current_user)):
    """Retrieve stored chat history for a session"""
    history_doc = await db.chat_history.find_one({
        "userId": user["id"],
        "sessionId": sessionId
    }, {"_id": 0})
    if not history_doc:
        raise HTTPException(status_code=404, detail="Chat history not found")
    return {"messages": history_doc.get("messages", [])}


# Auth endpoints
@api_router.get("/auth/github")
async def github_auth():
    """Redirect to GitHub OAuth"""
    callback_url = f"{API_URL}/api/auth/github/callback"
    github_url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&redirect_uri={callback_url}&scope=user:email"
    logger.info(f"Redirecting to GitHub OAuth with callback: {callback_url}")
    return RedirectResponse(github_url)

@api_router.get("/auth/github/callback")
async def github_callback(code: str):
    """Handle GitHub OAuth callback"""
    try:
        async with httpx.AsyncClient() as http_client:
            token_response = await http_client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code
                },
                headers={"Accept": "application/json"}
            )
            token_data = token_response.json()
            access_token = token_data.get('access_token')
            
            if not access_token:
                logger.error(f"No access token: {token_data}")
                return RedirectResponse(f"{FRONTEND_URL}/?error=no_token")
            
            user_response = await http_client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            github_user = user_response.json()
            
            existing_user = await db.users.find_one({"githubId": github_user['id']}, {"_id": 0})
            
            if existing_user:
                user_data = existing_user
            else:
                # New user - no role assigned yet
                user = User(
                    githubId=github_user['id'],
                    username=github_user['login'],
                    avatarUrl=github_user['avatar_url'],
                    role=None
                )
                user_dict = user.model_dump()
                user_dict['createdAt'] = user_dict['createdAt'].isoformat()
                user_dict['updatedAt'] = user_dict['updatedAt'].isoformat()
                await db.users.insert_one(user_dict)
                user_data = user_dict
            
            token = create_jwt_token(user_data['id'], user_data.get('role'))
            return RedirectResponse(f"{FRONTEND_URL}/?token={token}")
    
    except Exception as e:
        logger.error(f"GitHub auth error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/?error=auth_failed")

# User endpoints
@api_router.get("/user/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/user/select-role")
async def select_role(request: SelectRoleRequest, user: dict = Depends(get_current_user)):
    """Let user select their role"""
    result = await db.users.update_one(
        {"id": user['id']},
        {"$set": {"role": request.role.value, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update role")
    
    return {"message": "Role updated successfully", "role": request.role.value}

# Repository Management
@api_router.post("/repositories")
async def add_repository(request: AddRepoRequest, user: dict = Depends(get_current_user)):
    """Add a GitHub repository to track"""
    try:
        parts = request.repoFullName.split('/')
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'owner/repo'")
        
        owner, repo_name = parts
        
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(f"https://api.github.com/repos/{request.repoFullName}")
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Repository not found")
            
            repo_data = response.json()
        
        existing = await db.repositories.find_one(
            {"githubRepoId": repo_data['id'], "userId": user['id']},
            {"_id": 0}
        )
        
        if existing:
            raise HTTPException(status_code=400, detail="Repository already added")
        
        repository = Repository(
            githubRepoId=repo_data['id'],
            name=request.repoFullName,
            owner=owner,
            userId=user['id']
        )
        repo_dict = repository.model_dump()
        repo_dict['createdAt'] = repo_dict['createdAt'].isoformat()
        await db.repositories.insert_one(repo_dict)
        
        asyncio.create_task(import_repo_data(repository, request.repoFullName))
        
        return {"message": "Repository added!", "repository": repo_dict}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add repo error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/repositories")
async def get_repositories(user: dict = Depends(get_current_user)):
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    # Convert datetime objects to strings
    for repo in repos:
        if 'createdAt' in repo and isinstance(repo['createdAt'], datetime):
            repo['createdAt'] = repo['createdAt'].isoformat()
    return repos

async def import_repo_data(repository: Repository, repo_full_name: str):
    """Background task to import issues and PRs"""
    try:
        logger.info(f"Starting import for {repo_full_name}...")
        data = await github_service.fetch_repo_issues(repo_full_name)
        
        logger.info(f"Fetched {len(data['issues'])} issues and {len(data['prs'])} PRs from GitHub")
        
        issue_count = 0
        for gh_issue in data['issues']:
            issue = Issue(
                githubIssueId=gh_issue['id'],
                number=gh_issue['number'],
                title=gh_issue['title'],
                body=gh_issue.get('body') or '',
                authorName=gh_issue['user']['login'],
                repoId=repository.id,
                repoName=repository.name,
                state=gh_issue['state'],
                isPR=False
            )
            issue_dict = issue.model_dump()
            issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
            
            existing = await db.issues.find_one({"githubIssueId": issue.githubIssueId}, {"_id": 0})
            if not existing:
                await db.issues.insert_one(issue_dict)
                asyncio.create_task(classify_and_store(issue))
                issue_count += 1
        
        pr_count = 0
        for gh_pr in data['prs']:
            pr = Issue(
                githubIssueId=gh_pr['id'],
                number=gh_pr['number'],
                title=gh_pr['title'],
                body=gh_pr.get('body') or '',
                authorName=gh_pr['user']['login'],
                repoId=repository.id,
                repoName=repository.name,
                state=gh_pr['state'],
                isPR=True
            )
            pr_dict = pr.model_dump()
            pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
            
            existing = await db.issues.find_one({"githubIssueId": pr.githubIssueId}, {"_id": 0})
            if not existing:
                await db.issues.insert_one(pr_dict)
                asyncio.create_task(classify_and_store(pr))
                pr_count += 1
        
        logger.info(f"✓ Imported {issue_count} new issues and {pr_count} new PRs for {repo_full_name}")
    except Exception as e:
        logger.error(f"Import error for {repo_full_name}: {e}", exc_info=True)

async def classify_and_store(issue: Issue):
    """Background task to classify"""
    try:
        result = await ai_triage_service.classify_issue(issue)
        
        triage = IssueTriageData(
            issueId=issue.id,
            classification=Classification(result['classification']),
            summary=result['summary'],
            suggestedLabel=result['suggestedLabel'],
            sentiment=Sentiment(result['sentiment'])
        )
        triage_dict = triage.model_dump()
        triage_dict['analyzedAt'] = triage_dict['analyzedAt'].isoformat()
        await db.triage_data.insert_one(triage_dict)
        
        logger.info(f"{'PR' if issue.isPR else 'Issue'} {issue.number} classified")
    except Exception as e:
        logger.error(f"Classification error: {e}")

# Maintainer endpoints
@api_router.get("/maintainer/dashboard-summary")
async def get_dashboard_summary(user: dict = Depends(require_maintainer)):
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    repo_ids = [r['id'] for r in repos]
    
    total_issues = await db.issues.count_documents({"repoId": {"$in": repo_ids}})
    pending_triage = await db.issues.count_documents({"repoId": {"$in": repo_ids}})
    critical_bugs = await db.triage_data.count_documents({"classification": Classification.CRITICAL_BUG.value})
    
    return {
        "totalIssues": total_issues,
        "pendingTriage": pending_triage,
        "criticalBugs": critical_bugs,
        "avgResponseTime": 2.5,
        "repositoriesCount": len(repos)
    }

@api_router.get("/maintainer/issues")
async def get_issues(user: dict = Depends(require_maintainer)):
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    repo_ids = [r['id'] for r in repos]
    
    issues = await db.issues.find({"repoId": {"$in": repo_ids}}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    
    for issue in issues:
        triage = await db.triage_data.find_one({"issueId": issue['id']}, {"_id": 0})
        issue['triage'] = triage
    
    return issues

@api_router.get("/maintainer/metrics")
async def get_metrics(user: dict = Depends(require_maintainer)):
    """Get real metrics from user's repositories"""
    repos = await db.repositories.find({"userId": user['id']}, {"_id": 0}).to_list(1000)
    repo_ids = [r['id'] for r in repos]
    
    # Get all issues for user's repos
    all_issues = await db.issues.find({"repoId": {"$in": repo_ids}}, {"_id": 0}).to_list(1000)
    
    # Issues by classification
    classification_counts = {}
    sentiment_counts = {}
    
    for issue in all_issues:
        triage = await db.triage_data.find_one({"issueId": issue['id']}, {"_id": 0})
        if triage:
            classification = triage.get('classification', 'NEEDS_INFO')
            sentiment = triage.get('sentiment', 'NEUTRAL')
            classification_counts[classification] = classification_counts.get(classification, 0) + 1
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
    
    # Format for charts
    issues_by_classification = [
        {"name": k.replace('_', ' ').title(), "value": v}
        for k, v in classification_counts.items()
    ]
    
    sentiment_distribution = [
        {"name": k.title(), "value": v}
        for k, v in sentiment_counts.items()
    ]
    
    # Issues by day (last 7 days)
    from datetime import timedelta
    issues_by_day = []
    today = datetime.now(timezone.utc)
    
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        count = sum(1 for issue in all_issues if issue.get('createdAt', '').startswith(day_str))
        issues_by_day.append({"date": day_str, "count": count})
    
    return {
        "issuesByDay": issues_by_day,
        "issuesByClassification": issues_by_classification if issues_by_classification else [{"name": "No Data", "value": 1}],
        "sentimentDistribution": sentiment_distribution if sentiment_distribution else [{"name": "No Data", "value": 1}]
    }

@api_router.get("/maintainer/templates")
async def get_templates(user: dict = Depends(require_maintainer)):
    templates = await db.templates.find({"ownerId": user['id']}, {"_id": 0}).to_list(1000)
    return templates

@api_router.post("/maintainer/templates")
async def create_template(request: CreateTemplateRequest, user: dict = Depends(require_maintainer)):
    template = Template(
        name=request.name,
        body=request.body,
        ownerId=user['id'],
        triggerClassification=request.triggerClassification
    )
    template_dict = template.model_dump()
    template_dict['createdAt'] = template_dict['createdAt'].isoformat()
    await db.templates.insert_one(template_dict)
    return template_dict

@api_router.put("/maintainer/templates/{template_id}")
async def update_template(template_id: str, request: UpdateTemplateRequest, user: dict = Depends(require_maintainer)):
    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.templates.update_one(
        {"id": template_id, "ownerId": user['id']},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    return template

@api_router.delete("/maintainer/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(require_maintainer)):
    result = await db.templates.delete_one({"id": template_id, "ownerId": user['id']})    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

@api_router.post("/maintainer/action/reply")
async def reply_to_issue(request: ReplyRequest, user: dict = Depends(require_maintainer)):
    issue = await db.issues.find_one({"id": request.issueId}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    logger.info(f"Mock reply to issue {issue['number']}: {request.message}")
    return {"message": "Reply posted (mock)"}

# AI Chat
@api_router.get("/test-ai")
async def test_ai(user: dict = Depends(get_current_user)):
    """Simple endpoint to verify AI connectivity.
    Returns a static response from the AI service.
    """
    try:
        response = await ai_chat_service.chat(
            message="Hello, AI!", history=[], context={}
        )
        return {"response": response}
    except Exception as e:
        logger.error(f"AI test endpoint error: {e}")
        raise HTTPException(status_code=500, detail="AI service unavailable")

@api_router.post("/chat")
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        session_id = request.sessionId or str(uuid.uuid4())
        
        history_doc = await db.chat_history.find_one(
            {"userId": user['id'], "sessionId": session_id},
            {"_id": 0}
        )
        
        history = history_doc['messages'] if history_doc else []
        
        response = await ai_chat_service.chat(
            message=request.message,
            history=history,
            context=request.context
        )
        
        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": response})
        
        if history_doc:
            await db.chat_history.update_one(
                {"userId": user['id'], "sessionId": session_id},
                {"$set": {"messages": history}}
            )
        else:
            chat_hist = ChatHistory(
                userId=user['id'],
                sessionId=session_id,
                messages=history
            )
            hist_dict = chat_hist.model_dump()
            hist_dict['createdAt'] = hist_dict['createdAt'].isoformat()
            await db.chat_history.insert_one(hist_dict)
        
        return {"response": response, "sessionId": session_id}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Contributor endpoints
@api_router.get("/contributor/my-issues")
async def get_my_issues(user: dict = Depends(get_current_user)):
    """Get issues authored by the contributor"""
    # First try to find in database
    issues = await db.issues.find({"authorName": user['username']}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    
    logger.info(f"Found {len(issues)} issues in DB for {user['username']}")
    
    # Always fetch fresh from GitHub to get latest
    logger.info(f"Fetching latest issues for {user['username']} from GitHub API...")
    data = await github_service.fetch_user_activity(user['username'])
    
    logger.info(f"GitHub API returned {len(data['issues'])} issues and {len(data['prs'])} PRs")
    
    # Import user's issues
    for gh_issue in data['issues']:
        try:
            # Extract repo name from URL
            repo_url_parts = gh_issue.get('repository_url', '').split('/')
            repo_name = f"{repo_url_parts[-2]}/{repo_url_parts[-1]}" if len(repo_url_parts) >= 2 else "unknown/unknown"
            
            issue = Issue(
                githubIssueId=gh_issue['id'],
                number=gh_issue['number'],
                title=gh_issue['title'],
                body=gh_issue.get('body') or '',
                authorName=gh_issue['user']['login'],
                repoId="external",
                repoName=repo_name,
                state=gh_issue['state'],
                isPR=False
            )
            issue_dict = issue.model_dump()
            issue_dict['createdAt'] = issue_dict['createdAt'].isoformat()
            
            existing = await db.issues.find_one({"githubIssueId": issue.githubIssueId}, {"_id": 0})
            if not existing:
                await db.issues.insert_one(issue_dict)
                asyncio.create_task(classify_and_store(issue))
                logger.info(f"Imported new issue #{issue.number} from {repo_name}")
        except Exception as e:
            logger.error(f"Error importing issue: {e}")
            continue
    
    # Import user's PRs
    for gh_pr in data['prs']:
        try:
            repo_url_parts = gh_pr.get('repository_url', '').split('/')
            repo_name = f"{repo_url_parts[-2]}/{repo_url_parts[-1]}" if len(repo_url_parts) >= 2 else "unknown/unknown"
            
            pr = Issue(
                githubIssueId=gh_pr['id'],
                number=gh_pr['number'],
                title=gh_pr['title'],
                body=gh_pr.get('body') or '',
                authorName=gh_pr['user']['login'],
                repoId="external",
                repoName=repo_name,
                state=gh_pr['state'],
                isPR=True
            )
            pr_dict = pr.model_dump()
            pr_dict['createdAt'] = pr_dict['createdAt'].isoformat()
            
            existing = await db.issues.find_one({"githubIssueId": pr.githubIssueId}, {"_id": 0})
            if not existing:
                await db.issues.insert_one(pr_dict)
                asyncio.create_task(classify_and_store(pr))
                logger.info(f"Imported new PR #{pr.number} from {repo_name}")
        except Exception as e:
            logger.error(f"Error importing PR: {e}")
            continue
    
    # Fetch updated list from DB
    issues = await db.issues.find({"authorName": user['username']}, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    
    # Add triage data
    for issue in issues:
        triage = await db.triage_data.find_one({"issueId": issue['id']}, {"_id": 0})
        issue['triage'] = triage
    
    logger.info(f"Returning {len(issues)} total issues/PRs for {user['username']}")
    return issues

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
