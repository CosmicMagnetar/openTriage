"""
Spark Session Manager for OpenTriage.
Provides centralized Spark session management with RAM-optimized configuration.
"""
import logging
import threading
from typing import Optional
from pyspark.sql import SparkSession
from pyspark import SparkConf
from config.settings import settings

logger = logging.getLogger(__name__)

# Thread-safe singleton pattern
_spark_session: Optional[SparkSession] = None
_spark_lock = threading.Lock()


def get_spark_config() -> SparkConf:
    """
    Create Spark configuration optimized for RAM-based processing.
    
    Returns:
        SparkConf with optimized settings for local mode processing.
    """
    conf = SparkConf()
    
    # Application settings
    conf.setAppName(settings.SPARK_APP_NAME)
    conf.setMaster(settings.SPARK_MASTER)
    
    # Memory configuration - optimized for RAM processing
    conf.set("spark.driver.memory", settings.SPARK_DRIVER_MEMORY)
    conf.set("spark.executor.memory", settings.SPARK_EXECUTOR_MEMORY)
    
    # Memory fraction - maximize RAM usage for in-memory processing
    conf.set("spark.memory.fraction", "0.8")
    conf.set("spark.memory.storageFraction", "0.5")
    
    # Shuffle optimization for local mode
    conf.set("spark.sql.shuffle.partitions", "8")
    conf.set("spark.default.parallelism", "8")
    
    # Enable adaptive query execution for better performance
    conf.set("spark.sql.adaptive.enabled", "true")
    conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
    
    # Arrow optimization for Pandas UDFs
    conf.set("spark.sql.execution.arrow.pyspark.enabled", "true")
    conf.set("spark.sql.execution.arrow.pyspark.fallback.enabled", "true")
    
    # Serialization optimization
    conf.set("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
    conf.set("spark.kryoserializer.buffer.max", "512m")
    
    # Broadcast join threshold for small tables
    conf.set("spark.sql.autoBroadcastJoinThreshold", "10485760")  # 10MB
    
    # Enable off-heap memory for better performance
    conf.set("spark.memory.offHeap.enabled", "true")
    conf.set("spark.memory.offHeap.size", "1g")
    
    # Disable UI in production (enable for debugging)
    conf.set("spark.ui.enabled", "true")
    conf.set("spark.ui.port", "4040")
    
    return conf


def get_or_create_spark_session() -> SparkSession:
    """
    Get or create a singleton Spark session.
    Thread-safe implementation for use in async FastAPI context.
    
    Returns:
        SparkSession: The active Spark session.
    """
    global _spark_session
    
    if _spark_session is not None and not _spark_session._jvm is None:
        try:
            # Verify session is still active
            _spark_session.sparkContext._jsc.sc().isStopped()
            return _spark_session
        except Exception:
            logger.warning("Existing Spark session is invalid, creating new one")
            _spark_session = None
    
    with _spark_lock:
        if _spark_session is None:
            logger.info("Initializing new Spark session...")
            
            conf = get_spark_config()
            
            _spark_session = (
                SparkSession.builder
                .config(conf=conf)
                .getOrCreate()
            )
            
            # Set log level
            _spark_session.sparkContext.setLogLevel(settings.SPARK_LOG_LEVEL)
            
            logger.info(f"Spark session initialized: version {_spark_session.version}")
            logger.info(f"Spark UI available at: http://localhost:4040")
    
    return _spark_session


def get_spark_session() -> Optional[SparkSession]:
    """
    Get the current Spark session without creating a new one.
    
    Returns:
        SparkSession or None if not initialized.
    """
    return _spark_session


def stop_spark_session() -> None:
    """
    Stop the Spark session gracefully.
    Call this on application shutdown.
    """
    global _spark_session
    
    with _spark_lock:
        if _spark_session is not None:
            logger.info("Stopping Spark session...")
            try:
                _spark_session.stop()
                logger.info("Spark session stopped successfully")
            except Exception as e:
                logger.error(f"Error stopping Spark session: {e}")
            finally:
                _spark_session = None


def is_spark_active() -> bool:
    """
    Check if Spark session is active and healthy.
    
    Returns:
        bool: True if session is active, False otherwise.
    """
    if _spark_session is None:
        return False
    
    try:
        # Try to execute a simple operation
        _spark_session.sparkContext._jsc.sc().isStopped()
        return True
    except Exception:
        return False


def get_spark_status() -> dict:
    """
    Get detailed Spark session status.
    
    Returns:
        dict with session status information.
    """
    if not is_spark_active():
        return {
            "active": False,
            "version": None,
            "app_name": None,
            "master": None,
            "ui_url": None
        }
    
    try:
        sc = _spark_session.sparkContext
        return {
            "active": True,
            "version": _spark_session.version,
            "app_name": sc.appName,
            "master": sc.master,
            "ui_url": f"http://localhost:{sc.getConf().get('spark.ui.port', '4040')}",
            "default_parallelism": sc.defaultParallelism,
            "executor_memory": sc.getConf().get("spark.executor.memory"),
            "driver_memory": sc.getConf().get("spark.driver.memory")
        }
    except Exception as e:
        return {
            "active": False,
            "error": str(e)
        }


# Utility functions for DataFrame operations

def create_dataframe_from_mongodb(collection_name: str, query: dict = None):
    """
    Create a Spark DataFrame from MongoDB collection.
    Uses pymongo to fetch data and convert to Spark DataFrame.
    
    Args:
        collection_name: Name of the MongoDB collection
        query: Optional MongoDB query filter
        
    Returns:
        Spark DataFrame with collection data
    """
    from config.database import db
    import asyncio
    
    async def fetch_data():
        collection = db[collection_name]
        filter_query = query or {}
        cursor = collection.find(filter_query, {"_id": 0})
        return await cursor.to_list(length=None)
    
    # Run async fetch in sync context
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    data = loop.run_until_complete(fetch_data())
    
    if not data:
        logger.warning(f"No data found in collection {collection_name}")
        return None
    
    spark = get_or_create_spark_session()
    return spark.createDataFrame(data)


def dataframe_to_mongodb(df, collection_name: str, mode: str = "append"):
    """
    Write Spark DataFrame to MongoDB collection.
    
    Args:
        df: Spark DataFrame to write
        collection_name: Target MongoDB collection
        mode: Write mode - 'append' or 'overwrite'
    """
    from config.database import db
    import asyncio
    
    # Convert to list of dicts
    data = [row.asDict() for row in df.collect()]
    
    async def write_data():
        collection = db[collection_name]
        if mode == "overwrite":
            await collection.delete_many({})
        if data:
            await collection.insert_many(data)
    
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    loop.run_until_complete(write_data())
    logger.info(f"Wrote {len(data)} records to {collection_name}")
