from fastapi import APIRouter
from app.schemas.farm import FarmInput, FarmValidationResponse

router = APIRouter()


@router.post(
    "/farm/validate",
    response_model=FarmValidationResponse,
    summary="Validate Farm Parameters",
    description="Validates agricultural farm inputs (area, soil, rainfall, water reserve, budget, location, season) against physical bounds.",
    tags=["Farm"],
)
def validate_farm_input(farm_input: FarmInput) -> FarmValidationResponse:
    """
    Accepts farm inputs, validates against physical and agronomic boundaries,
    and returns the validated parameters.
    """
    return FarmValidationResponse(
        valid=True,
        message="Farm input parameters are valid and normalized.",
        data=farm_input,
    )
