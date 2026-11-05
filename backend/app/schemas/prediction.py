"""
Pydantic schemas for Machine Learning Yield & Price Prediction endpoints.

Matches the agreed standard schema documented in docs/prediction_api_schema.md.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class YieldPredictionRequest(BaseModel):
    crop: str = Field(..., description="Crop name (e.g., 'Maize', 'Rice', 'Sugarcane')")
    district: str = Field(..., description="Karnataka district name (e.g., 'BELAGAVI', 'MYSURU')")
    season: str = Field(..., description="Cropping season ('Kharif', 'Rabi', 'Summer', 'Whole Year')")
    area_hectares: float = Field(default=1.0, gt=0, description="Cultivated land area in hectares (> 0)")
    year: int = Field(default=2024, ge=1990, le=2035, description="Target agricultural year")


class YieldPredictionResponse(BaseModel):
    crop: str
    district: str
    season: str
    year: int
    area_hectares: float
    predicted_yield_tonnes_per_hectare: Optional[float] = None
    estimated_production_tonnes: Optional[float] = None
    yield_unit: str = "tonnes per hectare"
    predicted_price_per_tonne: Optional[float] = None
    price_unit: Optional[str] = None
    status: str
    limitations: List[str] = Field(default_factory=list)


class PricePredictionRequest(BaseModel):
    crop: str = Field(..., description="Commodity name (e.g., 'Rice', 'Maize', 'Wheat', 'Groundnut')")
    market: Optional[str] = Field(default=None, description="Optional target market name")
    prediction_date: Optional[str] = Field(default=None, description="Target date 'YYYY-MM' or 'YYYY-MM-DD'")
    year: Optional[int] = Field(default=None, ge=1990, le=2035, description="Target year")
    month: Optional[int] = Field(default=None, ge=1, le=12, description="Target month (1-12)")


class PricePredictionResponse(BaseModel):
    crop: str
    market: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None
    predicted_yield_tonnes_per_hectare: Optional[float] = None
    predicted_price_per_tonne: Optional[float] = None
    predicted_price_per_quintal: Optional[float] = None
    price_unit: Optional[str] = None
    status: str
    limitations: List[str] = Field(default_factory=list)


class CropPlanPredictionRequest(BaseModel):
    crop: str = Field(..., description="Crop name")
    district: str = Field(..., description="Karnataka district name")
    season: Optional[str] = Field(default=None, description="Cropping season")
    area_hectares: float = Field(default=1.0, gt=0, description="Cultivated land area in hectares (> 0)")
    year: Optional[int] = Field(default=None, ge=1990, le=2035, description="Planning year")
    month: Optional[int] = Field(default=None, ge=1, le=12, description="Target month (1-12)")
    prediction_date: Optional[str] = Field(default=None, description="Target date 'YYYY-MM'")
    market: Optional[str] = Field(default=None, description="Optional market name")


class CropPlanPredictionResponse(BaseModel):
    crop: str
    district: str
    season: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None
    area_hectares: float
    predicted_yield_tonnes_per_hectare: Optional[float] = None
    predicted_price_per_tonne: Optional[float] = None
    predicted_price_per_quintal: Optional[float] = None
    price_unit: Optional[str] = None
    status: str
    limitations: List[str] = Field(default_factory=list)
