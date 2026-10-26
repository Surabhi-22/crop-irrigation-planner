"""
Planning service — orchestrates the full crop planning pipeline.

Pipeline:
  1. Validate inputs (delegate to FastAPI / Pydantic layer upstream).
  2. Call crop_selector to find feasible crops.
  3. Call water_allocator to distribute the irrigation reserve.
  4. Build and return a structured PlanResult.
  5. Raise InfeasiblePlanError with a clear explanation if nothing is feasible.

This module contains no trained ML models.  All predictions are computed from
ICAR agronomic benchmarks.  All financial figures are estimates — they are
clearly labelled as such in the PlanResult and in the API response.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from app.services.crop_selector import (
    FeasibleCrop,
    RejectedCrop,
    minimum_budget_for_cheapest_crop,
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
    soil, water, budget) for the given farm parameters.
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

    All financial figures are marked as estimates — they are derived from
    ICAR benchmarks, not from live market feeds or trained ML models.
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

    # ── Crop results ──────────────────────────────────────────────────────
    feasible_crops: List[FeasibleCrop]    # all crops that passed all gates
    rejected_crops: List[RejectedCrop]    # crops that failed and why
    top_recommendation: FeasibleCrop      # best crop by estimated profit

    # ── Aggregated financials for top recommendation ──────────────────────
    est_total_yield_tonnes: float
    est_total_revenue_inr: float
    est_total_cost_inr: float
    est_total_profit_inr: float

    # ── Planning metadata ─────────────────────────────────────────────────
    planning_notes: List[str] = field(default_factory=list)
    data_source: str = "ICAR agronomic benchmarks (2023–24) — estimates only"
    disclaimer: str = (
        "All yield, revenue, cost, and profit figures are indicative estimates "
        "derived from ICAR benchmark data and APMC market prices. "
        "Actual results depend on local soil health, weather variability, "
        "pest pressure, and market conditions. "
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
    budget_inr: float,
) -> PlanResult:
    """
    Generate a crop plan for the given farm parameters.

    Parameters
    ----------
    area_acres : float            Farm area in acres (> 0).
    soil_type : str               Soil classification.
    expected_rainfall_mm : float  Seasonal rainfall in mm.
    available_water_m3 : float    Irrigation water reserve in m³.
    location : str                Geographic region / district.
    season : str                  Agricultural season.
    budget_inr : float            Total budget in INR (0 = unlimited).

    Returns
    -------
    PlanResult

    Raises
    ------
    InfeasiblePlanError
        When no crop can satisfy all constraints.
    """
    notes: List[str] = []

    # ── Step 1: Select feasible crops ─────────────────────────────────────
    feasible, rejected = select_feasible_crops(
        season=season,
        soil_type=soil_type,
        area_acres=area_acres,
        expected_rainfall_mm=expected_rainfall_mm,
        available_water_m3=available_water_m3,
        budget_inr=budget_inr,
    )

    # ── Step 2: Handle infeasibility ──────────────────────────────────────
    if not feasible:
        suggestions = _build_infeasibility_suggestions(
            season=season,
            soil_type=soil_type,
            area_acres=area_acres,
            expected_rainfall_mm=expected_rainfall_mm,
            available_water_m3=available_water_m3,
            budget_inr=budget_inr,
            rejected=rejected,
        )

        reason = _summarise_infeasibility(
            rejected=rejected,
            season=season,
            soil_type=soil_type,
        )

        raise InfeasiblePlanError(reason=reason, suggestions=suggestions)

    # ── Step 3: Water allocation ───────────────────────────────────────────
    water_alloc = allocate_water(feasible, available_water_m3)

    # ── Step 4: Build notes ────────────────────────────────────────────────
    if budget_inr <= 0:
        notes.append("Budget constraint was skipped (budget set to 0).")

    rain_vol_m3 = expected_rainfall_mm * area_acres * MM_PER_ACRE_TO_M3
    notes.append(
        f"Expected seasonal rainfall ({expected_rainfall_mm:.0f} mm) covers "
        f"approximately {rain_vol_m3:,.0f} m³ over {area_acres} acres "
        f"and is subtracted from each crop's irrigation requirement."
    )

    if len(feasible) > 1:
        notes.append(
            f"{len(feasible)} crops are feasible for your farm. "
            f"The top recommendation maximises estimated profit."
        )

    top = feasible[0]

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
        top_recommendation=top,
        est_total_yield_tonnes=top.total_yield_tonnes,
        est_total_revenue_inr=top.total_revenue_inr,
        est_total_cost_inr=top.total_cost_inr,
        est_total_profit_inr=top.total_profit_inr,
        planning_notes=notes,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _summarise_infeasibility(
    rejected: List[RejectedCrop],
    season: str,
    soil_type: str,
) -> str:
    """Build a human-readable summary of why all crops were rejected."""
    season_failures = sum(
        1 for r in rejected if any("season" in reason.lower() for reason in r.rejection_reasons)
    )
    soil_failures = sum(
        1 for r in rejected if any("soil" in reason.lower() for reason in r.rejection_reasons)
    )
    water_failures = sum(
        1 for r in rejected if any("water" in reason.lower() for reason in r.rejection_reasons)
    )
    budget_failures = sum(
        1 for r in rejected if any("budget" in reason.lower() for reason in r.rejection_reasons)
    )

    parts: List[str] = []
    if season_failures:
        parts.append(f"{season_failures} crop(s) are not grown in {season} season")
    if soil_failures:
        parts.append(f"{soil_failures} crop(s) are incompatible with {soil_type} soil")
    if water_failures:
        parts.append(f"{water_failures} crop(s) require more irrigation water than available")
    if budget_failures:
        parts.append(f"{budget_failures} crop(s) exceed the available budget")

    if not parts:
        return "No crops are feasible for the given farm parameters."

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
    budget_inr: float,
    rejected: List[RejectedCrop],
) -> List[str]:
    """Generate actionable suggestions for the user."""
    suggestions: List[str] = []

    # Check if budget is the binding constraint
    budget_rejections = [
        r for r in rejected
        if any("budget" in reason.lower() for reason in r.rejection_reasons)
        and not any("season" in reason.lower() or "soil" in reason.lower()
                    for reason in r.rejection_reasons)
    ]
    if budget_rejections and budget_inr > 0:
        min_budget = minimum_budget_for_cheapest_crop(season, soil_type, area_acres)
        if min_budget:
            suggestions.append(
                f"Increase your budget to at least ₹{min_budget:,.0f} to cultivate "
                f"the least-expensive suitable crop for {area_acres} acres in {season} season."
            )

    # Check if water is the binding constraint
    water_rejections = [
        r for r in rejected
        if any("water" in reason.lower() for reason in r.rejection_reasons)
        and not any("season" in reason.lower() or "soil" in reason.lower()
                    for reason in r.rejection_reasons)
    ]
    if water_rejections:
        min_water = minimum_water_for_lowest_demand_crop(
            season, soil_type, expected_rainfall_mm, area_acres
        )
        if min_water is not None and min_water > available_water_m3:
            suggestions.append(
                f"Increase available irrigation water to at least {min_water:,.0f} m³ "
                f"for the least water-intensive crop in {season} season."
            )
        elif min_water == 0 or min_water is None:
            suggestions.append(
                "Consider rain-fed crops for this season — some crops require "
                "no supplemental irrigation when seasonal rainfall exceeds their water need."
            )

    # Season mismatch
    season_only_rejections = [
        r for r in rejected
        if all("season" in reason.lower() for reason in r.rejection_reasons)
    ]
    if len(season_only_rejections) == len(rejected):
        suggestions.append(
            f"All crops were rejected due to season mismatch. "
            f"Check that '{season}' is spelled correctly (Kharif / Rabi / Summer)."
        )

    # Soil mismatch
    soil_only_rejections = [
        r for r in rejected
        if all("soil" in reason.lower() for reason in r.rejection_reasons)
    ]
    if soil_only_rejections:
        suggestions.append(
            f"Some crops were rejected due to soil incompatibility with '{soil_type}'. "
            f"Supported soil types are: Loamy, Clay, Sandy, Silty."
        )

    if not suggestions:
        suggestions.append(
            "Review your farm parameters: season, soil type, available water, and budget."
        )

    return suggestions
