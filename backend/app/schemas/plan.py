"""
Pydantic schemas for the crop planning API response.

All schemas use explicit field descriptions and units to avoid ambiguity.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class CropPlanItem(BaseModel):
    """Result for a single feasible crop option."""

    name: str = Field(..., description="Crop name")
    season: str = Field(..., description="Agricultural season")
    duration_days: str = Field(..., description="Typical growth duration (days)")
    notes: str = Field(..., description="Agronomic notes")

    # Per-acre reference values
    water_req_mm: float = Field(
        ..., description="Total seasonal water requirement (mm) — rainfall + irrigation"
    )
    irrigation_req_m3: float = Field(
        ...,
        description=(
            "Supplemental irrigation needed (m³) for the full farm area "
            "after deducting expected rainfall"
        ),
    )
    yield_t_per_acre: float = Field(
        ..., description="Benchmark yield per acre (metric tonnes)"
    )
    price_inr_per_tonne: float = Field(
        ..., description="Indicative wholesale / MSP price (₹/tonne)"
    )
    cost_inr_per_acre: float = Field(
        ..., description="Estimated cultivation cost per acre (₹)"
    )

    # Full-area computed values
    est_total_yield_tonnes: float = Field(
        ..., description="Estimated total yield for the farm area (tonnes) — estimate"
    )
    est_total_revenue_inr: float = Field(
        ..., description="Estimated gross revenue for the farm area (₹) — estimate"
    )
    est_total_cost_inr: float = Field(
        ..., description="Estimated total cultivation cost for the farm area (₹) — estimate"
    )
    est_total_profit_inr: float = Field(
        ..., description="Estimated net profit (revenue − cost) for the farm area (₹) — estimate"
    )


class WaterSummary(BaseModel):
    """Water availability and allocation summary."""

    total_available_m3: float = Field(
        ..., description="Total irrigation water reserve (m³)"
    )
    expected_rainfall_m3: float = Field(
        ..., description="Seasonal rainfall volume over the farm area (m³)"
    )
    allocated_m3: float = Field(
        ..., description="Irrigation water allocated to recommended crops (m³)"
    )
    remaining_m3: float = Field(
        ..., description="Irrigation water remaining after plan allocation (m³)"
    )
    allocation_pct: float = Field(
        ..., description="Percentage of irrigation reserve allocated (%)"
    )


class PlanResponse(BaseModel):
    """
    Complete crop plan response returned by POST /api/v1/plan/generate.

    When feasible=True the plan contains real outputs from the planning service.
    When feasible=False the plan contains an explanation and actionable suggestions.
    """

    feasible: bool = Field(
        ...,
        description="True when at least one crop satisfies all constraints",
    )
    infeasibility_reason: Optional[str] = Field(
        default=None,
        description="Human-readable explanation of why the plan is infeasible",
    )
    infeasibility_suggestions: Optional[List[str]] = Field(
        default=None,
        description="Actionable suggestions to resolve infeasibility",
    )

    # Farm context (echoed for display)
    farm_area_acres: float = Field(..., description="Farm area (acres)")
    season: str = Field(..., description="Agricultural season")
    location: str = Field(..., description="Farm location")
    soil_type: str = Field(..., description="Soil classification")

    # Water summary (always present)
    water: WaterSummary = Field(..., description="Water availability and allocation")

    # Crops (null when infeasible)
    top_recommendation: Optional[CropPlanItem] = Field(
        default=None,
        description="Best crop by estimated profit",
    )
    all_feasible_crops: Optional[List[CropPlanItem]] = Field(
        default=None,
        description="All crops that passed feasibility checks, sorted by estimated profit",
    )

    # Planning metadata
    planning_notes: List[str] = Field(
        default_factory=list,
        description="Contextual notes from the planning engine",
    )
    data_source: str = Field(
        default="ICAR agronomic benchmarks (2023–24) — estimates only",
        description="Source of agronomic reference data",
    )
    disclaimer: str = Field(
        default=(
            "All yield, revenue, cost, and profit figures are indicative estimates "
            "derived from ICAR benchmark data and APMC market prices. "
            "Actual results depend on local soil health, weather variability, "
            "pest pressure, and market conditions. "
            "This tool does not constitute financial or agronomic advice."
        ),
        description="Disclaimer for all estimated values",
    )
