"""
Automated Resource Vault Service for OpenTriage.
Extracts and saves helpful links and snippets from chat and comments.
"""
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from urllib.parse import urlparse

from models.resource import Resource, ResourceType, ResourceExtraction
from config.settings import settings

logger = logging.getLogger(__name__)


class ResourceVaultService:
    """
    Service for automatically extracting and storing helpful resources.
    
    Features:
    - URL extraction and categorization
    - Code snippet detection
    - AI-powered tagging
    - Resource search and retrieval
    """
    
    def __init__(self):
        # Patterns for resource extraction
        self.url_pattern = re.compile(
            r'https?://[^\s<>"{}|\\^`\[\]]+'
        )
        self.code_block_pattern = re.compile(
            r'```(\w+)?\n([\s\S]*?)```'
        )
        self.inline_code_pattern = re.compile(
            r'`([^`]+)`'
        )
        
        # Known documentation domains
        self.doc_domains = [
            'docs.', 'documentation.', 'wiki.',
            'developer.', 'developers.', 'dev.',
            'readthedocs.io', 'gitbook.io',
            'notion.so', 'confluence.'
        ]
        
        # Tutorial domains
        self.tutorial_domains = [
            'youtube.com', 'youtu.be',
            'medium.com', 'dev.to',
            'freecodecamp.org', 'codecademy.com',
            'udemy.com', 'coursera.org'
        ]
    
    async def extract_resources_from_message(
        self,
        message: str,
        author: str,
        author_id: str,
        repo_name: str,
        source_type: str = "chat",
        source_id: Optional[str] = None
    ) -> ResourceExtraction:
        """
        Extract resources from a message or comment.
        
        Args:
            message: The text content
            author: Username who shared
            author_id: User ID who shared
            repo_name: Repository context
            source_type: Where this came from (chat, comment, issue)
            source_id: ID of the source
            
        Returns:
            ResourceExtraction with found resources
        """
        resources = []
        
        # Extract URLs
        urls = self.url_pattern.findall(message)
        for url in urls:
            resource = await self._create_resource_from_url(
                url, author, author_id, repo_name, source_type, source_id
            )
            if resource:
                resources.append(resource)
        
        # Extract code blocks
        code_blocks = self.code_block_pattern.findall(message)
        for language, code in code_blocks:
            if len(code.strip()) > 20:  # Minimum meaningful snippet
                resource = Resource(
                    repo_name=repo_name,
                    source_type=source_type,
                    source_id=source_id,
                    resource_type=ResourceType.CODE_SNIPPET,
                    title=f"{language.upper() if language else 'Code'} snippet",
                    content=code.strip(),
                    language=language or "unknown",
                    shared_by=author,
                    shared_by_id=author_id
                )
                # Generate tags
                resource.tags = await self._generate_tags(code, language)
                resources.append(resource)
        
        confidence = min(len(resources) * 0.25, 1.0) if resources else 0.0
        
        return ResourceExtraction(
            message_id=source_id or "",
            extracted_resources=resources,
            extraction_confidence=confidence
        )
    
    async def _create_resource_from_url(
        self,
        url: str,
        author: str,
        author_id: str,
        repo_name: str,
        source_type: str,
        source_id: Optional[str]
    ) -> Optional[Resource]:
        """Create a Resource from a URL."""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            # Determine resource type
            resource_type = self._categorize_url(url, domain)
            
            # Generate title from URL
            title = self._generate_title_from_url(url, parsed)
            
            resource = Resource(
                repo_name=repo_name,
                source_type=source_type,
                source_id=source_id,
                resource_type=resource_type,
                title=title,
                content=url,
                shared_by=author,
                shared_by_id=author_id
            )
            
            # Generate tags
            resource.tags = self._extract_tags_from_url(url, domain)
            
            return resource
            
        except Exception as e:
            logger.error(f"Error creating resource from URL: {e}")
            return None
    
    def _categorize_url(self, url: str, domain: str) -> ResourceType:
        """Categorize a URL into a resource type."""
        url_lower = url.lower()
        
        # Check for documentation
        for doc_domain in self.doc_domains:
            if doc_domain in domain:
                return ResourceType.DOCUMENTATION
        
        # Check for tutorials
        for tut_domain in self.tutorial_domains:
            if tut_domain in domain:
                return ResourceType.TUTORIAL
        
        # GitHub-specific categorization
        if 'github.com' in domain:
            if '/issues/' in url_lower or '/pull/' in url_lower:
                return ResourceType.EXAMPLE
            elif '/blob/' in url_lower or '/tree/' in url_lower:
                return ResourceType.CODE_SNIPPET
            else:
                return ResourceType.TOOL
        
        # Stack Overflow = answer
        if 'stackoverflow.com' in domain or 'stackexchange.com' in domain:
            return ResourceType.ANSWER
        
        return ResourceType.LINK
    
    def _generate_title_from_url(self, url: str, parsed) -> str:
        """Generate a readable title from URL."""
        path = parsed.path.strip('/')
        
        if not path:
            return parsed.netloc
        
        # Get last meaningful part of path
        parts = path.split('/')
        title_part = parts[-1] if parts else parsed.netloc
        
        # Clean up
        title_part = title_part.replace('-', ' ').replace('_', ' ')
        title_part = re.sub(r'\.\w+$', '', title_part)  # Remove file extension
        
        return title_part.title()[:100]
    
    def _extract_tags_from_url(self, url: str, domain: str) -> List[str]:
        """Extract relevant tags from URL."""
        tags = []
        url_lower = url.lower()
        
        # Language detection from URL
        languages = ['python', 'javascript', 'typescript', 'java', 'go', 'rust', 'ruby']
        for lang in languages:
            if lang in url_lower:
                tags.append(lang)
        
        # Framework detection
        frameworks = ['react', 'vue', 'angular', 'django', 'flask', 'express', 'rails']
        for fw in frameworks:
            if fw in url_lower:
                tags.append(fw)
        
        # Domain-based tags
        if 'github.com' in domain:
            tags.append('github')
        if 'stackoverflow' in domain:
            tags.append('stackoverflow')
        
        return list(set(tags))[:5]
    
    async def _generate_tags(self, content: str, language: Optional[str] = None) -> List[str]:
        """Generate tags for content using simple heuristics."""
        tags = []
        content_lower = content.lower()
        
        if language:
            tags.append(language)
        
        # Detect common patterns
        patterns = {
            'api': ['fetch', 'axios', 'request', 'http', 'async'],
            'database': ['sql', 'query', 'select', 'insert', 'mongodb', 'postgres'],
            'testing': ['test', 'assert', 'expect', 'describe', 'jest', 'pytest'],
            'auth': ['login', 'auth', 'token', 'jwt', 'oauth'],
            'async': ['async', 'await', 'promise', 'callback'],
            'error-handling': ['try', 'catch', 'except', 'error', 'throw']
        }
        
        for tag, keywords in patterns.items():
            if any(kw in content_lower for kw in keywords):
                tags.append(tag)
        
        return list(set(tags))[:5]
    
    async def create_resource(
        self,
        title: str,
        description: str,
        url: str,
        resource_type: str,
        tags: List[str],
        user: Any
    ) -> Resource:
        """
        Manually create a new resource.
        
        Args:
            title: Resource title
            description: Resource description
            url: Resource URL or content
            resource_type: Type (tutorial, documentation, etc)
            tags: List of tags
            user: User object creating the resource
            
        Returns:
            Created Resource object
        """
        try:
            # Map string type to enum
            try:
                type_enum = ResourceType(resource_type)
            except ValueError:
                type_enum = ResourceType.LINK

            resource = Resource(
                title=title,
                description=description,
                content=url,
                resource_type=type_enum,
                tags=tags,
                shared_by=user.username,
                shared_by_id=user.id,
                repo_name="", # Global/manual resources might not have a repo context
                source_type="manual",
                source_id=""
            )
            
            # Save using existing method
            await self.save_resource(resource)
            
            return resource
        except Exception as e:
            logger.error(f"Error creating manual resource: {e}")
            raise e

    async def save_resource(self, resource: Resource) -> str:
        """
        Save a resource to the vault.
        
        Args:
            resource: The resource to save
            
        Returns:
            Resource ID
        """
        from config.database import db
        
        resource_dict = resource.model_dump()
        resource_dict['created_at'] = resource_dict['created_at'].isoformat()
        resource_dict['updated_at'] = resource_dict['updated_at'].isoformat()
        resource_dict['resource_type'] = resource.resource_type.value
        
        await db.resources.insert_one(resource_dict)
        
        logger.info(f"Saved resource: {resource.title}")
        return resource.id
    
    async def save_extracted_resources(
        self,
        extraction: ResourceExtraction
    ) -> List[str]:
        """Save all extracted resources."""
        saved_ids = []
        
        for resource in extraction.extracted_resources:
            # Check for duplicates
            from config.database import db
            existing = await db.resources.find_one({
                "content": resource.content,
                "repo_name": resource.repo_name
            })
            
            if not existing:
                resource_id = await self.save_resource(resource)
                saved_ids.append(resource_id)
        
        return saved_ids
    
    async def search_resources(
        self,
        query: str,
        repo_name: Optional[str] = None,
        resource_type: Optional[ResourceType] = None,
        tags: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Resource]:
        """
        Search the resource vault.
        
        Args:
            query: Search query
            repo_name: Filter by repository
            resource_type: Filter by type
            tags: Filter by tags
            limit: Max results
            
        Returns:
            List of matching resources
        """
        from config.database import db
        
        filter_query = {}
        
        if repo_name:
            filter_query["repo_name"] = repo_name
        
        if resource_type:
            filter_query["resource_type"] = resource_type.value
        
        if tags:
            filter_query["tags"] = {"$in": tags}
        
        if query:
            filter_query["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},
                {"content": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}}
            ]
        
        cursor = db.resources.find(filter_query, {"_id": 0}).sort(
            "helpful_count", -1
        ).limit(limit)
        
        resources = await cursor.to_list(length=limit)
        return [Resource(**r) for r in resources]
    
    async def get_resources_for_topic(
        self,
        topic: str,
        repo_name: Optional[str] = None
    ) -> List[Resource]:
        """Get resources related to a specific topic."""
        return await self.search_resources(
            query=topic,
            repo_name=repo_name,
            limit=10
        )
    
    async def mark_helpful(self, resource_id: str, user_id: str) -> bool:
        """Mark a resource as helpful."""
        from config.database import db
        
        result = await db.resources.update_one(
            {"id": resource_id},
            {"$inc": {"helpful_count": 1}}
        )
        
        return result.modified_count > 0
    
    async def get_trending_resources(
        self,
        repo_name: Optional[str] = None,
        days: int = 7,
        limit: int = 10
    ) -> List[Resource]:
        """Get trending resources by helpful count."""
        from config.database import db
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        query = {"created_at": {"$gte": cutoff.isoformat()}}
        if repo_name:
            query["repo_name"] = repo_name
        
        cursor = db.resources.find(query, {"_id": 0}).sort(
            "helpful_count", -1
        ).limit(limit)
        
        resources = await cursor.to_list(length=limit)
        return [Resource(**r) for r in resources]


# Singleton instance
resource_vault_service = ResourceVaultService()
