from typing import Optional
from pydantic import BaseModel, Field, field_validator


class FarmInput(BaseModel):
    area_acres: float = Field(
        ...,
        gt=0,
        description="Cultivation land area in acres. Must be greater than 0.",
        examples=[5.0],
    )
    soil_type: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Primary soil classification (e.g., Loamy, Clay, Sandy, Silty).",
        examples=["Loamy"],
    )
    expected_rainfall_mm: float = Field(
        ...,
        ge=0,
        description="Forecasted seasonal precipitation in millimeters. Must be non-negative.",
        examples=[650.0],
    )
    available_water_m3: float = Field(
        ...,
        ge=0,
        description="Total available volumetric irrigation water reserve in cubic meters. Must be non-negative.",
        examples=[3000.0],
    )
    location: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Geographic region, district, or farm location.",
        examples=["Bengaluru"],
    )
    season: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Agricultural cultivation season (e.g., Kharif, Rabi, Summer).",
        examples=["Kharif"],
    )
    budget_inr: Optional[float] = Field(
        ...,
        ge=0,
        description=(
            "Available operational working capital in Indian Rupees (INR). "
            "null represents an unconstrained budget; 0 represents zero operational capital; "
            "positive numbers represent actual working budget limits."
        ),
        examples=[100000.0],
    )

    @field_validator("location", "soil_type", "season")
    @classmethod
    def validate_non_empty_string(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field must not be empty or contain only whitespace.")
        return stripped

    model_config = {
        "json_schema_extra": {
            "example": {
                "area_acres": 5.0,
                "soil_type": "Loamy",
                "expected_rainfall_mm": 650.0,
                "available_water_m3": 3000.0,
                "location": "Bengaluru",
                "season": "Kharif",
                "budget_inr": 100000.0,
            }
        }
    }


class FarmValidationResponse(BaseModel):
    valid: bool = Field(
        default=True,
        description="Indicates whether all validation rules passed",
    )
    message: str = Field(
        default="Farm input parameters are valid.",
        description="Summary validation status message",
    )
    data: FarmInput = Field(
        ...,
        description="Echo of validated farm parameters with explicit physical units",
    )
