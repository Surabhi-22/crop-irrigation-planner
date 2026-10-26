"""
Crop selector — filters the agronomic reference database by:
  1. Season compatibility
  2. Soil type suitability
  3. Irrigation water feasibility
  4. Budget feasibility (total cost for the full farm area)

Returns a list of FeasibleCrop objects ranked by estimated profit (descending).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from app.services.crop_data import CROP_DB, MM_PER_ACRE_TO_M3


# ---------------------------------------------------------------------------
# Data classes returned by this module
# ---------------------------------------------------------------------------


@dataclass
class FeasibleCrop:
    """A crop that has passed all feasibility gates for the given farm."""

    name: str
    season: str
    duration_days: str
    notes: str

    # Reference per-acre values
    water_req_mm: float
    yield_t_per_acre: float
    price_inr_per_tonne: float
    cost_inr_per_acre: float

    # Computed values for the full farm area
    irrigation_req_m3: float       # irrigation water needed (m³) for area_acres
    total_yield_tonnes: float
    total_revenue_inr: float
    total_cost_inr: float
    total_profit_inr: float

    # Feasibility flags (useful for partial-pass reporting)
    season_ok: bool
    soil_ok: bool
    water_ok: bool
    budget_ok: bool


@dataclass
class RejectedCrop:
    """A crop that failed one or more feasibility gates — kept for diagnostics."""

    name: str
    rejection_reasons: List[str]


# ---------------------------------------------------------------------------
# Main selector function
# ---------------------------------------------------------------------------


def select_feasible_crops(
    season: str,
    soil_type: str,
    area_acres: float,
    expected_rainfall_mm: float,
    available_water_m3: float,
    budget_inr: float,
) -> tuple[List[FeasibleCrop], List[RejectedCrop]]:
    """
    Filter the crop database and return feasible + rejected crops.

    Parameters
    ----------
    season : str
        Agricultural season ("Kharif", "Rabi", "Summer").
    soil_type : str
        Soil classification ("Loamy", "Clay", "Sandy", "Silty").
    area_acres : float
        Total farm area in acres (> 0).
    expected_rainfall_mm : float
        Forecasted seasonal precipitation (mm); reduces irrigation requirement.
    available_water_m3 : float
        Total volumetric irrigation water reserve (m³).
        When 0 the crop can still grow if rainfall covers its entire water need.
    budget_inr : float
        Total available budget in INR.
        When 0 budget constraint is skipped (unlimited).

    Returns
    -------
    (feasible_crops, rejected_crops)
        feasible_crops sorted by descending total_profit_inr.
    """
    season_norm = season.strip().capitalize()
    soil_norm = soil_type.strip().capitalize()

    feasible: List[FeasibleCrop] = []
    rejected: List[RejectedCrop] = []

    for entry in CROP_DB:
        reasons: List[str] = []

        # ── Gate 1: Season compatibility ─────────────────────────────────
        season_ok = season_norm in entry["seasons"]
        if not season_ok:
            reasons.append(
                f"Not suited for {season_norm} season "
                f"(grows in: {', '.join(entry['seasons'])})"
            )

        # ── Gate 2: Soil suitability ──────────────────────────────────────
        soil_ok = soil_norm in entry["soils"]
        if not soil_ok:
            reasons.append(
                f"Not suited for {soil_norm} soil "
                f"(requires: {', '.join(entry['soils'])})"
            )

        # ── Gate 3: Irrigation water feasibility ──────────────────────────
        # Effective irrigation need = total water req − expected rainfall
        # (clamped to 0 — rainfall cannot add to the irrigation reserve)
        effective_irrigation_mm = max(
            0.0, entry["water_req_mm"] - expected_rainfall_mm
        )
        irrigation_req_m3 = effective_irrigation_mm * area_acres * MM_PER_ACRE_TO_M3

        water_ok = irrigation_req_m3 <= available_water_m3
        if not water_ok:
            reasons.append(
                f"Insufficient irrigation water: needs {irrigation_req_m3:,.0f} m³ "
                f"but only {available_water_m3:,.0f} m³ available "
                f"(crop water requirement {entry['water_req_mm']} mm; "
                f"rainfall covers {min(expected_rainfall_mm, entry['water_req_mm']):.0f} mm)"
            )

        # ── Gate 4: Budget feasibility ────────────────────────────────────
        total_cost = entry["cost_inr_per_acre"] * area_acres
        budget_ok = (budget_inr <= 0) or (total_cost <= budget_inr)
        if not budget_ok:
            reasons.append(
                f"Exceeds budget: cultivation costs ₹{total_cost:,.0f} "
                f"({area_acres} ac × ₹{entry['cost_inr_per_acre']:,}/ac) "
                f"but budget is ₹{budget_inr:,.0f}"
            )

        # ── Outcome ───────────────────────────────────────────────────────
        if reasons:
            rejected.append(RejectedCrop(name=entry["name"], rejection_reasons=reasons))
            continue

        # All gates passed — compute full-area financials
        total_yield = entry["yield_t_per_acre"] * area_acres
        total_revenue = total_yield * entry["price_inr_per_tonne"]
        total_profit = total_revenue - total_cost

        feasible.append(
            FeasibleCrop(
                name=entry["name"],
                season=season_norm,
                duration_days=entry["duration_days"],
                notes=entry["notes"],
                water_req_mm=entry["water_req_mm"],
                yield_t_per_acre=entry["yield_t_per_acre"],
                price_inr_per_tonne=entry["price_inr_per_tonne"],
                cost_inr_per_acre=entry["cost_inr_per_acre"],
                irrigation_req_m3=irrigation_req_m3,
                total_yield_tonnes=total_yield,
                total_revenue_inr=total_revenue,
                total_cost_inr=total_cost,
                total_profit_inr=total_profit,
                season_ok=season_ok,
                soil_ok=soil_ok,
                water_ok=water_ok,
                budget_ok=budget_ok,
            )
        )

    # Sort feasible crops: highest profit first
    feasible.sort(key=lambda c: c.total_profit_inr, reverse=True)
    return feasible, rejected


def minimum_budget_for_cheapest_crop(
    season: str,
    soil_type: str,
    area_acres: float,
) -> Optional[float]:
    """
    Return the minimum total budget needed to cultivate the cheapest compatible
    crop.  Used to generate actionable feedback in infeasibility messages.
    """
    season_norm = season.strip().capitalize()
    soil_norm = soil_type.strip().capitalize()

    eligible = [
        entry
        for entry in CROP_DB
        if season_norm in entry["seasons"] and soil_norm in entry["soils"]
    ]
    if not eligible:
        return None

    cheapest = min(eligible, key=lambda e: e["cost_inr_per_acre"])
    return cheapest["cost_inr_per_acre"] * area_acres


def minimum_water_for_lowest_demand_crop(
    season: str,
    soil_type: str,
    expected_rainfall_mm: float,
    area_acres: float,
) -> Optional[float]:
    """
    Return the minimum irrigation water (m³) needed by the least thirsty
    compatible crop.  Used for infeasibility feedback.
    """
    season_norm = season.strip().capitalize()
    soil_norm = soil_type.strip().capitalize()

    eligible = [
        entry
        for entry in CROP_DB
        if season_norm in entry["seasons"] and soil_norm in entry["soils"]
    ]
    if not eligible:
        return None

    min_entry = min(eligible, key=lambda e: e["water_req_mm"])
    eff_irrig = max(0.0, min_entry["water_req_mm"] - expected_rainfall_mm)
    return eff_irrig * area_acres * MM_PER_ACRE_TO_M3
