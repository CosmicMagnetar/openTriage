"""
Spark Session Manager for OpenTriage AI Engine.
Provides a singleton Spark session for distributed processing.
"""
import os
import logging
from pyspark.sql import SparkSession
from config.settings import settings

logger = logging.getLogger(__name__)

_spark_session = None


def get_or_create_spark_session() -> SparkSession:
    """
    Get or create a Spark session.
    
    Returns:
        SparkSession: The Spark session instance
    """
    global _spark_session
    
    if _spark_session is not None:
        return _spark_session
    
    try:
        builder = SparkSession.builder \
            .appName(settings.SPARK_APP_NAME) \
            .master(settings.SPARK_MASTER)
        
        # Configure memory if specified
        if settings.SPARK_DRIVER_MEMORY:
            builder = builder.config("spark.driver.memory", settings.SPARK_DRIVER_MEMORY)
        
        if settings.SPARK_EXECUTOR_MEMORY:
            builder = builder.config("spark.executor.memory", settings.SPARK_EXECUTOR_MEMORY)
        
        # Reduce logging verbosity
        builder = builder.config("spark.ui.showConsoleProgress", "false")
        
        _spark_session = builder.getOrCreate()
        
        # Set log level
        _spark_session.sparkContext.setLogLevel(settings.SPARK_LOG_LEVEL)
        
        logger.info(f"Spark session created: {settings.SPARK_APP_NAME}")
        
        return _spark_session
        
    except Exception as e:
        logger.error(f"Failed to create Spark session: {e}")
        raise


def stop_spark_session():
    """Stop the Spark session if running."""
    global _spark_session
    
    if _spark_session is not None:
        _spark_session.stop()
        _spark_session = None
        logger.info("Spark session stopped")
