from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from config.settings import settings
from config.database import db, client
from routes import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(title="OpenTriage API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS + [settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Check API and database health."""
    try:
        await db.command('ping')
        
        # Check Spark status (optional)
        try:
            from spark_manager import is_spark_active
            spark_status = "active" if is_spark_active() else "inactive"
        except ImportError:
            spark_status = "not_installed"
        
        return {
            "status": "healthy", 
            "database": "connected",
            "spark": spark_status
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

# Include API router
app.include_router(api_router)

# Startup event - Initialize Spark
@app.on_event("startup")
async def startup():
    """Initialize services on startup."""
    logger.info("Starting OpenTriage API...")
    
    # Pre-warm Spark session (optional - can be lazy loaded)
    try:
        from spark_manager import get_or_create_spark_session
        spark = get_or_create_spark_session()
        logger.info(f"Spark session initialized: v{spark.version}")
    except Exception as e:
        logger.warning(f"Spark initialization deferred: {e}")
    
    # Start streaming service (optional - enable if using webhooks)
    # from services.spark_streaming import spark_streaming_service
    # spark_streaming_service.start_streaming()
    # logger.info("Spark streaming service started")
    
    # Start cookie-licking background scan (optional)
    # from services.cookie_licking_service import cookie_licking_service
    # cookie_licking_service.start_background_scan()
    # logger.info("Cookie-licking background scan started")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_db_client():
    """Close database and Spark connections on shutdown."""
    
    # Stop Spark streaming
    try:
        from services.spark_streaming import spark_streaming_service
        spark_streaming_service.stop_streaming()
        logger.info("Spark streaming stopped")
    except Exception as e:
        logger.debug(f"Streaming shutdown note: {e}")
    
    # Stop cookie-licking scan
    try:
        from services.cookie_licking_service import cookie_licking_service
        cookie_licking_service.stop_background_scan()
        logger.info("Cookie-licking scan stopped")
    except Exception as e:
        logger.debug(f"Cookie-licking shutdown note: {e}")
    
    # Stop Spark session
    try:
        from spark_manager import stop_spark_session
        stop_spark_session()
        logger.info("Spark session stopped")
    except Exception as e:
        logger.debug(f"Spark shutdown note: {e}")
    
    # Close database connection
    client.close()
    logger.info("Database connection closed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)