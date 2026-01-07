import logging
import asyncio

logger = logging.getLogger(__name__)

class EmailService:
    async def send_email(self, recipient_email: str, subject: str, content: str):
        """
        Mock sending an email.
        """
        logger.info(f"--- Sending Email ---")
        logger.info(f"To: {recipient_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Content: {content}")
        logger.info(f"--- End Email ---")
        
        # Simulate network delay
        await asyncio.sleep(0.5)
        return True

    async def send_badge_email(self, user_email: str, username: str, badge_name: str, badge_desc: str):
        """
        Send a badge unlock notification.
        """
        subject = f"Congratulations! You unlocked the {badge_name} badge!"
        content = f"""
        Hi {username},
        
        You've just unlocked a new badge: {badge_name}!
        
        Description: {badge_desc}
        
        Keep up the great work!
        
        - The OpenTriage Team
        """
        return await self.send_email(user_email, subject, content)

email_service = EmailService()
