from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.schemas.health import HealthResponse

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="FastAPI Backend for Crop & Irrigation Planner — Team Anvaya",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get(
    "/",
    summary="Root Service Information",
    description="Returns top-level metadata, team info, and API documentation endpoints.",
    tags=["Root"],
)
def root():
    """Root endpoint providing service information."""
    return {
        "service": settings.PROJECT_NAME,
        "team": "Anvaya",
        "version": settings.PROJECT_VERSION,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "api_v1_health": f"{settings.API_V1_STR}/health",
        "api_v1_validate": f"{settings.API_V1_STR}/farm/validate",
    }


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Root Health Check",
    description="Returns top-level operational health status of the application.",
    tags=["Health"],
)
def health_check() -> HealthResponse:
    """Root-level health check endpoint."""
    return HealthResponse(
        status="healthy",
        app_name=settings.PROJECT_NAME,
        version=settings.PROJECT_VERSION,
        timestamp=datetime.now(timezone.utc),
    )
