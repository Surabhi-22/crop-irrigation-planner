"""
Crop selector — budget-aware agronomic feasibility filter and ranking engine.

Filters and categorizes the agronomic reference database into three distinct tiers:
  Category A: Feasible Recommendations
    Crops satisfying season and soil suitability, sized to the maximum affordable
    and water-viable cultivated area (either full farm or realistic partial parcel).
  Category B: Alternative Recommendations
    Crops that could become feasible with clearly quantified adjustments:
    season rotation, soil texture adaptation, budget increase, or water enhancement.
  Category C: Unsuitable Crops
    Crops failing core agronomic boundaries (incompatible season and soil).

Zero-Budget Handling:
  - budget_inr = None : Unconstrained budget mode (no capital limitation).
  - budget_inr = 0.0  : Zero operational capital (crops requiring funds categorized as alternatives).
  - budget_inr > 0.0  : Sized proportionally to available working capital.

Rainfall Qualification:
  - Expected rainfall is subtracted directly from seasonal crop water requirement as a
    simplified planning baseline assumption (100% effective precipitation).
  - Actual field effective rainfall varies with soil infiltration rate and runoff.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from app.services.crop_data import CROP_DB, MM_PER_ACRE_TO_M3

# Minimum viable plot size for smallholder cultivation planning (approx 400 m² / 0.1 acre).
# Note: This is a configurable planning assumption for field crops, not an absolute biological law.
MIN_VIABLE_CULTIVATION_ACRES: float = 0.1


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class FeasibleCrop:
    """A crop that has passed feasibility gates for the recommended cultivated area."""

    name: str
    season: str
    duration_days: str
    notes: str

    # Reference per-acre values
    water_req_mm: float
    yield_t_per_acre: float
    price_inr_per_tonne: float
    cost_inr_per_acre: float

    # Computed financials for the full/recommended parcel
    irrigation_req_m3: float
    total_yield_tonnes: float
    total_revenue_inr: float
    total_cost_inr: float
    total_profit_inr: float

    # Feasibility status
    season_ok: bool
    soil_ok: bool
    water_ok: bool
    budget_ok: bool

    # Sizing for the recommended cultivated parcel (defaults for backwards compatibility)
    cultivated_area_acres: float = 0.0
    remaining_area_acres: float = 0.0
    is_partial_area: bool = False
    limiting_factor: str = "None"  # "None", "Budget", "Water", "Budget and Water"
    roi_pct: float = 0.0
    remaining_budget_inr: float = 0.0
    full_area_cost_inr: float = 0.0
    budget_gap_for_full_area_inr: float = 0.0
    suitability_reason: str = ""
    category: str = "recommended"


@dataclass
class AlternativeCrop:
    """A crop that can become viable with a specific, quantified adjustment."""

    name: str
    season: str
    duration_days: str
    notes: str
    cost_inr_per_acre: float
    water_req_mm: float
    yield_t_per_acre: float
    price_inr_per_tonne: float
    category: str = "alternative"

    required_adjustment: str = ""
    adjustment_type: str = ""  # "budget", "water", "season", "soil", "area"
    full_area_cost_inr: float = 0.0
    budget_gap_inr: float = 0.0
    water_gap_m3: float = 0.0
    alternative_season: Optional[str] = None
    target_soil: Optional[str] = None
    why_alternative: str = ""


@dataclass
class RejectedCrop:
    """A crop failing core agronomic constraints — kept for diagnostics and transparency."""

    name: str
    rejection_reasons: List[str]
    category: str = "unsuitable"
    season: str = ""
    soils: List[str] = field(default_factory=list)
    water_req_mm: float = 0.0
    cost_inr_per_acre: float = 0.0
    notes: str = ""


# ---------------------------------------------------------------------------
# Main selector function
# ---------------------------------------------------------------------------


def select_feasible_crops(
    season: str,
    soil_type: str,
    area_acres: float,
    expected_rainfall_mm: float,
    available_water_m3: float,
    budget_inr: Optional[float] = None,
) -> Tuple[List[FeasibleCrop], List[AlternativeCrop], List[RejectedCrop]]:
    """
    Filter the crop database into three distinct recommendation tiers:
      Category A: Feasible crops sized to affordable/water-viable parcel.
      Category B: Alternative crops requiring quantified adjustments.
      Category C: Unsuitable crops failing core agronomic constraints.

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
    budget_inr : Optional[float]
        Total available operational working capital in INR.
        None = unconstrained (unlimited) budget.
        0.0  = zero operational capital.
        >0   = actual available budget limit.

    Returns
    -------
    (feasible_crops, alternative_crops, rejected_crops)
        feasible_crops sorted by estimated profit descending.
    """
    season_norm = season.strip().capitalize()
    soil_norm = soil_type.strip().capitalize()
    farm_area = float(area_acres)
    rainfall_mm = max(0.0, float(expected_rainfall_mm))
    water_supply_m3 = max(0.0, float(available_water_m3))

    feasible: List[FeasibleCrop] = []
    alternatives: List[AlternativeCrop] = []
    rejected: List[RejectedCrop] = []

    for entry in CROP_DB:
        crop_name = entry["name"]
        crop_seasons = entry["seasons"]
        crop_soils = entry["soils"]
        cost_per_acre = float(entry["cost_inr_per_acre"])
        yield_per_acre = float(entry["yield_t_per_acre"])
        price_per_tonne = float(entry["price_inr_per_tonne"])
        water_req_mm = float(entry["water_req_mm"])

        season_ok = season_norm in crop_seasons
        soil_ok = soil_norm in crop_soils

        full_area_cost = round(cost_per_acre * farm_area, 2)
        if budget_inr is not None:
            budget_val = float(budget_inr)
            budget_gap_full = round(max(0.0, full_area_cost - budget_val), 2)
        else:
            budget_gap_full = 0.0

        # Simplified baseline hydrological assumption:
        # Precipitation directly offsets seasonal crop water requirement.
        # Qualified in API/UI as a simplified planning baseline.
        effective_irrigation_mm = max(0.0, water_req_mm - rainfall_mm)
        water_per_acre_m3 = effective_irrigation_mm * MM_PER_ACRE_TO_M3
        full_area_water_m3 = round(water_per_acre_m3 * farm_area, 2)
        water_gap_full = round(max(0.0, full_area_water_m3 - water_supply_m3), 2)

        # ── CASE 1: Season & Soil both compatible ──────────────────────────
        if season_ok and soil_ok:
            # 1. Determine maximum area permitted by water availability
            if water_per_acre_m3 > 0:
                max_water_area = water_supply_m3 / water_per_acre_m3
            else:
                max_water_area = farm_area  # Rainfall covers 100% of seasonal water need

            # 2. Determine maximum area permitted by operational budget
            # budget_inr = None: unconstrained
            # budget_inr = 0.0: zero operational capital (area = 0.0)
            # budget_inr > 0.0: affordable parcel
            if budget_inr is not None:
                budget = float(budget_inr)
                if budget > 0:
                    max_budget_area = budget / cost_per_acre
                else:
                    max_budget_area = 0.0  # Zero operational capital
            else:
                max_budget_area = farm_area  # Unconstrained budget

            # 3. Determine constrained feasible area
            max_feasible_area = min(farm_area, max_water_area, max_budget_area)

            # 4. Check if at least a minimum viable parcel (0.1 acre) can be grown
            if max_feasible_area >= MIN_VIABLE_CULTIVATION_ACRES:
                # Conservative 2-decimal truncation to strictly respect resource ceilings
                cultivated_area = round(
                    math.floor(min(farm_area, max_feasible_area) * 100.0) / 100.0, 2
                )
                if cultivated_area > farm_area:
                    cultivated_area = farm_area

                is_partial = cultivated_area < (farm_area - 0.005)
                remaining_area = round(max(0.0, farm_area - cultivated_area), 2)

                # Determine primary limiting factor
                if not is_partial:
                    limiting_factor = "None"
                elif max_budget_area < farm_area and max_water_area < farm_area:
                    limiting_factor = "Budget and Water"
                elif max_budget_area < farm_area:
                    limiting_factor = "Budget"
                else:
                    limiting_factor = "Water"

                # Financial and yield calculations for the recommended cultivated parcel
                total_cost = round(cost_per_acre * cultivated_area, 2)
                remaining_budget = (
                    round(max(0.0, float(budget_inr) - total_cost), 2)
                    if budget_inr is not None
                    else 0.0
                )
                total_yield = round(yield_per_acre * cultivated_area, 3)
                total_revenue = round(total_yield * price_per_tonne, 2)
                total_profit = round(total_revenue - total_cost, 2)
                roi_pct = (
                    round((total_profit / total_cost * 100.0), 1) if total_cost > 0 else 0.0
                )
                irrigation_req_m3 = round(
                    effective_irrigation_mm * cultivated_area * MM_PER_ACRE_TO_M3, 2
                )

                # Farmer-friendly suitability reason
                if is_partial:
                    budget_str = f"₹{float(budget_inr):,.0f}" if budget_inr is not None else "available"
                    suitability_reason = (
                        f"Budget-optimized for {cultivated_area:.2f} acres "
                        f"({remaining_area:.2f} ac uncultivated). Cultivation cost ₹{total_cost:,.0f} "
                        f"fits your {budget_str} budget (₹{remaining_budget:,.0f} reserve). "
                        f"Full {farm_area:.1f}-acre cultivation requires ₹{full_area_cost:,.0f} (+₹{budget_gap_full:,.0f})."
                    )
                else:
                    if budget_inr is None:
                        suitability_reason = (
                            f"Unconstrained budget mode: Cultivates your full {farm_area:.1f}-acre farm "
                            f"with {season_norm}-adapted {crop_name} on {soil_norm} soil. "
                            f"Estimated cost ₹{total_cost:,.0f}, net profit ₹{total_profit:,.0f}."
                        )
                    else:
                        suitability_reason = (
                            f"Ideal {season_norm} crop for {soil_norm} soil. Your budget and water reserves "
                            f"comfortably cover the full {farm_area:.1f} acres with ₹{total_cost:,.0f} total cost "
                            f"and estimated ₹{total_profit:,.0f} net profit."
                        )

                feasible.append(
                    FeasibleCrop(
                        name=crop_name,
                        season=season_norm,
                        duration_days=entry["duration_days"],
                        notes=entry["notes"],
                        water_req_mm=water_req_mm,
                        yield_t_per_acre=yield_per_acre,
                        price_inr_per_tonne=price_per_tonne,
                        cost_inr_per_acre=cost_per_acre,
                        cultivated_area_acres=cultivated_area,
                        remaining_area_acres=remaining_area,
                        is_partial_area=is_partial,
                        limiting_factor=limiting_factor,
                        irrigation_req_m3=irrigation_req_m3,
                        total_yield_tonnes=total_yield,
                        total_revenue_inr=total_revenue,
                        total_cost_inr=total_cost,
                        total_profit_inr=total_profit,
                        roi_pct=roi_pct,
                        remaining_budget_inr=remaining_budget,
                        full_area_cost_inr=full_area_cost,
                        budget_gap_for_full_area_inr=budget_gap_full,
                        season_ok=True,
                        soil_ok=True,
                        water_ok=True,
                        budget_ok=True,
                        suitability_reason=suitability_reason,
                        category="recommended",
                    )
                )
            else:
                # Compatible with season and soil, but insufficient resource for even 0.1 acre
                if budget_inr is not None and float(budget_inr) == 0.0:
                    min_cost_needed = round(cost_per_acre * MIN_VIABLE_CULTIVATION_ACRES, 0)
                    adj_msg = (
                        f"Zero operational capital provided (₹0). Commercial cultivation of {crop_name} "
                        f"requires working capital for seeds and land prep (minimum ₹{min_cost_needed:,.0f} for a 0.1-acre plot; "
                        f"₹{full_area_cost:,.0f} for full {farm_area:.1f} acres)."
                    )
                    adj_type = "budget"
                elif max_budget_area < MIN_VIABLE_CULTIVATION_ACRES:
                    min_cost_needed = round(cost_per_acre * MIN_VIABLE_CULTIVATION_ACRES, 0)
                    budget_str = f"₹{float(budget_inr):,.0f}" if budget_inr is not None else "₹0"
                    adj_msg = (
                        f"Budget constraint: Current budget ({budget_str}) is below minimum viable 0.1-acre cost "
                        f"(₹{min_cost_needed:,.0f}). Cultivating full {farm_area:.1f} acres requires ₹{full_area_cost:,.0f} "
                        f"(budget gap: +₹{budget_gap_full:,.0f})."
                    )
                    adj_type = "budget"
                else:
                    min_water_needed = round(water_per_acre_m3 * MIN_VIABLE_CULTIVATION_ACRES, 0)
                    adj_msg = (
                        f"Water constraint: Irrigation supply ({water_supply_m3:,.0f} m³) cannot support 0.1-acre minimum parcel "
                        f"({min_water_needed:,.0f} m³ required). Full farm requires {full_area_water_m3:,.0f} m³ (+{water_gap_full:,.0f} m³)."
                    )
                    adj_type = "water"

                alternatives.append(
                    AlternativeCrop(
                        name=crop_name,
                        season=season_norm,
                        duration_days=entry["duration_days"],
                        notes=entry["notes"],
                        cost_inr_per_acre=cost_per_acre,
                        water_req_mm=water_req_mm,
                        yield_t_per_acre=yield_per_acre,
                        price_inr_per_tonne=price_per_tonne,
                        category="alternative",
                        required_adjustment=adj_msg,
                        adjustment_type=adj_type,
                        full_area_cost_inr=full_area_cost,
                        budget_gap_inr=budget_gap_full,
                        water_gap_m3=water_gap_full,
                        why_alternative=f"Agronomically compatible with {season_norm} on {soil_norm} soil, but requires additional {adj_type} to cultivate.",
                    )
                )

        # ── CASE 2: Soil compatible, but different season ──────────────────
        elif soil_ok and not season_ok:
            target_seasons = ", ".join(crop_seasons)
            adj_msg = (
                f"Seasonal rotation: Not grown in {season_norm} season. Highly recommended for {target_seasons} "
                f"cycle on your {soil_norm} soil (cultivation cost: ₹{cost_per_acre:,.0f}/ac, water: {water_req_mm:.0f} mm)."
            )
            alternatives.append(
                AlternativeCrop(
                    name=crop_name,
                    season=target_seasons,
                    duration_days=entry["duration_days"],
                    notes=entry["notes"],
                    cost_inr_per_acre=cost_per_acre,
                    water_req_mm=water_req_mm,
                    yield_t_per_acre=yield_per_acre,
                    price_inr_per_tonne=price_per_tonne,
                    category="alternative",
                    required_adjustment=adj_msg,
                    adjustment_type="season",
                    full_area_cost_inr=full_area_cost,
                    budget_gap_inr=budget_gap_full,
                    water_gap_m3=water_gap_full,
                    alternative_season=target_seasons,
                    why_alternative=f"Natural fit for {soil_norm} soil; plan for the upcoming {crop_seasons[0]} planting window.",
                )
            )

        # ── CASE 3: Season compatible, but soil requires adaptation ────────
        elif season_ok and not soil_ok:
            target_soils = ", ".join(crop_soils)
            adj_msg = (
                f"Soil adaptation: Requires {target_soils} soil (incompatible with unamended {soil_norm} soil). "
                f"Viable if your land has loamy parcels or with organic soil conditioning (₹{cost_per_acre:,.0f}/ac)."
            )
            alternatives.append(
                AlternativeCrop(
                    name=crop_name,
                    season=season_norm,
                    duration_days=entry["duration_days"],
                    notes=entry["notes"],
                    cost_inr_per_acre=cost_per_acre,
                    water_req_mm=water_req_mm,
                    yield_t_per_acre=yield_per_acre,
                    price_inr_per_tonne=price_per_tonne,
                    category="alternative",
                    required_adjustment=adj_msg,
                    adjustment_type="soil",
                    full_area_cost_inr=full_area_cost,
                    budget_gap_inr=budget_gap_full,
                    water_gap_m3=water_gap_full,
                    target_soil=target_soils,
                    why_alternative=f"High-value {season_norm} crop with strong MSP/market price, viable if soil conditions can be enriched.",
                )
            )

        # ── CASE 4: Category C: Unsuitable Crops ───────────────────────────
        else:
            reasons: List[str] = []
            if not season_ok:
                reasons.append(
                    f"Not suited for {season_norm} season (grows in: {', '.join(crop_seasons)})"
                )
            if not soil_ok:
                reasons.append(
                    f"Incompatible with {soil_norm} soil (requires: {', '.join(crop_soils)})"
                )
            if effective_irrigation_mm * MM_PER_ACRE_TO_M3 * farm_area > water_supply_m3:
                needed = effective_irrigation_mm * MM_PER_ACRE_TO_M3 * farm_area
                reasons.append(f"Excessive water demand ({needed:,.0f} m³ needed vs {water_supply_m3:,.0f} m³ supply)")

            rejected.append(
                RejectedCrop(
                    name=crop_name,
                    rejection_reasons=reasons,
                    category="unsuitable",
                    season=", ".join(crop_seasons),
                    soils=crop_soils,
                    water_req_mm=water_req_mm,
                    cost_inr_per_acre=cost_per_acre,
                    notes=entry["notes"],
                )
            )

    # Rank feasible crops: estimated profit primary, ROI secondary
    feasible.sort(key=lambda c: (c.total_profit_inr, c.roi_pct), reverse=True)
    return feasible, alternatives, rejected


# ---------------------------------------------------------------------------
# Helper functions for budget and water diagnostics
# ---------------------------------------------------------------------------


def minimum_budget_for_cheapest_crop(
    season: str,
    soil_type: str,
    area_acres: float,
) -> Optional[float]:
    """
    Return the minimum total budget needed to cultivate the cheapest compatible
    crop for the full farm area.
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


def minimum_budget_for_minimum_parcel(
    season: str,
    soil_type: str,
    parcel_acres: float = MIN_VIABLE_CULTIVATION_ACRES,
) -> Optional[float]:
    """
    Return the minimum budget needed to cultivate a minimum viable plot (0.1 acre).
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
    return cheapest["cost_inr_per_acre"] * parcel_acres


def minimum_water_for_lowest_demand_crop(
    season: str,
    soil_type: str,
    expected_rainfall_mm: float,
    area_acres: float,
) -> Optional[float]:
    """
    Return the minimum irrigation water (m³) needed by the least thirsty
    compatible crop for the full farm area.
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
