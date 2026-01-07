from .github_service import GitHubService
from .ai_service import AITriageService, AIChatService

__all__ = [
    'GitHubService', 
    'AITriageService', 
    'AIChatService',
]

# Spark services - optional, requires pyspark to be installed
try:
    from .spark_streaming import SparkStreamingService
    from .cookie_licking_service import CookieLickingService
    from .invisible_labor_analytics import InvisibleLaborAnalytics
    from .spark_sentiment_pipeline import SparkSentimentPipeline
    from .gamification_engine import GamificationEngine
    from .rag_data_prep import RAGDataPrep
    
    __all__.extend([
        'SparkStreamingService',
        'CookieLickingService',
        'InvisibleLaborAnalytics',
        'SparkSentimentPipeline',
        'GamificationEngine',
        'RAGDataPrep'
    ])
    SPARK_SERVICES_AVAILABLE = True
except ImportError:
    SPARK_SERVICES_AVAILABLE = False


