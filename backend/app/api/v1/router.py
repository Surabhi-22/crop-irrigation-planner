from fastapi import APIRouter
from app.api.v1.endpoints import health, farm, plan

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(farm.router)
api_router.include_router(plan.router)
