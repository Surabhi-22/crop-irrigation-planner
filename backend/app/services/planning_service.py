"""
Planning service — orchestrates the full crop planning pipeline.

Pipeline:
  1. Validate inputs (delegated to FastAPI / Pydantic layer upstream).
  2. Call crop_selector to classify crops into Category A (Feasible/Recommended),
     Category B (Alternative with adjustments), and Category C (Unsuitable).
  3. Sizing and budget-aware partial-area parcel allocation.
  4. Call water_allocator to evaluate irrigation water balance.
  5. Build and return a structured PlanResult.
  6. Raise InfeasiblePlanError with actionable guidance if no crop is feasible.

All agronomic figures are derived from ICAR benchmarks and APMC wholesale prices.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from app.services.crop_selector import (
    AlternativeCrop,
    FeasibleCrop,
    RejectedCrop,
    minimum_budget_for_cheapest_crop,
    minimum_budget_for_minimum_parcel,
    minimum_water_for_lowest_demand_crop,
    select_feasible_crops,
)
from app.services.water_allocator import WaterAllocation, allocate_water
from app.services.crop_data import MM_PER_ACRE_TO_M3


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------


class InfeasiblePlanError(Exception):
    """
    Raised when no crop can satisfy all feasibility constraints (season,
    soil, water, budget) for the given farm parameters, even on a partial parcel.
    """

    def __init__(self, reason: str, suggestions: List[str] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.suggestions: List[str] = suggestions or []


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------


@dataclass
class PlanResult:
    """
    Structured output of the planning pipeline.

    All financial and yield figures are benchmark estimates derived from
    ICAR research publications and state MSP guidelines.
    """

    # ── Farm context ──────────────────────────────────────────────────────
    farm_area_acres: float
    season: str
    location: str
    soil_type: str

    # ── Water summary ─────────────────────────────────────────────────────
    total_available_water_m3: float       # the farm's irrigation reserve
    expected_rainfall_m3: float           # rainfall volume over entire farm area
    water_allocation: WaterAllocation

    # ── Categorized Crop results ───────────────────────────────────────────
    feasible_crops: List[FeasibleCrop]    # Category A: feasible crops for recommended area
    rejected_crops: List[RejectedCrop]    # Category C: agronomically unsuitable crops
    top_recommendation: FeasibleCrop      # Top recommended crop by estimated profit
    alternative_crops: List[AlternativeCrop] = field(default_factory=list)  # Category B

    # ── Aggregated financials for top recommendation ──────────────────────
    est_total_yield_tonnes: float = 0.0
    est_total_revenue_inr: float = 0.0
    est_total_cost_inr: float = 0.0
    est_total_profit_inr: float = 0.0

    # ── Farmer-friendly notifications & metadata ───────────────────────────
    budget_aware_notice: Optional[str] = None
    planning_notes: List[str] = field(default_factory=list)
    data_source: str = "ICAR agronomic benchmarks (2023–24) — estimates only"
    disclaimer: str = (
        "All yield, revenue, cost, profit, and water figures are indicative estimates "
        "derived from ICAR benchmark data and APMC market prices. "
        "Precipitation accounting assumes expected seasonal rainfall contributes directly to crop water requirements; "
        "actual field effectiveness depends on soil percolation, slope, and rainfall intensity. "
        "This tool does not constitute financial or agronomic advice."
    )


# ---------------------------------------------------------------------------
# Main planning function
# ---------------------------------------------------------------------------


def generate_plan(
    area_acres: float,
    soil_type: str,
    expected_rainfall_mm: float,
    available_water_m3: float,
    location: str,
    season: str,
    budget_inr: Optional[float] = None,
) -> PlanResult:
    """
    Generate a budget-aware crop plan for the given farm parameters.

    Evaluates both full-farm and partial-area parcel feasibility to provide
    practical, realistic recommendations rather than rigid rejection.

    Parameters:
      budget_inr: Optional[float]
        None = unconstrained budget.
        0.0  = zero operational capital.
        >0   = available budget limit in INR.
    """
    notes: List[str] = []

    # ── Step 1: Select feasible crops and alternatives ─────────────────────
    feasible, alternatives, rejected = select_feasible_crops(
        season=season,
        soil_type=soil_type,
        area_acres=area_acres,
        expected_rainfall_mm=expected_rainfall_mm,
        available_water_m3=available_water_m3,
        budget_inr=budget_inr,
    )

    # ── Step 2: Handle total infeasibility ─────────────────────────────────
    if not feasible:
        suggestions = _build_infeasibility_suggestions(
            season=season,
            soil_type=soil_type,
            area_acres=area_acres,
            expected_rainfall_mm=expected_rainfall_mm,
            available_water_m3=available_water_m3,
            budget_inr=budget_inr,
            rejected=rejected,
            alternatives=alternatives,
        )

        reason = _summarise_infeasibility(
            rejected=rejected,
            alternatives=alternatives,
            season=season,
            soil_type=soil_type,
            budget_inr=budget_inr,
        )

        raise InfeasiblePlanError(reason=reason, suggestions=suggestions)

    # ── Step 3: Water allocation ───────────────────────────────────────────
    water_alloc = allocate_water(feasible, available_water_m3)

    # ── Step 4: Build notes and farmer-friendly budget notice ──────────────
    top = feasible[0]
    rain_vol_m3 = expected_rainfall_mm * area_acres * MM_PER_ACRE_TO_M3
    budget_notice: Optional[str] = None

    if budget_inr is None:
        notes.append("Unconstrained budget mode: Cultivation plan sized without working capital limits.")
    elif budget_inr > 0 and top.is_partial_area:
        budget_notice = (
            f"Budget-Aware Plan: Your operational budget of ₹{budget_inr:,.0f} supports "
            f"cultivating {top.cultivated_area_acres:.2f} acres of your {area_acres:.1f}-acre farm. "
            f"The remaining {top.remaining_area_acres:.2f} acres can remain as a fallow buffer or for future cycles. "
            f"Full {area_acres:.1f}-acre cultivation requires a budget of ₹{top.full_area_cost_inr:,.0f} "
            f"(additional ₹{top.budget_gap_for_full_area_inr:,.0f})."
        )
        notes.append(
            f"Partial cultivation mode: Recommended crop parcel is {top.cultivated_area_acres:.2f} acres "
            f"due to operational capital constraint (₹{top.total_cost_inr:,.0f} of ₹{budget_inr:,.0f} allocated)."
        )
    elif budget_inr > 0:
        notes.append(
            f"Full-farm cultivation: Your budget (₹{budget_inr:,.0f}) covers the entire {area_acres:.1f} acres."
        )

    # Hydrological rainfall qualification note
    notes.append(
        f"Expected seasonal precipitation ({expected_rainfall_mm:.0f} mm) provides "
        f"approximately {rain_vol_m3:,.0f} m³ across {area_acres:.1f} acres. "
        f"Hydrological baseline: Precipitation is currently assumed to contribute directly to crop water demand. "
        f"Actual effective rainfall may vary with soil infiltration rate, field slope, and runoff."
    )

    if len(feasible) > 1:
        notes.append(
            f"{len(feasible)} crop options are viable for your farm. "
            f"The top recommendation ({top.name}) maximizes net profit."
        )

    if alternatives:
        notes.append(
            f"{len(alternatives)} alternative crop options identified for seasonal rotation or soil enrichment."
        )

    # ── Step 5: Return result ──────────────────────────────────────────────
    return PlanResult(
        farm_area_acres=area_acres,
        season=season,
        location=location,
        soil_type=soil_type,
        total_available_water_m3=available_water_m3,
        expected_rainfall_m3=rain_vol_m3,
        water_allocation=water_alloc,
        feasible_crops=feasible,
        rejected_crops=rejected,
        alternative_crops=alternatives,
        top_recommendation=top,
        est_total_yield_tonnes=top.total_yield_tonnes,
        est_total_revenue_inr=top.total_revenue_inr,
        est_total_cost_inr=top.total_cost_inr,
        est_total_profit_inr=top.total_profit_inr,
        budget_aware_notice=budget_notice,
        planning_notes=notes,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _summarise_infeasibility(
    rejected: List[RejectedCrop],
    alternatives: List[AlternativeCrop],
    season: str,
    soil_type: str,
    budget_inr: Optional[float] = None,
) -> str:
    """Build a human-readable summary of why all crops were rejected."""
    if budget_inr is not None and budget_inr == 0.0:
        return (
            f"No feasible crops found for {season} season on {soil_type} soil. "
            f"Zero operational budget provided (₹0). Commercial crop cultivation requires minimum working capital "
            f"for seeds, land preparation, and inputs."
        )

    season_failures = sum(
        1 for r in rejected if any("season" in reason.lower() for reason in r.rejection_reasons)
    )
    soil_failures = sum(
        1 for r in rejected if any("soil" in reason.lower() for reason in r.rejection_reasons)
    )
    water_failures = sum(
        1 for r in rejected if any("water" in reason.lower() for reason in r.rejection_reasons)
    )

    budget_alt_failures = sum(
        1 for a in alternatives if a.adjustment_type == "budget"
    )
    water_alt_failures = sum(
        1 for a in alternatives if a.adjustment_type == "water"
    )

    parts: List[str] = []
    if season_failures:
        parts.append(f"{season_failures} crop(s) are not grown in {season} season")
    if soil_failures:
        parts.append(f"{soil_failures} crop(s) are incompatible with {soil_type} soil")
    if (water_failures + water_alt_failures) > 0:
        parts.append(f"{water_failures + water_alt_failures} crop(s) require more irrigation water than available")
    if budget_alt_failures:
        parts.append(f"{budget_alt_failures} crop(s) exceed the available budget even for a minimum 0.1-acre parcel")

    if not parts:
        return f"No crops are feasible for {season} season on {soil_type} soil."

    return (
        f"No feasible crops found for {season} season on {soil_type} soil. "
        + "; ".join(parts) + "."
    )


def _build_infeasibility_suggestions(
    season: str,
    soil_type: str,
    area_acres: float,
    expected_rainfall_mm: float,
    available_water_m3: float,
    budget_inr: Optional[float],
    rejected: List[RejectedCrop],
    alternatives: List[AlternativeCrop],
) -> List[str]:
    """Generate actionable, farmer-friendly suggestions for resolving infeasibility."""
    suggestions: List[str] = []

    if budget_inr is not None and budget_inr == 0.0:
        min_parcel_budget = minimum_budget_for_minimum_parcel(season, soil_type, 0.1)
        full_farm_budget = minimum_budget_for_cheapest_crop(season, soil_type, area_acres)
        suggestions.append(
            "Enter your available operational capital, or check 'No fixed budget limit' to view unconstrained crop plans."
        )
        if min_parcel_budget:
            suggestions.append(
                f"A working budget of at least ₹{min_parcel_budget:,.0f} is required to cultivate "
                f"a 0.1-acre parcel of the least-expensive crop in {season} season."
            )
        if full_farm_budget:
            suggestions.append(
                f"Cultivating all {area_acres:.1f} acres requires a working budget of ₹{full_farm_budget:,.0f}."
            )
        suggestions.append(
            "Consider minimal-input or Zero-Budget Natural Farming (ZBNF) approaches if external funds are not available."
        )
        return suggestions

    # Check if budget is the bottleneck for minimum viable parcel
    budget_alts = [a for a in alternatives if a.adjustment_type == "budget"]
    if budget_alts and budget_inr is not None and budget_inr > 0:
        min_parcel_budget = minimum_budget_for_minimum_parcel(season, soil_type, 0.1)
        full_farm_budget = minimum_budget_for_cheapest_crop(season, soil_type, area_acres)
        if min_parcel_budget and budget_inr < min_parcel_budget:
            suggestions.append(
                f"Increase working budget to at least ₹{min_parcel_budget:,.0f} to cultivate "
                f"a minimum 0.1-acre plot of the least-expensive compatible crop in {season} season."
            )
        if full_farm_budget:
            suggestions.append(
                f"To cultivate your entire {area_acres:.1f}-acre farm with the most affordable crop, "
                f"a working budget of ₹{full_farm_budget:,.0f} is required."
            )

    # Check if water is the bottleneck
    water_alts = [a for a in alternatives if a.adjustment_type == "water"]
    if water_alts:
        min_water = minimum_water_for_lowest_demand_crop(
            season, soil_type, expected_rainfall_mm, area_acres
        )
        if min_water is not None and min_water > available_water_m3:
            suggestions.append(
                f"Increase available irrigation water to at least {min_water:,.0f} m³ "
                f"for the least water-intensive crop across {area_acres:.1f} acres."
            )

    # Season alternatives
    season_alts = [a for a in alternatives if a.adjustment_type == "season"]
    if season_alts:
        top_alt = season_alts[0]
        suggestions.append(
            f"Consider seasonal rotation: {top_alt.name} is ideally suited for your {soil_type} soil "
            f"in {top_alt.season} season."
        )

    # Soil alternatives
    soil_alts = [a for a in alternatives if a.adjustment_type == "soil"]
    if soil_alts:
        suggestions.append(
            f"Some high-value {season} crops require Loamy or Clay soil. "
            f"Organic matter or compost addition can help expand soil compatibility."
        )

    if not suggestions:
        suggestions.append(
            "Review your farm parameters: season, soil type, available irrigation water, and operational budget."
        )

    return suggestions
