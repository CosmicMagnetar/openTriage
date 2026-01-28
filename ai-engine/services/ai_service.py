import logging
from typing import List, Dict, Optional
from openai import OpenAI
from models.issue import Issue
from models.triage import Classification, Sentiment
from config.settings import settings

logger = logging.getLogger(__name__)


class AITriageService:
    """Service for AI-powered issue triage and classification."""
    
    # Fallback models to try if primary fails
    TRIAGE_MODELS = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "arcee-ai/trinity-large-preview:free",
        "liquid/lfm-2.5-1.2b-thinking:free",
        "allenai/molmo-2-8b:free",
        "nvidia/nemotron-3-nano-30b-a3b:free",
    ]
    
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key
        )
    
    async def classify_issue(self, issue: Issue) -> Dict:
        """
        Classify an issue or PR using AI with fallback models.
        
        Args:
            issue: Issue object to classify
            
        Returns:
            Dict with classification, summary, suggestedLabel, and sentiment
        """
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
        
        # Try each model in sequence until one works
        errors = []
        for model in self.TRIAGE_MODELS:
            try:
                logger.info(f"Attempting triage with model: {model}")
                response = self.client.chat.completions.create(
                    model=model,
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
                
                logger.info(f"Triage success with model: {model}")
                return {
                    'classification': result.get('CLASSIFICATION', 'NEEDS_INFO'),
                    'summary': result.get('SUMMARY', 'Unable to analyze'),
                    'suggestedLabel': result.get('LABEL', 'needs-review'),
                    'sentiment': result.get('SENTIMENT', 'NEUTRAL')
                }
            except Exception as e:
                error_msg = f"{model}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"Triage failed with model {model}: {e}")
                continue
        
        # All models failed
        error_summary = " | ".join(errors)
        logger.error(f"All triage models failed. Errors: {error_summary}")
        return {
            'classification': 'NEEDS_INFO',
            'summary': f'AI analysis unavailable. Errors: {error_summary}',
            'suggestedLabel': 'needs-review',
            'sentiment': 'NEUTRAL'
        }


class AIChatService:
    """Service for AI-powered chat assistance."""
    
    # Fallback models to try if primary fails
    CHAT_MODELS = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "arcee-ai/trinity-large-preview:free",
        "liquid/lfm-2.5-1.2b-thinking:free",
        "allenai/molmo-2-8b:free",
        "nvidia/nemotron-3-nano-30b-a3b:free",
    ]
    
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
        Generate a chat response using AI with fallback models.
        
        Args:
            message: User message
            history: Previous chat messages
            context: Additional context (user role, stats, etc.)
            
        Returns:
            AI-generated response text
        """
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
                stats = f"They have made {context.get('totalContributions', 0)} contributions so far." if context.get('totalContributions') else ""
                system_message += f"""
You are acting as a **Contributor's Mentor**, much like a friendly senior developer who genuinely wants to see them succeed in open source. {stats}

Your approach should feel like having a conversation with a supportive colleague over coffee. When they ask questions, take the time to understand where they're coming from, and craft your responses in a way that not only answers their immediate question but also helps them develop intuition for future situations.

If they're new to contributing, walk them through concepts like forking repositories, creating feature branches, writing meaningful commit messages, and crafting pull request descriptions that maintainers love to read. Share insights about the unwritten rules of open source: how to communicate effectively with maintainers, when to ask for help versus when to investigate independently, and how to build a reputation in the community.

When discussing programs like Google Summer of Code, LFX Mentorship, or Hacktoberfest, speak from experience about what makes applications stand out and how to find projects that align with their interests and skill level. If they make mistakes, frame feedback constructively, explaining not just what to change but why the community values certain practices.

Above all, be patient and remember that every expert was once a beginner. Your encouragement could be the spark that ignites their open source journey.
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
        
        # Try each model in sequence until one works
        errors = []
        for model in self.CHAT_MODELS:
            try:
                logger.info(f"Attempting chat with model: {model}")
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.8,
                    max_tokens=1000
                )
                
                logger.info(f"Chat success with model: {model}")
                return response.choices[0].message.content
            except Exception as e:
                error_msg = f"{model}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"Chat failed with model {model}: {e}")
                continue
        
        # All models failed
        error_summary = " | ".join(errors)
        logger.error(f"All chat models failed. Errors: {error_summary}")
        return f"I'm sorry, I couldn't generate an answer at this time. All AI models are unavailable. Errors: {error_summary}"
    
    async def analyze_pr(
        self,
        pr_title: str,
        pr_body: str,
        diff: str,
        files_changed: List[str]
    ) -> dict:
        """
        Analyze a PR for code quality, security issues, and best practices.
        
        Args:
            pr_title: PR title
            pr_body: PR description
            diff: Git diff content (truncated if too long)
            files_changed: List of changed file paths
            
        Returns:
            Dict with analysis results
        """
        try:
            # Truncate diff if too long (keep first 8000 chars to fit in context)
            truncated_diff = diff[:8000] if len(diff) > 8000 else diff
            was_truncated = len(diff) > 8000
            
            system_message = """You are an expert code reviewer. Analyze the PR and provide constructive feedback.
Be specific, actionable, and prioritize important issues. Focus on:
1. Code quality and best practices
2. Potential bugs or logic errors
3. Security vulnerabilities
4. Performance considerations
5. Readability and maintainability"""

            prompt = f"""Analyze this Pull Request:

**Title:** {pr_title}
**Description:** {pr_body or 'No description provided'}
**Files Changed:** {', '.join(files_changed[:20])}

**Diff:**
```
{truncated_diff}
```
{"(Note: Diff was truncated due to length)" if was_truncated else ""}

Provide your analysis in this format:
SUMMARY: (1-2 sentence overview)
QUALITY_SCORE: (1-10)
ISSUES: (bullet list of concerns, or "None found")
SUGGESTIONS: (bullet list of improvements)
SECURITY: (any security concerns, or "No issues detected")
VERDICT: (APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION)"""

            response = self.client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=1500
            )
            
            response_text = response.choices[0].message.content
            
            # Parse the response
            result = {
                'summary': '',
                'qualityScore': 7,
                'issues': [],
                'suggestions': [],
                'security': 'No issues detected',
                'verdict': 'NEEDS_DISCUSSION',
                'rawAnalysis': response_text
            }
            
            lines = response_text.strip().split('\n')
            current_section = None
            
            for line in lines:
                line_upper = line.upper().strip()
                if line_upper.startswith('SUMMARY:'):
                    result['summary'] = line.split(':', 1)[1].strip() if ':' in line else ''
                elif line_upper.startswith('QUALITY_SCORE:'):
                    try:
                        score = line.split(':', 1)[1].strip().split('/')[0].strip()
                        result['qualityScore'] = int(score) if score.isdigit() else 7
                    except:
                        result['qualityScore'] = 7
                elif line_upper.startswith('ISSUES:'):
                    current_section = 'issues'
                    content = line.split(':', 1)[1].strip() if ':' in line else ''
                    if content and content.lower() != 'none found':
                        result['issues'].append(content)
                elif line_upper.startswith('SUGGESTIONS:'):
                    current_section = 'suggestions'
                elif line_upper.startswith('SECURITY:'):
                    current_section = 'security'
                    result['security'] = line.split(':', 1)[1].strip() if ':' in line else 'No issues detected'
                elif line_upper.startswith('VERDICT:'):
                    verdict = line.split(':', 1)[1].strip().upper() if ':' in line else 'NEEDS_DISCUSSION'
                    if 'APPROVE' in verdict:
                        result['verdict'] = 'APPROVE'
                    elif 'REQUEST' in verdict or 'CHANGES' in verdict:
                        result['verdict'] = 'REQUEST_CHANGES'
                    else:
                        result['verdict'] = 'NEEDS_DISCUSSION'
                elif line.strip().startswith('- ') or line.strip().startswith('• '):
                    item = line.strip()[2:].strip()
                    if current_section == 'issues':
                        result['issues'].append(item)
                    elif current_section == 'suggestions':
                        result['suggestions'].append(item)
            
            return result
            
        except Exception as e:
            logger.error(f"AI PR analysis error: {e}")
            return {
                'summary': 'Unable to analyze PR',
                'qualityScore': 0,
                'issues': [],
                'suggestions': [],
                'security': 'Analysis failed',
                'verdict': 'NEEDS_DISCUSSION',
                'rawAnalysis': f'Error: {str(e)}'
            }
    
    async def summarize_pr(
        self,
        pr_title: str,
        pr_body: str,
        diff: str,
        files_changed: List[str],
        comments: List[dict] = None
    ) -> str:
        """
        Generate a detailed summary of a PR including what it does and its impact.
        """
        try:
            truncated_diff = diff[:6000] if len(diff) > 6000 else diff
            
            comments_text = ""
            if comments:
                comments_text = "\n**Discussion:**\n" + "\n".join([
                    f"- {c.get('user', {}).get('login', 'Unknown')}: {c.get('body', '')[:200]}"
                    for c in comments[:5]
                ])
            
            prompt = f"""Provide a detailed summary of this Pull Request for a maintainer:

**Title:** {pr_title}
**Description:** {pr_body or 'No description provided'}
**Files Changed ({len(files_changed)}):** {', '.join(files_changed[:15])}{'...' if len(files_changed) > 15 else ''}
{comments_text}

**Diff Preview:**
```
{truncated_diff}
```

Write a comprehensive summary covering:
1. What this PR does (purpose and functionality)
2. Key changes made
3. Potential impact on the codebase
4. Any notable patterns or concerns

Keep it clear and actionable for a maintainer reviewing this PR."""

            response = self.client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that summarizes code changes for maintainers."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.6,
                max_tokens=1000
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"AI PR summary error: {e}")
            return f"Unable to generate summary: {str(e)}"
    
    async def generate_comment_suggestion(
        self,
        pr_title: str,
        pr_body: str,
        context: str,
        comment_type: str = "review"
    ) -> str:
        """
        Generate a suggested comment based on the PR context.
        
        Args:
            pr_title: PR title
            pr_body: PR description
            context: Additional context (e.g., specific file, issue, or concern)
            comment_type: Type of comment - "review", "approval", "request_changes", "question"
        """
        try:
            type_prompts = {
                "review": "Write a constructive code review comment. Be specific and helpful.",
                "approval": "Write an approval comment that is encouraging and mentions what was done well.",
                "request_changes": "Write a polite but clear comment requesting specific changes.",
                "question": "Write a clarifying question about the implementation."
            }
            
            prompt = f"""PR Title: {pr_title}
PR Description: {pr_body or 'No description'}

Context: {context}

{type_prompts.get(comment_type, type_prompts['review'])}

Write a professional GitHub comment (1-3 paragraphs). Be constructive and specific."""

            response = self.client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=[
                    {"role": "system", "content": "You are a helpful code review assistant. Write professional, constructive GitHub comments."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"AI comment suggestion error: {e}")
            return "Unable to generate suggestion. Please try again."
    
    async def generate_inline_suggestion(
        self,
        text: str,
        context_type: str = "general",
        max_tokens: int = 50
    ) -> str:
        """
        Generate a short inline text completion suggestion (Copilot-style).
        
        Args:
            text: Current text being typed
            context_type: Type of content (issue_reply, pr_comment, template, general)
            max_tokens: Maximum tokens for the suggestion
        
        Returns:
            Suggested text continuation
        """
        try:
            # Don't suggest for very short text
            if len(text.strip()) < 5:
                return ""
            
            # Context-specific system prompts
            context_prompts = {
                "issue_reply": "You are helping a maintainer write a reply to a GitHub issue. Continue the text naturally and professionally.",
                "pr_comment": "You are helping a maintainer write a code review comment. Continue the text with constructive, specific feedback.",
                "template": "You are helping create a response template for GitHub issues/PRs. Continue with clear, reusable language.",
                "contributor_reply": "You are helping a contributor write a reply to a GitHub issue or PR. Continue with a humble, thankful, and eager-to-learn tone. Be polite but not overly formal.",
                "general": "You are helping write text for open source project management. Continue naturally."
            }
            
            system_message = context_prompts.get(context_type, context_prompts["general"])
            system_message += """

IMPORTANT RULES:
- Only provide the continuation text, NOT the original text
- Keep suggestions concise (1-2 sentences max)
- Match the tone and style of the existing text
- Do not add any explanations or meta-commentary
- If the text seems complete, return an empty string"""

            prompt = f"""Continue this text naturally. Only output the continuation, nothing else:

"{text}"

Continuation:"""

            response = self.client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=max_tokens
            )
            
            suggestion = response.choices[0].message.content.strip()
            
            # Clean up the suggestion
            # Remove quotes if the model wrapped it
            if suggestion.startswith('"') and suggestion.endswith('"'):
                suggestion = suggestion[1:-1]
            if suggestion.startswith("'") and suggestion.endswith("'"):
                suggestion = suggestion[1:-1]
            
            # Don't return if it's just repeating the input
            if text.strip().endswith(suggestion.strip()[:20]):
                return ""
                
            return suggestion
            
        except Exception as e:
            logger.error(f"AI inline suggestion error: {e}")
            return ""
    
    async def generate_contributor_reply_suggestion(
        self,
        issue_title: str,
        issue_body: str,
        context: str,
        suggestion_type: str = "clarify"
    ) -> str:
        """
        Generate a suggested reply for a contributor with friendly, learning-focused tone.
        
        Args:
            issue_title: Issue or PR title
            issue_body: Issue or PR description
            context: Additional context (e.g., maintainer's previous comment)
            suggestion_type: Type of reply - "clarify", "update", "thank", "question"
        """
        try:
            type_prompts = {
                "clarify": "Write a polite reply clarifying your implementation or providing more details.",
                "update": "Write a brief update explaining what you've done or changed.",
                "thank": "Write a grateful reply thanking the maintainer for their feedback.",
                "question": "Write a polite question asking for more guidance or clarification."
            }
            
            system_message = """You are helping a contributor write a reply to a GitHub issue or PR.
The contributor is likely new to open source or learning, so:
- Be humble and receptive to feedback
- Express gratitude when appropriate
- Be clear but not overconfident
- Show willingness to learn and improve
- Keep the tone friendly and professional
- Don't be too formal or stiff"""

            prompt = f"""Issue/PR Title: {issue_title}
Issue/PR Description: {issue_body or 'No description'}

Context (recent discussion): {context}

{type_prompts.get(suggestion_type, type_prompts['clarify'])}

Write a helpful GitHub comment (1-2 paragraphs) from a contributor's perspective. Be polite and constructive."""

            response = self.client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct:free",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=400
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"AI contributor reply suggestion error: {e}")
            return "Unable to generate suggestion. Please try again."


# Singleton instances
ai_triage_service = AITriageService()
ai_chat_service = AIChatService()
