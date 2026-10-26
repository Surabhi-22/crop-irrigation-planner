from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.core.config import settings

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="API v1 Health Check",
    description="Returns service health status for API v1 monitoring.",
    tags=["Health"],
)
def get_v1_health() -> HealthResponse:
    """Return v1 service health status."""
    return HealthResponse(
        status="healthy",
        app_name=settings.PROJECT_NAME,
        version=settings.PROJECT_VERSION,
    )
