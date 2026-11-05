"""
Pydantic schemas for the crop planning API response.

All schemas use explicit field descriptions and units to avoid ambiguity.
Supports 3 recommendation categories (Category A: Feasible, Category B: Alternative,
Category C: Unsuitable) and budget-aware partial-area cultivation plans.
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
            "Supplemental irrigation needed (m³) for the recommended cultivated area "
            "after deducting expected rainfall (baseline assumption: 100% effective precipitation)"
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

    # Computed values for the recommended cultivated area
    est_total_yield_tonnes: float = Field(
        ..., description="Estimated total yield for the cultivated area (tonnes) — estimate"
    )
    est_total_revenue_inr: float = Field(
        ..., description="Estimated gross revenue for the cultivated area (₹) — estimate"
    )
    est_total_cost_inr: float = Field(
        ..., description="Estimated total cultivation cost for the cultivated area (₹) — estimate"
    )
    est_total_profit_inr: float = Field(
        ..., description="Estimated net profit (revenue − cost) for the cultivated area (₹) — estimate"
    )

    # Budget-aware cultivation parcel details
    recommended_area_acres: float = Field(
        default=0.0, description="Cultivated land area recommended for this crop (acres)"
    )
    remaining_area_acres: float = Field(
        default=0.0, description="Uncultivated portion of the total farm area (acres)"
    )
    is_partial_area: bool = Field(
        default=False, description="True if recommended area is smaller than total farm area due to budget/water limits"
    )
    limiting_factor: Optional[str] = Field(
        default="None", description="Primary constraint determining cultivated area ('None', 'Budget', 'Water', 'Budget and Water')"
    )
    full_area_cost_inr: float = Field(
        default=0.0, description="Total cultivation cost if the full farm area were planted (₹)"
    )
    budget_gap_for_full_area_inr: float = Field(
        default=0.0, description="Additional budget required to cultivate the entire farm area (₹)"
    )
    remaining_budget_inr: float = Field(
        default=0.0, description="Remaining unallocated operational budget (₹)"
    )
    roi_pct: float = Field(
        default=0.0, description="Return on investment percentage (estimated net profit / cultivation cost * 100)"
    )
    category: str = Field(
        default="recommended", description="Recommendation category ('recommended', 'alternative', 'unsuitable')"
    )
    suitability_reason: str = Field(
        default="", description="Plain-language explanation of why this crop is recommended or how it fits constraints"
    )


class AlternativeCropItem(BaseModel):
    """An alternative crop option that can become feasible with quantified adjustments."""

    name: str = Field(..., description="Crop name")
    season: str = Field(..., description="Crop natural season(s)")
    duration_days: str = Field(..., description="Typical duration (days)")
    notes: str = Field(..., description="Agronomic notes")
    cost_inr_per_acre: float = Field(..., description="Estimated cultivation cost per acre (₹)")
    water_req_mm: float = Field(..., description="Seasonal water requirement (mm)")
    yield_t_per_acre: float = Field(..., description="Benchmark yield per acre (tonnes)")
    price_inr_per_tonne: float = Field(..., description="Indicative market price (₹/tonne)")
    category: str = Field(default="alternative", description="Category identifier")
    required_adjustment: str = Field(..., description="Quantified requirement or adjustment needed")
    adjustment_type: str = Field(..., description="Type of constraint: 'budget', 'water', 'season', 'soil', 'area'")
    full_area_cost_inr: float = Field(default=0.0, description="Cost to cultivate full farm area (₹)")
    budget_gap_inr: float = Field(default=0.0, description="Additional budget needed for full farm (₹)")
    water_gap_m3: float = Field(default=0.0, description="Additional irrigation water needed (m³)")
    alternative_season: Optional[str] = Field(default=None, description="Suggested alternative season")
    target_soil: Optional[str] = Field(default=None, description="Target soil required")
    why_alternative: str = Field(default="", description="Explanation of why this is a viable alternative")


class UnsuitableCropItem(BaseModel):
    """A crop that fails core agronomic constraints for this farm."""

    name: str = Field(..., description="Crop name")
    category: str = Field(default="unsuitable", description="Category identifier")
    rejection_reasons: List[str] = Field(..., description="List of reasons why crop is unsuitable")
    notes: str = Field(default="", description="Agronomic context")


class CropWaterComparison(BaseModel):
    """Water requirement and supply comparison for an alternative candidate crop."""

    name: str = Field(..., description="Crop name")
    water_req_mm: float = Field(..., description="Total crop seasonal water demand (mm)")
    irrigation_req_m3: float = Field(
        ..., description="Net supplemental irrigation demand for full farm (m³)"
    )
    available_supply_m3: float = Field(..., description="Available irrigation supply (m³)")
    allocated_m3: float = Field(..., description="Irrigation water that would be allocated (m³)")
    remaining_m3: float = Field(..., description="Remaining water if this crop is selected (m³)")
    deficit_m3: float = Field(..., description="Water deficit if this crop is selected (m³)")
    surplus_m3: float = Field(..., description="Water surplus if this crop is selected (m³)")
    allocation_pct: float = Field(
        ..., description="Percentage of available supply required/allocated (%)"
    )
    is_feasible: bool = Field(..., description="Whether water supply is sufficient for this crop")


class IrrigationMethodComparison(BaseModel):
    """Comparative gross water withdrawal across irrigation methods."""

    method: str = Field(..., description="Irrigation method name (e.g. Drip, Sprinkler, Surface/Flood)")
    efficiency_pct: float = Field(..., description="Illustrative application efficiency percentage (%)")
    net_requirement_m3: float = Field(..., description="Net crop irrigation requirement (m³)")
    gross_withdrawal_m3: float = Field(..., description="Estimated gross water withdrawal needed (m³)")
    savings_vs_baseline_m3: float = Field(
        ..., description="Estimated water volume saved vs Surface/Flood baseline (m³)"
    )
    savings_pct: float = Field(..., description="Estimated percentage saved vs Surface/Flood baseline (%)")
    is_baseline: bool = Field(default=False, description="True if this method serves as comparison baseline")
    feasibility_status: str = Field(..., description="Whether available supply satisfies gross withdrawal")


class WaterSummary(BaseModel):
    """Water availability and allocation summary."""

    total_available_m3: float = Field(
        ..., description="Total irrigation water reserve (m³)"
    )
    expected_rainfall_m3: float = Field(
        ..., description="Seasonal rainfall volume over the farm area (m³). Baseline calculation assumes precipitation directly contributes to water balance."
    )
    allocated_m3: float = Field(
        ..., description="Irrigation water allocated to recommended crop (m³)"
    )
    remaining_m3: float = Field(
        ..., description="Irrigation water remaining after plan allocation (m³)"
    )
    allocation_pct: float = Field(
        ..., description="Percentage of irrigation reserve allocated (%)"
    )

    # Enhanced fields for robust water optimization
    selected_crop_name: Optional[str] = Field(
        default=None, description="Name of the crop used for this water balance"
    )
    net_demand_m3: Optional[float] = Field(
        default=0.0, description="Total net irrigation requirement of the selected crop (m³)"
    )
    deficit_m3: Optional[float] = Field(
        default=0.0, description="Unmet irrigation requirement if demand exceeds supply (m³)"
    )
    surplus_m3: Optional[float] = Field(
        default=0.0, description="Surplus irrigation reserve if supply exceeds demand (m³)"
    )
    candidate_crops: List[CropWaterComparison] = Field(
        default_factory=list, description="Water comparisons for candidate crops"
    )
    irrigation_methods: List[IrrigationMethodComparison] = Field(
        default_factory=list, description="Comparative gross withdrawals across irrigation methods"
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

    # Category A: Recommended crops (null when infeasible)
    top_recommendation: Optional[CropPlanItem] = Field(
        default=None,
        description="Best crop by estimated profit",
    )
    all_feasible_crops: Optional[List[CropPlanItem]] = Field(
        default=None,
        description="All crops that passed feasibility checks, sorted by estimated profit",
    )

    # Category B & C recommendations
    alternative_crops: List[AlternativeCropItem] = Field(
        default_factory=list,
        description="Alternative crops that can become feasible with specific quantified adjustments",
    )
    unsuitable_crops: List[UnsuitableCropItem] = Field(
        default_factory=list,
        description="Crops incompatible with core agronomic conditions (season, soil, or extreme water)",
    )

    # Farmer-friendly budget-aware notification banner
    budget_aware_notice: Optional[str] = Field(
        default=None,
        description="Notice explaining partial land cultivation when full area exceeds budget or water",
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
            "All yield, revenue, cost, profit, and water figures are indicative estimates "
            "derived from ICAR benchmark data and APMC market prices. "
            "Precipitation accounting assumes expected seasonal rainfall contributes directly to crop water requirements; "
            "actual field effectiveness depends on soil percolation, slope, and rainfall intensity. "
            "This tool does not constitute financial or agronomic advice."
        ),
        description="Disclaimer for all estimated values",
    )
