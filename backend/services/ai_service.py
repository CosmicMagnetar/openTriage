import logging
from typing import List, Dict, Optional
from openai import OpenAI
from models.issue import Issue
from models.triage import Classification, Sentiment
from config.settings import settings

logger = logging.getLogger(__name__)


class AITriageService:
    """Service for AI-powered issue triage and classification."""
    
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key
        )
    
    async def classify_issue(self, issue: Issue) -> Dict:
        """
        Classify an issue or PR using AI.
        
        Args:
            issue: Issue object to classify
            
        Returns:
            Dict with classification, summary, suggestedLabel, and sentiment
        """
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
    """Service for AI-powered chat assistance."""
    
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key
        )
    
    async def chat(
        self, 
        message: str, 
        history: Optional[List[dict]] = None, 
        context: Optional[dict] = None
    ) -> str:
        """
        Generate a chat response using AI.
        
        Args:
            message: User message
            history: Previous chat messages
            context: Additional context (user role, stats, etc.)
            
        Returns:
            AI-generated response text
        """
        try:
            system_message = """You are OpenTriage AI, an intelligent assistant for open source development."""
            
            if context:
                role = context.get('role', 'user').upper()
                
                if role == 'MAINTAINER':
                    system_message += """
You are acting as a **Maintainer's Copilot**. Your goal is to help project maintainers be efficient, fair, and effective.
- Help triage issues quickly (bug vs feature, severity).
- Draft professional and concise replies to contributors.
- Suggest labels and assignees.
- Analyze PRs for code quality, security, and style.
- Summarize long discussions.
- Be direct, professional, and solution-oriented.
"""
                elif role == 'CONTRIBUTOR':
                    stats = f"They have {context.get('totalContributions', 0)} contributions." if context.get('totalContributions') else ""
                    system_message += f"""
You are acting as a **Contributor's Mentor**. Your goal is to encourage, guide, and help the user grow in open source.
- Be encouraging, friendly, and patient.
- Explain complex concepts simply.
- Help them find good first issues.
- Guide them through the PR process (fork, branch, commit, push).
- Give advice on open source programs (GSoC, LFX, Hacktoberfest).
- Help them write better commit messages and PR descriptions.
- {stats}
"""
                else:
                    system_message += "\nHelp users with GitHub issues and open source contributions."
            else:
                system_message += "\nHelp users with GitHub issues and open source contributions."
            
            messages = [{"role": "system", "content": system_message}]
            
            if history:
                for msg in history[-6:]:  # Keep last 6 messages for context
                    messages.append({
                        "role": msg.get('role', 'user'),
                        "content": msg.get('content', '')
                    })
            
            messages.append({"role": "user", "content": message})
            
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


# Singleton instances
ai_triage_service = AITriageService()
ai_chat_service = AIChatService()
